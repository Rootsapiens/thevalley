"""Builds the root-creature bot (world-bible section 4) as a Character Blueprint with a plain state machine.

  /Game/OmegaValley/Bots/BP_OV_RootBot
    Body: engine BasicShapes only (trunk, knotted crown, four splayed roots, a lash arm on a pivot) + an amber TellLight.
    Movement: NavMesh via AIController (SimpleMoveToLocation / SimpleMoveToActor; GetRandomReachablePointInRadius).
    States (int State): 0 IDLE, 1 PATROL, 2 CHASE, 3 WINDUP, 4 ATTACK, 5 PAIN, 6 RETREAT, 7 DEAD.
      IDLE    -> PATROL after IdleSec, -> CHASE once the player has been seen for ReactionSec
      PATROL  random reachable point within PatrolRadius of home; -> IDLE on arrival
      CHASE   repaths to the player every 0.35 s; -> WINDUP in lash range when the cooldown is over; -> PATROL when lost
      WINDUP  the tell: stops, faces the player, crown turns amber, TellLight on, lash arm raised behind (WindupSec)
      ATTACK  the lash swings forward; lands if rand < Accuracy and the player is still in reach and in sight
      PAIN    any hit: knock-back, tell cancelled (so hitting a winding-up bot interrupts its attack)
      RETREAT "shocked": ShockDamage within ShockWindowSec pushes it back RetreatDist for RetreatSec (canon rule 6)
      DEAD    falls over, collision off, removed after DeathLifeSec
    Every state change is logged: "[OV BOT] <id> <tier> -> STATE" (LogBlueprintUserMessages).
Tier numbers (Easy/Medium/Hard: reaction, accuracy, speed, health, windup, cooldown, damage) come from
unreal/data/bots.json; place_bots.py writes them into each placed instance. Defaults here = Medium.
Run headless after make_weapons.py (the lash lowers BP_OV_WeaponRig.PlayerHP):
  UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\make_bots.py" -unattended -nosplash
"""
import json
import math
import os
import sys
import time
import traceback

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass
import ov_paths  # noqa: E402
from ov_bp import V, R, new_bp, var, event, function, add_component, compile_bp  # noqa: E402

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
DATA = ov_paths.data_file(PROJECT_DIR, "bots.json")
BOT = "/Game/OmegaValley/Bots/BP_OV_RootBot"
RIG_CLASS = "/Game/OmegaValley/Weapons/BP_OV_WeaponRig.BP_OV_WeaponRig_C"
MAT = "/Game/OmegaValley/Weapons/"
NIAGARA = "/Niagara/DefaultAssets/Templates/Systems/SimpleExplosion.SimpleExplosion"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), "ov_bots_result.json")
STATES = ["IDLE", "PATROL", "CHASE", "WINDUP", "ATTACK", "PAIN", "RETREAT", "DEAD"]
EAL = unreal.EditorAssetLibrary

# tier key in bots.json -> Blueprint variable
TIER_VARS = {"reactionSec": "ReactionTime", "accuracy": "Accuracy", "walkSpeed": "WalkSpeed", "chaseSpeed": "ChaseSpeed",
             "health": "MaxHealth", "windupSec": "WindupTime", "cooldownSec": "Cooldown", "damage": "Damage"}
COMMON_VARS = {"lashRangeCm": "LashRange", "sightRangeCm": "SightRange", "painSec": "PainTime", "shockDamage": "ShockDamage",
               "shockWindowSec": "ShockWindow", "retreatSec": "RetreatTime", "retreatDistCm": "RetreatDist",
               "patrolRadiusCm": "PatrolRadius", "idleSec": "IdleTime", "lostSec": "LostTime", "deathLifeSec": "DeathLife"}


def log(m):
    unreal.log("[OV BOTS] " + m)


def mat(name):
    m = EAL.load_asset(MAT + name)
    assert m, "material %s missing: run make_weapons.py first" % name
    return m


def body(bp):
    cyl = EAL.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
    sph = EAL.load_asset("/Engine/BasicShapes/Sphere.Sphere")
    bark, pale = mat("MI_OV_RootBark"), mat("MI_OV_RootPale")

    def part(name, mesh, m, loc, scale, rot=(0, 0, 0), parent=None, hit=True):
        c = add_component(bp, unreal.StaticMeshComponent, name, parent)
        c.set_editor_property("static_mesh", mesh)
        c.set_material(0, m)
        c.set_editor_property("relative_location", unreal.Vector(*loc))
        c.set_editor_property("relative_rotation", unreal.Rotator(pitch=rot[0], yaw=rot[1], roll=rot[2]))
        c.set_editor_property("relative_scale3d", unreal.Vector(*scale))
        c.set_editor_property("generate_overlap_events", False)
        c.set_editor_property("can_character_step_up_on", unreal.CanBeCharacterBase.ECB_NO)
        if hit:   # hitbox: blocks only Visibility traces (the player's hitscan); the capsule does the movement collision
            c.set_collision_enabled(unreal.CollisionEnabled.QUERY_ONLY)
            c.set_collision_response_to_all_channels(unreal.CollisionResponseType.ECR_IGNORE)
            c.set_collision_response_to_channel(unreal.CollisionChannel.ECC_VISIBILITY, unreal.CollisionResponseType.ECR_BLOCK)
        else:
            c.set_collision_profile_name("NoCollision")
        return c

    part("Trunk", cyl, bark, (0, 0, -20), (0.5, 0.5, 1.4))
    part("Crown", sph, pale, (0, 0, 62), (1.0, 1.0, 0.75))
    for name, loc, rot in [("RootL", (0, -26, -74), (0, 0, 35)), ("RootR", (0, 26, -74), (0, 0, -35)),
                           ("RootF", (26, 0, -74), (-35, 0, 0)), ("RootB", (-26, 0, -74), (35, 0, 0))]:
        part(name, cyl, bark, loc, (0.14, 0.14, 0.5), rot, hit=False)
    pivot = add_component(bp, unreal.SceneComponent, "LashPivot")
    pivot.set_editor_property("relative_location", unreal.Vector(18, 0, 35))
    pivot.set_editor_property("relative_rotation", unreal.Rotator(pitch=15, yaw=0, roll=0))
    part("Lash", cyl, bark, (0, 0, -55), (0.09, 0.09, 1.1), parent="LashPivot", hit=False)
    tl = add_component(bp, unreal.PointLightComponent, "TellLight")
    tl.set_editor_property("relative_location", unreal.Vector(30, 0, 62))
    tl.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
    tl.set_editor_property("intensity", 0.0)
    tl.set_editor_property("light_color", unreal.Color(r=255, g=150, b=60, a=255))
    tl.set_editor_property("attenuation_radius", 600.0)
    tl.set_editor_property("cast_shadows", False)


def build(cfg):
    tiers, common = cfg["tiers"], cfg["common"]
    med = tiers["Medium"]
    bp = new_bp(BOT, unreal.Character)
    body(bp)
    for key, name in TIER_VARS.items():
        var(bp, name, "real", float(med[key]))
    for key, name in COMMON_VARS.items():
        var(bp, name, "real", float(common[key]))
    for name, kind, d in [("BotId", "string", "root"), ("Tier", "string", "Medium"),
                          ("FovCos", "real", round(math.cos(math.radians(common["fovDeg"] / 2.0)), 4)),
                          ("State", "int", 0), ("StateStart", "real", 0.0), ("Health", "real", float(med["health"])),
                          ("Home", "vector", V((0, 0, 0))), ("PlayerLoc", "vector", V((0, 0, 0))), ("Dist", "real", 99999.0),
                          ("Sees", "bool", False), ("Reacted", "bool", False), ("SeenSince", "real", -1.0),
                          ("LastSeen", "real", -100.0), ("NextAttack", "real", 0.0), ("NextRepath", "real", 0.0),
                          ("RecentDmg", "real", 0.0), ("RecentStart", "real", -100.0),
                          ("Debug", "bool", False), ("NextDebug", "real", 0.0), ("DbgFov", "bool", False), ("DbgLos", "bool", False)]:
        var(bp, name, kind, d)
    RIG = RIG_CLASS

    def ctrl(g):
        return g.call("Pawn.GetController")

    def speed(g, var_name):
        g.s("MaxWalkSpeed", g.v(var_name), target=g.v("CharacterMovement"), cls="/Script/Engine.CharacterMovementComponent")

    def announce(g, k, extra=""):
        g.say(g.cat("[OV BOT] ", g.v("BotId"), " ", g.v("Tier"), " -> " + STATES[k] + extra), screen=False)

    # ----- tell on / off (the visible warning before every lash) -----
    g, _ = function(bp, "Tell_On")
    g.call("PrimitiveComponent.SetMaterial", target=g.v("Crown"), ElementIndex=0, Material=MAT + "MI_OV_RootTell.MI_OV_RootTell")
    g.call("LightComponent.SetIntensity", target=g.v("TellLight"), NewIntensity=60.0)
    g.call("SceneComponent.SetRelativeScale3D", target=g.v("Crown"), NewScale3D=V((1.2, 1.2, 0.95)))
    g.call("SceneComponent.K2_SetRelativeRotation", target=g.v("LashPivot"), NewRotation=R((-150, 0, 0)), bSweep=False, bTeleport=True)
    g, _ = function(bp, "Tell_Off")
    g.call("PrimitiveComponent.SetMaterial", target=g.v("Crown"), ElementIndex=0, Material=MAT + "MI_OV_RootPale.MI_OV_RootPale")
    g.call("LightComponent.SetIntensity", target=g.v("TellLight"), NewIntensity=0.0)
    g.call("SceneComponent.SetRelativeScale3D", target=g.v("Crown"), NewScale3D=V((1.0, 1.0, 0.75)))
    g.call("SceneComponent.K2_SetRelativeRotation", target=g.v("LashPivot"), NewRotation=R((15, 0, 0)), bSweep=False, bTeleport=True)

    # ----- state entries -----
    def enter(k):
        g, _ = function(bp, "Enter_%d" % k)
        g.s("State", k)
        g.s("StateStart", g.now())
        return g

    g = enter(0)                                  # IDLE
    g.call("Controller.StopMovement", target=ctrl(g))
    speed(g, "WalkSpeed")
    announce(g, 0)

    g = enter(1)                                  # PATROL
    speed(g, "WalkSpeed")
    pt = g.call("NavigationSystemV1.K2_GetRandomReachablePointInRadius", Origin=g.v("Home"), Radius=g.v("PatrolRadius"))
    g.call("AIBlueprintHelperLibrary.SimpleMoveToLocation", Controller=ctrl(g), Goal=pt.o("RandomLocation"))
    announce(g, 1)

    g = enter(2)                                  # CHASE
    speed(g, "ChaseSpeed")
    g.s("NextRepath", 0.0)
    g.me("Tell_Off")
    announce(g, 2)

    g = enter(3)                                  # WINDUP (tell)
    g.call("Controller.StopMovement", target=ctrl(g))
    g.me("Tell_On")
    announce(g, 3, " (creak, amber crown, lash raised)")

    g = enter(4)                                  # ATTACK
    g.me("Tell_Off")
    g.call("SceneComponent.K2_SetRelativeRotation", target=g.v("LashPivot"), NewRotation=R((85, 0, 0)), bSweep=False, bTeleport=True)
    lands = g.and_(g.and_(g.lt(g.f("RandomFloat"), g.v("Accuracy")), g.le(g.v("Dist"), g.mul(g.v("LashRange"), 1.15))), g.v("Sees"))
    with g.if_(lands) as b:
        rig = g.call("GameplayStatics.GetActorOfClass", ActorClass=RIG)
        with g.if_(g.valid(rig)):
            g.s("PlayerHP", g.sub(g.v("PlayerHP", target=rig, cls=RIG), g.v("Damage")), target=rig, cls=RIG)
            g.s("HurtEnd", g.add(g.now(), 0.3), target=rig, cls=RIG)
        g.call("NiagaraFunctionLibrary.SpawnSystemAtLocation", SystemTemplate=NIAGARA, Location=g.v("PlayerLoc"),
               Scale=V((0.08, 0.08, 0.08)), bAutoDestroy=True)
        g.say(g.cat("[OV BOT] ", g.v("BotId"), " lash HIT for ", g.str_f(g.v("Damage"))), screen=False)
    with g.else_(b):
        g.say(g.cat("[OV BOT] ", g.v("BotId"), " lash missed"), screen=False)
    g.s("NextAttack", g.add(g.now(), g.v("Cooldown")))
    announce(g, 4)

    g = enter(5)                                  # PAIN
    g.call("Controller.StopMovement", target=ctrl(g))
    g.me("Tell_Off")
    g.call("Character.LaunchCharacter", LaunchVelocity=g.vadd(g.vmul(g.call("Actor.GetActorForwardVector"), -250.0), V((0, 0, 120))),
           bXYOverride=True, bZOverride=True)
    announce(g, 5)

    g = enter(6)                                  # RETREAT (shocked)
    speed(g, "ChaseSpeed")
    g.me("Tell_Off")
    me_loc = g.loc()
    away = g.vadd(me_loc, g.vmul(g.f("Normal", A=g.vsub(me_loc, g.v("PlayerLoc"))), g.v("RetreatDist")))
    pt = g.call("NavigationSystemV1.K2_GetRandomReachablePointInRadius", Origin=away, Radius=250.0)
    g.call("AIBlueprintHelperLibrary.SimpleMoveToLocation", Controller=ctrl(g), Goal=pt.o("RandomLocation"))
    announce(g, 6, " (shocked)")

    g = enter(7)                                  # DEAD
    g.call("Controller.StopMovement", target=ctrl(g))
    g.me("Tell_Off")
    g.call("CharacterMovementComponent.DisableMovement", target=g.v("CharacterMovement"))
    for comp in ("Trunk", "Crown", "CapsuleComponent"):
        g.call("PrimitiveComponent.SetCollisionEnabled", target=g.v(comp), NewType="NoCollision")
    yaw = g.f("BreakRotator", InRot=g.call("Actor.K2_GetActorRotation")).o("Yaw")
    g.call("Actor.K2_SetActorRotation", NewRotation=g.rot(yaw=yaw, roll=80.0), bTeleportPhysics=True)
    g.call("Actor.K2_AddActorWorldOffset", DeltaLocation=V((0, 0, -50)), bSweep=False, bTeleport=True)
    g.call("Actor.SetLifeSpan", InLifespan=g.v("DeathLife"))
    rig = g.call("GameplayStatics.GetActorOfClass", ActorClass=RIG)
    with g.if_(g.valid(rig)):
        g.s("Kills", g.iadd(g.v("Kills", target=rig, cls=RIG), 1), target=rig, cls=RIG)
    announce(g, 7)

    # ----- perception: sight range, field of view (all-round once alerted), line of sight -----
    g, _ = function(bp, "Perceive")
    pawn = g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0)
    with g.if_(g.not_(g.valid(pawn))):
        g.s("Sees", False)
        g.s("Reacted", False)
        g.ret()
    g.s("PlayerLoc", g.loc(g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0)))
    me_loc = g.loc()
    g.s("Dist", g.dist(me_loc, g.v("PlayerLoc")))
    to = g.f("Normal", A=g.vsub(g.v("PlayerLoc"), me_loc))
    fov_ok = g.or_(g.ge(g.f("Dot_VectorVector", A=to, B=g.call("Actor.GetActorForwardVector")), g.v("FovCos")),
                   g.igt(g.v("State"), 1))
    tr = g.call("KismetSystemLibrary.LineTraceSingle", Start=g.vadd(me_loc, V((0, 0, 60))), End=g.vadd(g.v("PlayerLoc"), V((0, 0, 40))),
                TraceChannel="TraceTypeQuery1", bTraceComplex=False, DrawDebugType="None", bIgnoreSelf=True,
                ActorsToIgnore=g.arr(g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0)))   # the player's meshes block Visibility
    g.s("Sees", g.and_(g.and_(g.le(g.v("Dist"), g.v("SightRange")), fov_ok), g.not_(tr.o("ReturnValue"))))
    g.s("DbgFov", fov_ok)
    g.s("DbgLos", g.not_(tr.o("ReturnValue")))
    with g.if_(g.v("Sees")) as b:
        g.s("LastSeen", g.now())
        with g.if_(g.lt(g.v("SeenSince"), 0.0)):
            g.s("SeenSince", g.now())
    with g.else_(b):
        g.s("SeenSince", -1.0)
    g.s("Reacted", g.and_(g.v("Sees"), g.ge(g.since("SeenSince"), g.v("ReactionTime"))))

    # ----- BeginPlay -----
    g = event(bp, "ReceiveBeginPlay")
    g.s("Home", g.loc())
    g.s("Health", g.v("MaxHealth"))
    g.say(g.cat("[OV BOT] ", g.v("BotId"), " ", g.v("Tier"), " spawned, hp ", g.str_f(g.v("MaxHealth"))), screen=False)
    g.s("Debug", g.call("KismetSystemLibrary.ParseParam", InString=g.call("KismetSystemLibrary.GetCommandLine"), InParam="ovautotest"))
    g.me("Enter_0")

    # ----- Tick: the state machine -----
    g = event(bp, "ReceiveTick", 1000)
    with g.if_(g.ieq(g.v("State"), 7)):
        g.ret()
    g.me("Perceive")
    with g.if_(g.and_(g.v("Debug"), g.gt(g.now(), g.v("NextDebug")))):      # -ovautotest: perception trace every 2 s
        g.s("NextDebug", g.add(g.now(), 2.0))
        b2s = lambda x: g.call("KismetStringLibrary.Conv_BoolToString", InBool=x)
        g.say(g.cat("[OV BOT] ", g.v("BotId"), " dbg state=", g.str_i(g.v("State")), " dist=", g.str_f(g.v("Dist")),
                    " fov=", b2s(g.v("DbgFov")), " los=", b2s(g.v("DbgLos")), " sees=", b2s(g.v("Sees"))), screen=False)

    def st(k):
        return g.ieq(g.v("State"), k)

    with g.if_(st(0)):                                            # IDLE
        with g.if_(g.v("Reacted")) as b:
            g.me("Enter_2")
        with g.else_(b):
            with g.if_(g.gt(g.since("StateStart"), g.v("IdleTime"))):
                g.me("Enter_1")
        g.ret()
    with g.if_(st(1)):                                            # PATROL
        with g.if_(g.v("Reacted")) as b:
            g.me("Enter_2")
        with g.else_(b):
            spd = g.f("VSize", A=g.call("Actor.GetVelocity"))
            with g.if_(g.or_(g.gt(g.since("StateStart"), 8.0), g.and_(g.gt(g.since("StateStart"), 1.5), g.lt(spd, 5.0)))):
                g.me("Enter_0")
        g.ret()
    with g.if_(st(2)):                                            # CHASE
        ready = g.and_(g.and_(g.v("Sees"), g.le(g.v("Dist"), g.mul(g.v("LashRange"), 0.85))), g.ge(g.now(), g.v("NextAttack")))
        with g.if_(ready) as b:
            g.me("Enter_3")
        with g.else_(b):
            with g.if_(g.gt(g.since("LastSeen"), g.v("LostTime"))) as b2:
                g.me("Enter_1")
            with g.else_(b2):
                with g.if_(g.ge(g.now(), g.v("NextRepath"))):
                    g.call("AIBlueprintHelperLibrary.SimpleMoveToActor", Controller=g.call("Pawn.GetController"),
                           Goal=g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0))
                    g.s("NextRepath", g.add(g.now(), 0.35))
        g.ret()
    with g.if_(st(3)):                                            # WINDUP: face the player, then strike
        yaw = g.f("BreakRotator", InRot=g.f("FindLookAtRotation", Start=g.loc(), Target=g.v("PlayerLoc"))).o("Yaw")
        g.call("Actor.K2_SetActorRotation", NewRotation=g.rot(yaw=yaw), bTeleportPhysics=False)
        with g.if_(g.ge(g.since("StateStart"), g.v("WindupTime"))):
            g.me("Enter_4")
        g.ret()
    with g.if_(st(4)):                                            # ATTACK: lash out, recover
        with g.if_(g.ge(g.since("StateStart"), 0.35)):
            g.me("Enter_2")
        g.ret()
    with g.if_(st(5)):                                            # PAIN
        with g.if_(g.ge(g.since("StateStart"), g.v("PainTime"))):
            g.me("Enter_2")
        g.ret()
    with g.if_(st(6)):                                            # RETREAT
        with g.if_(g.ge(g.since("StateStart"), g.v("RetreatTime"))):
            g.me("Enter_2")

    # ----- damage: pain, shock -> retreat, death -----
    g = event(bp, "ReceiveAnyDamage", 3000)
    dmg = g.ev.o("Damage")
    with g.if_(g.ieq(g.v("State"), 7)):
        g.ret()
    g.s("Health", g.sub(g.v("Health"), dmg))
    with g.if_(g.gt(g.since("RecentStart"), g.v("ShockWindow"))):
        g.s("RecentStart", g.now())
        g.s("RecentDmg", 0.0)
    g.s("RecentDmg", g.add(g.v("RecentDmg"), dmg))
    g.s("LastSeen", g.now())
    g.say(g.cat("[OV BOT] ", g.v("BotId"), " took ", g.str_f(dmg), ", hp ", g.str_f(g.v("Health"))), screen=False)
    with g.if_(g.le(g.v("Health"), 0.0)) as b:
        g.me("Enter_7")
    with g.else_(b):
        with g.if_(g.and_(g.ge(g.v("RecentDmg"), g.v("ShockDamage")), g.ine(g.v("State"), 6))) as b2:
            g.me("Enter_6")
        with g.else_(b2):
            with g.if_(g.ine(g.v("State"), 6)):
                g.me("Enter_5")
    compile_bp(bp)

    # Class defaults: AI possession, capsule, movement that turns toward its path.
    cdo = unreal.get_default_object(unreal.BlueprintEditorLibrary.generated_class(bp))
    cdo.set_editor_property("auto_possess_ai", unreal.AutoPossessAI.PLACED_IN_WORLD_OR_SPAWNED)
    cdo.set_editor_property("ai_controller_class", unreal.AIController.static_class())
    cdo.set_editor_property("use_controller_rotation_yaw", False)
    cap = cdo.get_editor_property("capsule_component")
    cap.set_editor_property("capsule_radius", 40.0)
    cap.set_editor_property("capsule_half_height", 90.0)
    cm = cdo.get_editor_property("character_movement")
    cm.set_editor_property("orient_rotation_to_movement", True)
    cm.set_editor_property("rotation_rate", unreal.Rotator(pitch=0, yaw=540, roll=0))
    cm.set_editor_property("max_walk_speed", float(med["walkSpeed"]))
    EAL.save_loaded_asset(bp)
    return bp


def main():
    t0 = time.time()
    res = {"ok": False, "bot": BOT}
    try:
        with open(DATA, encoding="utf-8") as fh:
            cfg = json.load(fh)
        build(cfg)
        res["ok"] = True
        res["states"] = STATES
        log("built %s" % BOT)
    except Exception as e:
        res["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV BOTS] " + res["error"])
    res["seconds"] = round(time.time() - t0, 1)
    with open(RESULT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    return res


if __name__ != "make_bots":
    main()
