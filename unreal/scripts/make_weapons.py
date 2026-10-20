"""Builds the player weapon rig from unreal/data/weapons.json (hitscan, our own designs on CC0 Quaternius meshes).

  /Game/OmegaValley/Weapons/BP_OV_WeaponRig    Actor that attaches itself to the player camera at BeginPlay/Tick:
      viewmodel mesh, muzzle flash (emissive sphere + point light), crosshair dot, and the logic:
      1/2/3 switch weapon, LMB fire (auto or semi), R reload (auto reload on empty), spread cone, pellets,
      recoil kick (view pitch + random yaw, viewmodel kick), ammo per weapon, impact decal + Niagara burst,
      player health (the root bots lower PlayerHP), respawn at the spawn point at 0 HP.
  /Game/OmegaValley/Weapons/M_OV_BulletHole, MI_OV_MuzzleFlash, MI_OV_Crosshair, MI_OV_Root*  (engine-only materials)
Impact particles: the engine's Niagara template /Niagara/DefaultAssets/Templates/Systems/SimpleExplosion, scaled down.
Weapon numbers are baked into the Equip_<n> functions from the JSON: edit weapons.json and re-run (about 10 s of script).
Test hook: launch the game with -ovautotest and the rig aims at the nearest OV_BOT, fires, cycles the weapons every
6 s, takes two screenshots and quits with a "[OV TEST]" summary line (shots, hits, kills, fps) in the log.

Run headless: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\make_weapons.py" -unattended -nosplash
Needs import_guns.py first (it runs it when the meshes are missing). Idempotent: the Blueprint is emptied and rebuilt.
"""
import json
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
DATA = ov_paths.data_file(PROJECT_DIR, "weapons.json")
DIR = "/Game/OmegaValley/Weapons"
RIG = DIR + "/BP_OV_WeaponRig"
RIG_CLASS = RIG + ".BP_OV_WeaponRig_C"
MESHES = DIR + "/Meshes"
NIAGARA_IMPACT = "/Niagara/DefaultAssets/Templates/Systems/SimpleExplosion.SimpleExplosion"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), "ov_weapons_result.json")
EAL = unreal.EditorAssetLibrary
MEL = unreal.MaterialEditingLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
TEST_SECS = 45.0


def log(m):
    unreal.log("[OV WEAPONS] " + m)


def srgb(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


# ---------- materials (engine expressions only) ----------
def _mi(name, color_hex=None, emissive=(0, 0, 0), rough=0.85):
    base = EAL.load_asset("/Game/OmegaValley/Materials/M_OV_Base")
    if base is None:
        import ov_materials
        base = ov_materials.build_base()
    path = "%s/%s" % (DIR, name)
    mi = EAL.load_asset(path) if EAL.does_asset_exist(path) else \
        AT.create_asset(name, DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, base)
    if color_hex:
        c = srgb(color_hex)
        MEL.set_material_instance_vector_parameter_value(mi, "Color", unreal.LinearColor(c[0], c[1], c[2], 1.0))
    MEL.set_material_instance_vector_parameter_value(mi, "Emissive", unreal.LinearColor(emissive[0], emissive[1], emissive[2], 1.0))
    MEL.set_material_instance_scalar_parameter_value(mi, "Roughness", rough)
    MEL.update_material_instance(mi)
    EAL.save_loaded_asset(mi)
    return mi


def bullet_hole():
    path = DIR + "/M_OV_BulletHole"
    if EAL.does_asset_exist(path):
        m = EAL.load_asset(path)
        MEL.delete_all_material_expressions(m)
    else:
        m = AT.create_asset("M_OV_BulletHole", DIR, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property("material_domain", unreal.MaterialDomain.MD_DEFERRED_DECAL)
    m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
    uv = MEL.create_material_expression(m, unreal.MaterialExpressionTextureCoordinate, -600, 0)
    centre = MEL.create_material_expression(m, unreal.MaterialExpressionConstant2Vector, -600, 150)
    centre.set_editor_property("r", 0.5)
    centre.set_editor_property("g", 0.5)
    mask = MEL.create_material_expression(m, unreal.MaterialExpressionSphereMask, -350, 50)
    mask.set_editor_property("attenuation_radius", 0.5)
    mask.set_editor_property("hardness_percent", 55.0)
    MEL.connect_material_expressions(uv, "", mask, "A")
    MEL.connect_material_expressions(centre, "", mask, "B")
    col = MEL.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -350, -150)
    col.set_editor_property("constant", unreal.LinearColor(0.012, 0.010, 0.008, 1.0))
    MEL.connect_material_property(col, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(mask, "", unreal.MaterialProperty.MP_OPACITY)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


def ensure_materials():
    return {
        "decal": bullet_hole(),
        "flash": _mi("MI_OV_MuzzleFlash", "#FFC37A", (60.0, 26.0, 6.0), 0.5),
        "cross": _mi("MI_OV_Crosshair", "#FFFFFF", (1.5, 1.5, 1.5), 0.5),
        "bark": _mi("MI_OV_RootBark", "#3A2D24", (0, 0, 0), 0.9),       # palette woodDark
        "pale": _mi("MI_OV_RootPale", "#6A5446", (0, 0, 0), 0.85),      # palette wood
        "tell": _mi("MI_OV_RootTell", "#FFB46B", (9.0, 3.6, 0.7), 0.5),  # amber glow: the attack tell
    }


# ---------- viewmodel placement ----------
def mesh_fit(w):
    """Uniform scale and camera-space offsets from the imported mesh bounds (long axis X, muzzle at +X)."""
    path = "%s/%s/%s" % (MESHES, w["mesh"], w["mesh"])
    sm = EAL.load_asset(path)
    if sm is None:
        import import_guns
        import_guns.main()
        sm = EAL.load_asset(path)
    assert sm, "mesh %s missing" % path
    b = sm.get_bounding_box()
    s = w["viewLengthCm"] / max(1e-3, b.max.x - b.min.x)
    fx, fy, fz = w["viewOffsetCm"]
    base = (fx - b.min.x * s, fy, fz)                                   # the gun's back end sits fx cm ahead of the eye
    muzzle = (base[0] + b.max.x * s + 2.0, fy, fz + (b.min.z + 0.8 * (b.max.z - b.min.z)) * s)
    return path, s, base, muzzle


# ---------- the rig Blueprint ----------
def build_rig(cfg, mats):
    W, fx = cfg["weapons"], cfg["fx"]
    assert len(W) == 3, "the rig binds keys for exactly 3 weapons"
    bp = new_bp(RIG, unreal.Actor)
    vm = add_component(bp, unreal.StaticMeshComponent, "Viewmodel")
    flash = add_component(bp, unreal.StaticMeshComponent, "FlashMesh")
    light = add_component(bp, unreal.PointLightComponent, "FlashLight")
    cross = add_component(bp, unreal.StaticMeshComponent, "Crosshair")
    sphere = EAL.load_asset("/Engine/BasicShapes/Sphere.Sphere")
    for c in (vm, flash, cross):
        c.set_collision_profile_name("NoCollision")
        c.set_editor_property("cast_shadow", False)
        c.set_editor_property("generate_overlap_events", False)
    flash.set_editor_property("static_mesh", sphere)
    flash.set_material(0, mats["flash"])
    flash.set_editor_property("relative_scale3d", unreal.Vector(0.07, 0.07, 0.07))
    flash.set_editor_property("visible", False)
    cross.set_editor_property("static_mesh", sphere)
    cross.set_material(0, mats["cross"])
    cross.set_editor_property("relative_location", unreal.Vector(60.0, 0.0, 0.0))
    cross.set_editor_property("relative_scale3d", unreal.Vector(0.0035, 0.0035, 0.0035))
    light.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
    light.set_editor_property("intensity", 0.0)
    light.set_editor_property("light_color", unreal.Color(r=255, g=190, b=120, a=255))
    light.set_editor_property("attenuation_radius", 450.0)
    light.set_editor_property("cast_shadows", False)

    fit = [mesh_fit(w) for w in W]
    w0 = W[0]
    for name, kind, d in [
        ("Pawn", "obj:/Script/Engine.Pawn", None), ("PC", "obj:/Script/Engine.PlayerController", None),
        ("Attached", "bool", False), ("SpawnLoc", "vector", V((0, 0, 0))),
        ("Weapon", "int", -1), ("EquipWanted", "int", 0), ("WeaponName", "string", w0["name"]), ("Auto", "bool", w0["auto"]),
        ("FireInterval", "real", 1.0 / w0["ratePerSec"]), ("Damage", "real", float(w0["damage"])),
        ("Pellets", "int", w0["pellets"]), ("Spread", "real", float(w0["spreadDeg"])),
        ("RecoilPitch", "real", float(w0["recoilPitchDeg"])), ("RecoilYaw", "real", float(w0["recoilYawDeg"])),
        ("MagSize", "int", w0["magazine"]), ("ReloadTime", "real", float(w0["reloadSec"])),
        ("Range", "real", w0["rangeM"] * 100.0), ("Kick", "real", float(w0["kickCm"])), ("KickNow", "real", 0.0),
        ("BaseLoc", "vector", V(fit[0][2])), ("Ammo", "int", w0["magazine"]),
        ("Ammo0", "int", W[0]["magazine"]), ("Ammo1", "int", W[1]["magazine"]), ("Ammo2", "int", W[2]["magazine"]),
        ("Reloading", "bool", False), ("ReloadEnd", "real", 0.0), ("NextFire", "real", 0.0), ("FlashEnd", "real", 0.0),
        ("PlayerHP", "real", float(fx["playerHp"])), ("HurtEnd", "real", 0.0), ("Deaths", "int", 0),
        ("AutoTest", "bool", False), ("WantAuto", "bool", False), ("TestStart", "real", 0.0), ("Shot", "int", 0),
        ("Shots", "int", 0), ("Hits", "int", 0), ("Kills", "int", 0), ("Frames", "int", 0), ("FpsStart", "real", -1.0),
        ("Decal", "obj:/Script/Engine.MaterialInterface", mats["decal"].get_path_name()),
        ("ImpactFX", "obj:/Script/Niagara.NiagaraSystem", NIAGARA_IMPACT),
    ]:
        var(bp, name, kind, d)
    pass  # no mid-build compile (see ov_bp.Graph.me)

    # ----- Equip_<i>: stash the old magazine, load this weapon's numbers and mesh -----
    for i, (w, (mesh, s, base, muzzle)) in enumerate(zip(W, fit)):
        g, _ = function(bp, "Equip_%d" % i)
        for j in range(3):
            with g.if_(g.ieq(g.v("Weapon"), j)):
                g.s("Ammo%d" % j, g.v("Ammo"))
        for k, val in [("Weapon", i), ("WeaponName", w["name"]), ("Auto", bool(w["auto"])),
                       ("FireInterval", 1.0 / w["ratePerSec"]), ("Damage", float(w["damage"])), ("Pellets", int(w["pellets"])),
                       ("Spread", float(w["spreadDeg"])), ("RecoilPitch", float(w["recoilPitchDeg"])),
                       ("RecoilYaw", float(w["recoilYawDeg"])), ("MagSize", int(w["magazine"])),
                       ("ReloadTime", float(w["reloadSec"])), ("Range", w["rangeM"] * 100.0), ("Kick", float(w["kickCm"])),
                       ("BaseLoc", V(base)), ("Reloading", False)]:
            g.s(k, val)
        g.s("Ammo", g.v("Ammo%d" % i))
        g.call("StaticMeshComponent.SetStaticMesh", target=g.v("Viewmodel"), NewMesh=mesh + "." + mesh.split("/")[-1])
        g.call("SceneComponent.SetRelativeScale3D", target=g.v("Viewmodel"), NewScale3D=V((s, s, s)))
        g.call("SceneComponent.K2_SetRelativeLocationAndRotation", target=g.v("Viewmodel"), NewLocation=V(base),
               NewRotation=R((0, 0, 0)), bSweep=False, bTeleport=True)
        for comp in ("FlashMesh", "FlashLight"):
            g.call("SceneComponent.K2_SetRelativeLocation", target=g.v(comp), NewLocation=V(muzzle), bSweep=False, bTeleport=True)
        g.s("NextFire", g.add(g.now(), 0.25))
        g.say("[OV RIG] equipped " + w["name"], secs=1.5, color=(0.9, 0.8, 0.5))
    pass  # no mid-build compile (see ov_bp.Graph.me)

    log("stage: EquipIndex")
    g, _ = function(bp, "EquipIndex")     # parameter via a member variable: function inputs crashed 5.8.3
    for i in range(3):
        with g.if_(g.and_(g.ieq(g.v("EquipWanted"), i), g.ine(g.v("Weapon"), i))):
            g.me("Equip_%d" % i)

    log("stage: StartReload")
    # ----- StartReload -----
    g, _ = function(bp, "StartReload")
    with g.if_(g.and_(g.not_(g.v("Reloading")), g.ilt(g.v("Ammo"), g.v("MagSize")))):
        g.s("Reloading", True)
        g.s("ReloadEnd", g.add(g.now(), g.v("ReloadTime")))
        g.call("SceneComponent.K2_SetRelativeRotation", target=g.v("Viewmodel"), NewRotation=R((-35, 0, 25)), bSweep=False, bTeleport=True)
        g.say(g.cat("[OV RIG] reloading ", g.v("WeaponName")), secs=1.0, color=(0.7, 0.7, 0.7))

    log("stage: Fire")
    # ----- Fire: pellets x hitscan trace in a spread cone -----
    g, _ = function(bp, "Fire")
    g.s("NextFire", g.add(g.now(), g.v("FireInterval")))
    g.s("Ammo", g.isub(g.v("Ammo"), 1))
    g.inc("Shots")
    with g.for_(1, g.v("Pellets")):
        origin = g.loc()
        fwd = g.call("Actor.GetActorForwardVector")
        dirv = g.f("RandomUnitVectorInConeInDegrees", ConeDir=fwd, ConeHalfAngleInDegrees=g.v("Spread"))
        tr = g.call("KismetSystemLibrary.LineTraceSingle", Start=g.vadd(origin, g.vmul(fwd, 30.0)),
                    End=g.vadd(origin, g.vmul(dirv, g.v("Range"))), TraceChannel="TraceTypeQuery1",
                    bTraceComplex=False, DrawDebugType="None", bIgnoreSelf=True, ActorsToIgnore=g.arr(g.v("Pawn")))
        with g.if_(tr.o("ReturnValue")):
            hit = g.call("GameplayStatics.BreakHitResult", Hit=tr.o("OutHit"))
            with g.if_(g.call("Actor.ActorHasTag", target=hit.o("HitActor"), Tag="OV_BOT")) as b:
                g.call("GameplayStatics.ApplyDamage", DamagedActor=hit.o("HitActor"), BaseDamage=g.v("Damage"),
                       EventInstigator=g.v("PC"))
                g.inc("Hits")
            with g.else_(b):
                g.call("GameplayStatics.SpawnDecalAtLocation", DecalMaterial=g.v("Decal"),
                       DecalSize=V((2.0, fx["decalSizeCm"], fx["decalSizeCm"])), Location=hit.o("ImpactPoint"),
                       Rotation=g.f("MakeRotFromX", X=g.vmul(hit.o("ImpactNormal"), -1.0)), LifeSpan=float(fx["decalLifeSec"]))
            sc = float(fx["impactScale"])
            g.call("NiagaraFunctionLibrary.SpawnSystemAtLocation", SystemTemplate=g.v("ImpactFX"), Location=hit.o("ImpactPoint"),
                   Rotation=g.f("MakeRotFromX", X=hit.o("ImpactNormal")), Scale=V((sc, sc, sc)), bAutoDestroy=True)
    # muzzle flash, recoil (view + viewmodel)
    g.call("LightComponent.SetIntensity", target=g.v("FlashLight"), NewIntensity=float(fx["flashCandela"]))
    g.call("SceneComponent.SetVisibility", target=g.v("FlashMesh"), bNewVisibility=True, bPropagateToChildren=False)
    g.s("FlashEnd", g.add(g.now(), float(fx["flashSec"])))
    cr = g.f("BreakRotator", InRot=g.call("Controller.GetControlRotation", target=g.v("PC")))
    ry = g.f("RandomFloatInRange", Min=g.mul(g.v("RecoilYaw"), -1.0), Max=g.v("RecoilYaw"))
    g.call("Controller.SetControlRotation", target=g.v("PC"),
           NewRotation=g.rot(pitch=g.add(cr.o("Pitch"), g.v("RecoilPitch")), yaw=g.add(cr.o("Yaw"), ry)))
    g.s("KickNow", g.v("Kick"))
    pass  # no mid-build compile (see ov_bp.Graph.me)

    log("stage: Tick")
    # ----- Tick -----
    g = event(bp, "ReceiveTick")
    dt = g.ev.o("DeltaSeconds")
    with g.if_(g.not_(g.v("Attached"))):
        with g.if_(g.valid(g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0))):
            g.s("Pawn", g.call("GameplayStatics.GetPlayerPawn", PlayerIndex=0))
            g.s("PC", g.call("GameplayStatics.GetPlayerController", PlayerIndex=0))
            cam = g.call("Actor.GetComponentByClass", target=g.v("Pawn"), ComponentClass="/Script/Engine.CameraComponent")
            g.call("Actor.K2_AttachToComponent", Parent=cam, LocationRule="SnapToTarget", RotationRule="SnapToTarget",
                   ScaleRule="KeepWorld", bWeldSimulatedBodies=False)
            g.s("SpawnLoc", g.loc(g.v("Pawn")))
            g.s("Attached", True)
            g.me("Equip_0")
            g.s("AutoTest", g.call("KismetSystemLibrary.ParseParam", InString=g.call("KismetSystemLibrary.GetCommandLine"),
                                   InParam="ovautotest"))
            g.s("TestStart", g.now())
            g.say("[OV RIG] ready: 1/2/3 weapons, LMB fire, R reload", secs=5.0, color=(0.9, 0.8, 0.5))
        g.ret()
    g.inc("Frames")
    for i, w in enumerate(W):
        with g.if_(g.call("PlayerController.WasInputKeyJustPressed", target=g.v("PC"), Key=w["key"])):
            g.me("Equip_%d" % i)
    # autotest: aim at the nearest bot, cycle weapons, screenshots, summary, quit
    g.s("WantAuto", False)
    with g.if_(g.v("AutoTest")):
        t = g.since("TestStart")
        with g.if_(g.and_(g.gt(g.since("TestStart"), 3.0), g.lt(g.v("FpsStart"), 0.0))):
            g.s("FpsStart", g.now())
            g.s("Frames", 0)
        g.s("EquipWanted", g.f("Percent_IntInt", A=g.trunc(g.div(g.since("TestStart"), 6.0)), B=3))
        g.me("EquipIndex")
        bots = g.call("GameplayStatics.GetAllActorsWithTag", Tag="OV_BOT")
        near = g.call("GameplayStatics.FindNearestActor", Origin=g.loc(), ActorsToCheck=bots.o("OutActors"))
        with g.if_(g.valid(near.o("ReturnValue"))) as hasbot:
            look = g.f("FindLookAtRotation", Start=g.loc(), Target=g.vadd(g.loc(near.o("ReturnValue")), V((0, 0, 20))))
            g.call("Controller.SetControlRotation", target=g.v("PC"), NewRotation=look)
            g.s("WantAuto", g.gt(g.since("TestStart"), 3.0))
        for k, at in enumerate((6.0, 14.0)):
            with g.if_(g.and_(g.ieq(g.v("Shot"), k), g.gt(g.since("TestStart"), at))):
                g.call("KismetSystemLibrary.ExecuteConsoleCommand", Command="HighResShot 1", SpecificPlayer=g.v("PC"))
                g.say("[OV TEST] screenshot %d" % (k + 1), screen=False)
                g.inc("Shot")
        done = g.or_(g.gt(g.since("TestStart"), TEST_SECS), g.and_(g.not_(g.valid(near.o("ReturnValue"))), g.gt(g.since("TestStart"), 8.0)))
        with g.if_(g.and_(done, g.igt(g.v("Shot"), 0))):
            fps = g.div(g.f("Conv_IntToDouble", InInt=g.v("Frames")), g.f("FMax", A=g.since("FpsStart"), B=0.001))
            g.say(g.cat("[OV TEST] seconds=", g.str_f(g.since("TestStart")), " fps=", g.str_f(fps),
                        " shots=", g.str_i(g.v("Shots")), " hits=", g.str_i(g.v("Hits")), " kills=", g.str_i(g.v("Kills")),
                        " playerDeaths=", g.str_i(g.v("Deaths")), " hp=", g.str_f(g.v("PlayerHP"))), secs=5.0)
            g.call("KismetSystemLibrary.QuitGame", SpecificPlayer=g.v("PC"), QuitPreference="Quit", bIgnorePlatformRestrictions=True)
    # reload
    with g.if_(g.or_(g.call("PlayerController.WasInputKeyJustPressed", target=g.v("PC"), Key="R"),
                     g.and_(g.ile(g.v("Ammo"), 0), g.not_(g.v("Reloading"))))):
        g.me("StartReload")
    with g.if_(g.and_(g.v("Reloading"), g.ge(g.now(), g.v("ReloadEnd")))):
        g.s("Reloading", False)
        g.s("Ammo", g.v("MagSize"))
        g.say(g.cat("[OV RIG] ", g.v("WeaponName"), " ready"), secs=0.8, color=(0.7, 0.7, 0.7))
    # fire
    pc = g.v("PC")
    manual = g.or_(g.and_(g.v("Auto"), g.call("PlayerController.IsInputKeyDown", target=pc, Key="LeftMouseButton")),
                   g.call("PlayerController.WasInputKeyJustPressed", target=pc, Key="LeftMouseButton"))
    can = g.and_(g.and_(g.not_(g.v("Reloading")), g.igt(g.v("Ammo"), 0)), g.ge(g.now(), g.v("NextFire")))
    with g.if_(g.and_(g.or_(manual, g.v("WantAuto")), can)):
        g.me("Fire")
    # flash off, viewmodel kick recovery
    with g.if_(g.gt(g.now(), g.v("FlashEnd"))):
        g.call("LightComponent.SetIntensity", target=g.v("FlashLight"), NewIntensity=0.0)
        g.call("SceneComponent.SetVisibility", target=g.v("FlashMesh"), bNewVisibility=False, bPropagateToChildren=False)
    g.s("KickNow", g.f("FInterpTo", Current=g.v("KickNow"), Target=0.0, DeltaTime=dt, InterpSpeed=12.0))
    with g.if_(g.not_(g.v("Reloading"))):
        g.call("SceneComponent.K2_SetRelativeLocationAndRotation", target=g.v("Viewmodel"),
               NewLocation=g.vadd(g.v("BaseLoc"), g.vec(x=g.mul(g.v("KickNow"), -1.0))),
               NewRotation=g.rot(pitch=g.mul(g.v("KickNow"), 1.5)), bSweep=False, bTeleport=True)
    # player health (lowered by the bots)
    with g.if_(g.le(g.v("PlayerHP"), 0.0)):
        g.say("[OV RIG] the roots took you: respawn", secs=3.0, color=(1.0, 0.3, 0.2))
        g.inc("Deaths")
        g.s("PlayerHP", float(fx["playerHp"]))
        g.call("Actor.K2_SetActorLocation", target=g.v("Pawn"), NewLocation=g.v("SpawnLoc"), bSweep=False, bTeleport=True)
    with g.if_(g.lt(g.now(), g.v("HurtEnd"))):
        g.say("HIT", log=False, secs=0.1, color=(1.0, 0.15, 0.1), key="OVHURT")
    hud = g.cat("HP ", g.str_i(g.trunc(g.v("PlayerHP"))), "    ", g.v("WeaponName"), "  ", g.str_i(g.v("Ammo")), " / ",
                g.str_i(g.v("MagSize")))
    g.say(hud, log=False, secs=0.2, color=(0.85, 0.85, 0.8), key="OVHUD")
    compile_bp(bp)
    return bp, fit


def main():
    t0 = time.time()
    res = {"ok": False, "rig": RIG}
    try:
        with open(DATA, encoding="utf-8") as fh:
            cfg = json.load(fh)
        mats = ensure_materials()
        bp, fit = build_rig(cfg, mats)
        res["weapons"] = [{"id": w["id"], "mesh": f[0], "scale": round(f[1], 4), "baseCm": [round(c, 1) for c in f[2]],
                           "muzzleCm": [round(c, 1) for c in f[3]]} for w, f in zip(cfg["weapons"], fit)]
        res["ok"] = True
        log("built %s: %s" % (RIG, ", ".join(w["name"] for w in cfg["weapons"])))
    except Exception as e:
        res["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV WEAPONS] " + res["error"])
    res["seconds"] = round(time.time() - t0, 1)
    with open(RESULT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    return res


if __name__ != "make_weapons":
    main()
