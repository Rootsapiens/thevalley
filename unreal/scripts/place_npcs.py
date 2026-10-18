"""Places the village NPCs in /Game/OmegaValley/Maps/BarnSlice from unreal/data/village-npcs.json
(exported by scripts/export-npcs.ts from src/npcData.ts).

Run headless (what run_npcs.ps1 does):
  UnrealEditor-Cmd.exe <repo>\\unreal\\OmegaValley\\OmegaValley.uproject -run=pythonscript
      -script="<repo>\\unreal\\scripts\\place_npcs.py" -unattended -nosplash -nop4
Or inside the editor: Tools > Execute Python Script... > this file.

One placeholder actor per NPC: an engine BasicShapes Cylinder scaled to 50 x 50 x 180 cm (the project references no
mannequin, and BasicShapes has no capsule), standing on its floor point. Actor label = NPC id, outliner folder "NPCs".
Tags: OV_NPC, npc:<id>, spawnDay:<n>, cuffed:<true|false>, floorKnown:<true|false>, and floor_to_confirm when the
floor height is not decided. Those NPCs are NOT placed at a guessed height: their floor is game y = 0 (UE Z = 0).

Re-runnable: every actor tagged OV_NPC is deleted before placing, so a re-run replaces the NPCs instead of duplicating
them. NPC actors do not carry OV_AUTO, so a barn rebuild (build_barn_level.py) leaves them alone.
If BarnSlice does not exist yet, build_barn_level.main() builds it first.
Units: only ov_units.py converts (game metres, y up -> UE cm, Z up). The pure part (plan_npc, check_data) has no
`unreal` dependency and is tested by test_place_npcs.py.
Writes Saved/ov_npcs_result.json (count, ids, floor_to_confirm list, sample check, seconds) for run_npcs.ps1.
"""
import json
import os
import sys
import time
import traceback

try:
    import unreal
except ImportError:   # plain Python (tests): only the pure functions below are used
    unreal = None

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:   # some exec modes do not set __file__
    HERE = None
if unreal is not None:
    PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
    REPO = os.path.normpath(os.path.join(PROJECT_DIR, "..", ".."))
else:
    REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
SCRIPTS = HERE or os.path.join(REPO, "unreal", "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)
import ov_units as U  # noqa: E402

DATA = os.environ.get("OV_NPC_DATA") or os.path.join(REPO, "unreal", "data", "village-npcs.json")
MAP = "/Game/OmegaValley/Maps/BarnSlice"   # same level as build_barn_level.py
TAG = "OV_NPC"
FOLDER = "NPCs"
EXPECTED_COUNT = 15
BODY_CM = (50.0, 50.0, 180.0)              # placeholder body: diameter x diameter x height
MESH_PATH = "/Engine/BasicShapes/Cylinder.Cylinder"   # 100 cm, pivot at the centre


# ---------- Pure part (no unreal) ----------
def _b(v):
    return "true" if v else "false"


def plan_npc(npc):
    """NPC record (game space) -> dict with UE label, location (cm, actor pivot), rotation yaw (deg), scale and tags."""
    p = npc["position"]
    floor_y = p["y"] if npc["floorKnown"] else 0.0       # no guessed heights: unknown floors sit at game y = 0
    feet = U.loc(p["x"], floor_y, p["z"])
    centre = (feet[0], feet[1], feet[2] + BODY_CM[2] / 2.0)
    yaw = U.bearing_to_yaw(U.game_yaw_to_bearing(npc["yaw"]))
    tags = [TAG, "npc:" + npc["id"], "spawnDay:%d" % npc["spawnDay"], "cuffed:" + _b(npc["cuffed"]),
            "floorKnown:" + _b(npc["floorKnown"])]
    if not npc["floorKnown"]:
        tags.append("floor_to_confirm")
    return {"label": npc["id"], "feet": feet, "location": centre, "yaw": yaw,
            "scale": (BODY_CM[0] / 100.0, BODY_CM[1] / 100.0, BODY_CM[2] / 100.0), "tags": tags}


def check_data(d):
    """Raises AssertionError if the JSON is not what place_npcs expects. Returns check lines."""
    npcs = d["npcs"]
    ids = [n["id"] for n in npcs]
    assert len(npcs) == EXPECTED_COUNT, "expected %d NPCs, got %d" % (EXPECTED_COUNT, len(npcs))
    assert len(set(ids)) == len(ids), "duplicate NPC ids"
    s = d["checks"]["sample"]
    npc = next(n for n in npcs if n["id"] == s["id"])
    feet = plan_npc(npc)["feet"] if npc["floorKnown"] else U.loc_v(s["game"])
    assert U._close(feet, (s["ueCm"]["x"], s["ueCm"]["y"], s["ueCm"]["z"])), (feet, s["ueCm"])
    return ["%d NPCs, unique ids" % len(npcs),
            "%s (%.2f, %.2f, %.2f) m -> (%.0f, %.0f, %.0f) cm, JS and Python agree" % (
                s["id"], s["game"]["x"], s["game"]["y"], s["game"]["z"], feet[0], feet[1], feet[2])]


# ---------- Editor part ----------
def log(msg):
    unreal.log("[OV NPC] " + msg)


def clear_npcs(eas):
    n = 0
    for a in eas.get_all_level_actors():
        if a.actor_has_tag(TAG):
            eas.destroy_actor(a)
            n += 1
    if n:
        log("removed %d NPC actors from the previous run" % n)
    return n


def spawn_npc(eas, body, plan):
    a = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*plan["location"]),
                                   unreal.Rotator(roll=0.0, pitch=0.0, yaw=plan["yaw"]))
    a.set_actor_label(plan["label"])
    a.set_folder_path(FOLDER)
    a.set_editor_property("tags", [unreal.Name(t) for t in plan["tags"]])
    smc = a.static_mesh_component
    smc.set_static_mesh(body)
    smc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    a.set_actor_scale3d(unreal.Vector(*plan["scale"]))
    return a


def main():
    t0 = time.time()
    result_path = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())),
                               "ov_npcs_result.json")
    result = {"ok": False, "map": MAP, "data": DATA}
    try:
        for line in U.self_test():
            log("units: " + line)
        with open(DATA, encoding="utf-8") as fh:
            d = json.load(fh)
        for line in check_data(d):
            log("data: " + line)
        import build_barn_level as B      # reuses its level helpers; importing it does not rebuild
        if not unreal.EditorAssetLibrary.does_asset_exist(MAP):
            log("%s missing: building it first with build_barn_level.py" % MAP)
            if not B.main().get("ok"):
                raise RuntimeError("build_barn_level failed; see Saved/ov_build_result.json")
        B.open_or_create_level(MAP)
        eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        removed = clear_npcs(eas)
        body = unreal.EditorAssetLibrary.load_asset(MESH_PATH)
        placed = {}
        for npc in d["npcs"]:
            plan = plan_npc(npc)
            placed[npc["id"]] = (spawn_npc(eas, body, plan), plan)
        # Self-check on the sample NPC: the actor sits where ov_units says.
        s = d["checks"]["sample"]
        a, plan = placed[s["id"]]
        l = a.get_actor_location()
        exp = plan["location"]
        sample_ok = abs(l.x - exp[0]) < 1.0 and abs(l.y - exp[1]) < 1.0 and abs(l.z - exp[2]) < 1.0
        log("sample %s: expected (%.0f, %.0f, %.0f) cm, actor (%.1f, %.1f, %.1f) -> %s" % (
            s["id"], exp[0], exp[1], exp[2], l.x, l.y, l.z, "OK" if sample_ok else "MISMATCH"))
        B.save_all()
        tbc = [n["id"] for n in d["npcs"] if not n["floorKnown"]]
        result.update(ok=sample_ok and len(placed) == EXPECTED_COUNT, placed=len(placed), removed=removed, ids=sorted(placed),
                      floorToConfirm=tbc, sampleCm=[round(l.x, 1), round(l.y, 1), round(l.z, 1)],
                      seconds=round(time.time() - t0, 1), engine=unreal.SystemLibrary.get_engine_version(),
                      source=d["source"]["sha256"])
        log("placed %d NPCs in %s (%d floor_to_confirm) in %.1f s" % (len(placed), MAP, len(tbc), time.time() - t0))
    except Exception as e:
        result["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV NPC] failed: " + result["error"])
    finally:
        os.makedirs(os.path.dirname(result_path), exist_ok=True)
        with open(result_path, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=1)
    return result


# Runs on -run=pythonscript / Execute Python Script; does nothing when imported as a module (tests).
if __name__ != "place_npcs" and unreal is not None:
    main()
