"""Builds the bot test map and places the root bots and the player weapon rig, from unreal/data/bots.json.

  /Game/OmegaValley/Maps/BotArena: 60 x 60 m yard with 3 m walls, cover (crates, a wall stub, a stone block),
  Noor's dusk light (sun bearing 240, elevation 4; build_barn_level.build_lighting), a PlayerStart on the south side
  facing north, a NavMeshBoundsVolume over the yard (the navmesh builds at game start: RuntimeGeneration=Dynamic in
  DefaultEngine.ini), one BP_OV_WeaponRig (tag OV_WEAPON) and the bots (BP_OV_RootBot, tag OV_BOT).
Each bot gets tags OV_BOT, bot:<id>, tier:<Easy|Medium|Hard> and its tier numbers written into the instance.
Idempotent: arena actors carry OV_AUTO (rebuilt like the barn), bots OV_BOT and the rig OV_WEAPON; all are removed
and re-placed on every run. Positions are game metres (x east, y up, z south); only ov_units.py converts. The build
checks one landmark: root_hard_1 at (2, 0, -22) m must stand at (200, -2200, 0) cm.
Run headless (after make_weapons.py and make_bots.py; run_bots.ps1 runs all of them):
  UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\place_bots.py" -unattended -nosplash -nop4
Writes Saved/ov_place_bots_result.json.
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
import ov_units as U  # noqa: E402

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
DATA = ov_paths.data_file(PROJECT_DIR, "bots.json")
BOT_BP = "/Game/OmegaValley/Bots/BP_OV_RootBot"
RIG_BP = "/Game/OmegaValley/Weapons/BP_OV_WeaponRig"
MAT_DIR = "/Game/OmegaValley/Materials"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), "ov_place_bots_result.json")
CAPSULE_HALF_CM = 90.0          # BP_OV_RootBot capsule (make_bots.py)
PLAYER_HALF_CM = 92.0           # same offset build_barn_level uses for the PlayerStart
LANDMARK = ("root_hard_1", (200.0, -2200.0, 0.0))
EAL = unreal.EditorAssetLibrary
TIER_VARS = {"reactionSec": "ReactionTime", "accuracy": "Accuracy", "walkSpeed": "WalkSpeed", "chaseSpeed": "ChaseSpeed",
             "health": "MaxHealth", "windupSec": "WindupTime", "cooldownSec": "Cooldown", "damage": "Damage"}


def log(m):
    unreal.log("[OV PLACE] " + m)


def plan_bot(b):
    """Bot record (game metres) -> feet and actor location (cm), tags. Pure."""
    p = b["pos"]
    feet = U.loc(p["x"], p["y"], p["z"])
    return {"feet": feet, "location": (feet[0], feet[1], feet[2] + CAPSULE_HALF_CM),
            "tags": ["OV_BOT", "bot:" + b["id"], "tier:" + b["tier"]]}


def clear(eas, tag):
    n = 0
    for a in eas.get_all_level_actors():
        if a.actor_has_tag(tag):
            eas.destroy_actor(a)
            n += 1
    return n


def build_arena(B, cfg, mats):
    a = cfg["arena"]
    half, wall_h = a["sizeM"] / 2.0, a["wallM"]
    ground, wood, stone = mats.get("ground"), mats.get("wood"), mats.get("stone")
    B.gbox(-half - 1, -0.5, -half - 1, half + 1, 0.0, half + 1, ground, "Arena_Ground", "Arena")
    t = 0.5
    B.gbox(-half - t, 0, -half - t, half + t, wall_h, -half, stone, "Arena_Wall_N", "Arena")
    B.gbox(-half - t, 0, half, half + t, wall_h, half + t, stone, "Arena_Wall_S", "Arena")
    B.gbox(-half - t, 0, -half, -half, wall_h, half, stone, "Arena_Wall_W", "Arena")
    B.gbox(half, 0, -half, half + t, wall_h, half, stone, "Arena_Wall_E", "Arena")
    # cover: crates, a barn-board wall stub, a stone block (game metres: x0, y0, z0, x1, y1, z1)
    cover = [(-7, 0, 12, -5.8, 1.2, 13.2, wood), (5, 0, 4, 6.2, 1.2, 5.2, wood), (5.6, 1.2, 4.3, 6.4, 2.0, 5.1, wood),
             (-12, 0, -2, -6, 2.2, -1.6, wood), (10, 0, -16, 13, 1.6, -13, stone), (-3, 0, -12, -1.8, 1.2, -10.8, wood),
             (14, 0, 6, 14.4, 2.2, 12, wood), (-18, 0, 10, -15, 1.0, 13, stone)]
    for i, (x0, y0, z0, x1, y1, z1, m) in enumerate(cover):
        B.gbox(x0, y0, z0, x1, y1, z1, m, "Arena_Cover_%02d" % i, "Arena")
    # navmesh bounds over the yard (brush is a 200 cm cube)
    nav = B.spawn(unreal.NavMeshBoundsVolume, (0, 0, 150), None, "Arena_NavBounds", "Arena")
    nav.set_actor_scale3d(unreal.Vector(half + 1, half + 1, 4))
    # The navmesh actor itself, saved with the map: without it the -game run had no RecastNavMesh and no movement.
    nm = B.spawn(unreal.RecastNavMesh, (0, 0, 0), None, "Arena_RecastNavMesh", "Arena")
    nm.set_editor_property("runtime_generation", unreal.RuntimeGenerationType.DYNAMIC)
    ps = a["playerStart"]
    B.spawn(unreal.PlayerStart, (ps["x"] * 100, ps["z"] * 100, ps["y"] * 100 + PLAYER_HALF_CM),
            B.rot(yaw=U.bearing_to_yaw(ps["bearing"])), "PlayerStart_Arena", "Gameplay")
    return nav


def main():
    t0 = time.time()
    res = {"ok": False, "data": DATA}
    try:
        for line in U.self_test():
            log("units: " + line)
        with open(DATA, encoding="utf-8") as fh:
            cfg = json.load(fh)
        assert 3 <= len(cfg["bots"]) <= 5, "expected 3 to 5 bots"
        import build_barn_level as B
        import ov_materials
        for p, mod in ((RIG_BP, "make_weapons"), (BOT_BP, "make_bots")):
            if not EAL.does_asset_exist(p):
                log("%s missing: running %s.py" % (p, mod))
                assert __import__(mod).main()["ok"], "%s failed" % mod
        res["map"] = cfg["arena"]["map"]
        B.open_or_create_level(cfg["arena"]["map"])
        eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        res["removed"] = {t: clear(eas, t) for t in ("OV_AUTO", "OV_BOT", "OV_WEAPON")}
        mats = {}
        for k in ("ground", "wood", "stone"):
            mats[k] = EAL.load_asset("%s/MI_OV_%s" % (MAT_DIR, k))
        if not all(mats.values()):
            mats, _, _ = ov_materials.ensure_materials(B.SKY_INTENSITY)
        build_arena(B, cfg, mats)
        B.build_lighting({"lighting": {"sun": {"bearing": 240.0, "elevation": 4.0}}}, EAL.load_asset(MAT_DIR + "/MI_OV_Sky"))
        # the weapon rig (attaches itself to the player camera at play time)
        rig_cls = unreal.BlueprintEditorLibrary.generated_class(EAL.load_asset(RIG_BP))
        ps = cfg["arena"]["playerStart"]
        rig = eas.spawn_actor_from_class(rig_cls, unreal.Vector(ps["x"] * 100, ps["z"] * 100, 170.0))
        rig.set_actor_label("OV_WeaponRig")
        rig.set_folder_path("Gameplay")
        rig.set_editor_property("tags", [unreal.Name("OV_WEAPON")])
        # the bots
        bot_cls = unreal.BlueprintEditorLibrary.generated_class(EAL.load_asset(BOT_BP))
        placed = {}
        for b in cfg["bots"]:
            plan = plan_bot(b)
            tier = cfg["tiers"][b["tier"]]
            yaw = U.bearing_to_yaw(180.0)                 # face south, toward the player start
            a = eas.spawn_actor_from_class(bot_cls, unreal.Vector(*plan["location"]), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
            assert a, "could not spawn %s" % b["id"]
            a.set_actor_label(b["id"])
            a.set_folder_path("Bots")
            a.set_editor_property("tags", [unreal.Name(t) for t in plan["tags"]])
            for key, name in TIER_VARS.items():
                a.set_editor_property(name, float(tier[key]))
            a.set_editor_property("BotId", b["id"])
            a.set_editor_property("Tier", b["tier"])
            placed[b["id"]] = (a, plan)
        # landmark: the actor stands where ov_units says
        bid, exp = LANDMARK
        a, plan = placed[bid]
        l = a.get_actor_location()
        feet = (l.x, l.y, l.z - CAPSULE_HALF_CM)
        err = max(abs(feet[i] - exp[i]) for i in range(3))
        assert err < 1.0, "landmark %s: feet %s cm, expected %s" % (bid, feet, exp)
        res["landmark"] = {"id": bid, "feetCm": [round(c, 1) for c in feet], "expectedCm": list(exp), "errCm": round(err, 3)}
        res["hp"] = {bid2: a2.get_editor_property("MaxHealth") for bid2, (a2, _) in placed.items()}
        B.save_all()
        res.update(ok=True, bots=len(placed), tiers={b["id"]: b["tier"] for b in cfg["bots"]})
        log("placed %d bots + rig in %s; landmark %s err %.3f cm" % (len(placed), res["map"], bid, err))
    except Exception as e:
        res["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV PLACE] " + res["error"])
    res["seconds"] = round(time.time() - t0, 1)
    with open(RESULT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    return res


if __name__ != "place_bots":
    main()
