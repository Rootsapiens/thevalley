"""Places the village NPCs in /Game/OmegaValley/Maps/BarnSlice from unreal/data/village-npcs.json
(exported by scripts/export-npcs.ts from src/npcData.ts).

Run headless (what run_npcs.ps1 does):
  UnrealEditor-Cmd.exe <repo>\\unreal\\OmegaValley\\OmegaValley.uproject -run=pythonscript
      -script="<repo>\\unreal\\scripts\\place_npcs.py" -unattended -nosplash -nop4
Or inside the editor: Tools > Execute Python Script... > this file.

The unnamed Farmer uses the Village_WorkerMale mesh and lantern. Maryam, the priest, the farmer's wife and six square
villagers use the six textured Quaternius RPG character skins. Police, Moreno, Omar and Elia remain cylinder placeholders.
In the default post-prologue BarnSlice the Farmer is visible and talkable at the trough. His `storyWindow:ch1_day1_prologue`
and `talkableAfter:prologue` tags are staging metadata for the future narrative controller; no controller is wired into
this UE trial. Actor label = NPC id, outliner folder "NPCs". Unknown-height NPCs sit at game y = 0 (UE Z = 0), never at a guessed height.

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
FARMER_MESH_PATH = "/Game/OmegaValley/Characters/Players/Village_WorkerMale/Worker_Male"
VILLAGER_CAST = {
    "npc_maryam": "Monk",
    "npc_priest": "Cleric",
    "npc_farmers_wife": "Ranger",
    "npc_square_villager_1": "Rogue",
    "npc_square_villager_2": "Warrior",
    "npc_square_villager_3": "Wizard",
    "npc_square_villager_4": "Monk",
    "npc_square_villager_5": "Ranger",
    "npc_square_villager_6": "Cleric",
}
VILLAGER_ASSET_ROOT = "/Game/OmegaValley/Characters/Villagers/RPGCharacterPack"


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
    if npc["id"] == "npc_farmer":
        tags += ["storyWindow:ch1_day1_prologue", "talkableAfter:prologue", "role:farmer",
                 "state:post_prologue", "talkable:true", "behavior:slow_searching", "lookToward:mountain"]
        yaw = U.bearing_to_yaw(45.0)
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


def spawn_farmer(eas, plan):
    """Create the unnamed Farmer as a recognizable worker; keep him out of the default post-prologue trial state."""
    mesh = unreal.EditorAssetLibrary.load_asset(FARMER_MESH_PATH)
    if not mesh:
        raise RuntimeError("Farmer skeletal mesh missing at %s; run run_player_characters.ps1 first" % FARMER_MESH_PATH)
    # Skeletal mesh pivot is at the feet; unlike the cylinder placeholder, do not raise it by half a body height.
    a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(*plan["feet"]),
                                   unreal.Rotator(roll=0.0, pitch=0.0, yaw=plan["yaw"]))
    a.set_actor_label("npc_farmer")
    a.set_folder_path(FOLDER)
    a.set_editor_property("tags", [unreal.Name(t) for t in plan["tags"]])
    a.skeletal_mesh_component.set_skinned_asset_and_update(mesh)
    a.skeletal_mesh_component.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    # BarnSlice starts in the approved post-prologue state, so the Farmer is present and talkable there.
    a.set_actor_scale3d(unreal.Vector(1.0, 1.0, 1.0))

    # A simple unlit search lantern, positioned beside the worker's right hand. It shares the Farmer's stable ID and
    # event tags so an event controller can toggle the complete prop set together.
    prop_tags = list(plan["tags"]) + ["npc_prop:farmer_lantern"]
    lantern = eas.spawn_actor_from_class(unreal.StaticMeshActor,
                                         unreal.Vector(plan["feet"][0] + 32.0,
                                                       plan["feet"][1],
                                                       plan["feet"][2] + 98.0),
                                         unreal.Rotator(roll=0.0, pitch=0.0, yaw=plan["yaw"]))
    lantern.set_actor_label("npc_farmer_lantern")
    lantern.set_folder_path(FOLDER + "/npc_farmer")
    lantern.set_editor_property("tags", [unreal.Name(t) for t in prop_tags])
    lantern.static_mesh_component.set_static_mesh(unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cylinder.Cylinder"))
    lantern.static_mesh_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    lantern.set_actor_scale3d(unreal.Vector(0.10, 0.10, 0.22))
    try:
        lantern.attach_to_actor(a, unreal.Name(""), unreal.AttachLocation.KEEP_WORLD, unreal.AttachRotation.KEEP_WORLD,
                                unreal.AttachScale.KEEP_WORLD, False)
    except Exception as exc:
        unreal.log_warning("[OV NPC] lantern not attached to Farmer: %s" % exc)
    return a


def mark_event_gated_default(a, npc_id):
    """Keep Omar/Elia offstage until a validated story snapshot supplies their event state."""
    if npc_id not in ("npc_omar", "npc_elia"):
        return
    tags = [unreal.Name(t) for t in _actor_tags(a)]
    tags.extend((unreal.Name("storyStateRequired:true"), unreal.Name("storyStage:uninitialized"),
                 unreal.Name("storyTalkable:false")))
    a.set_editor_property("tags", tags)
    a.set_actor_hidden_in_game(True)
    try:
        a.set_is_temporarily_hidden_in_editor(True)
    except Exception as exc:
        unreal.log_warning("[OV NPC] could not hide uninitialized %s in editor: %s" % (npc_id, exc))


def _actor_tags(a):
    return [str(tag) for tag in a.get_editor_property("tags")]


def spawn_npc(eas, body, plan):
    if "npc:npc_farmer" in plan["tags"]:
        return spawn_farmer(eas, plan)
    npc_id = next((tag[4:] for tag in plan["tags"] if tag.startswith("npc:")), "")
    cast = VILLAGER_CAST.get(npc_id)
    if cast:
        mesh_path = VILLAGER_ASSET_ROOT + "/" + cast + "/" + cast
        material_path = VILLAGER_ASSET_ROOT + "/Materials/M_OV_Villager_" + cast
        mesh = unreal.EditorAssetLibrary.load_asset(mesh_path)
        material = unreal.EditorAssetLibrary.load_asset(material_path)
        if not mesh or not material:
            raise RuntimeError("Villager skin not imported: %s; run run_villager_characters.ps1 first" % cast)
        a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(*plan["feet"]),
                                       unreal.Rotator(roll=0.0, pitch=0.0, yaw=plan["yaw"]))
        a.set_actor_label(plan["label"])
        a.set_folder_path(FOLDER)
        a.set_editor_property("tags", [unreal.Name(t) for t in plan["tags"] + ["skin:village_rpg:" + cast.lower()]])
        component = a.skeletal_mesh_component
        component.set_skinned_asset_and_update(mesh)
        component.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
        for slot in range(max(1, len(mesh.get_editor_property("materials")))):
            component.set_material(slot, material)
        a.set_actor_scale3d(unreal.Vector(1.0, 1.0, 1.0))
        mark_event_gated_default(a, npc_id)
        return a
    a = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*plan["location"]),
                                   unreal.Rotator(roll=0.0, pitch=0.0, yaw=plan["yaw"]))
    a.set_actor_label(plan["label"])
    a.set_folder_path(FOLDER)
    a.set_editor_property("tags", [unreal.Name(t) for t in plan["tags"]])
    smc = a.static_mesh_component
    smc.set_static_mesh(body)
    smc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    a.set_actor_scale3d(unreal.Vector(*plan["scale"]))
    mark_event_gated_default(a, npc_id)
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
        exp = plan["feet"] if s["id"] == "npc_farmer" else plan["location"]
        sample_ok = abs(l.x - exp[0]) < 1.0 and abs(l.y - exp[1]) < 1.0 and abs(l.z - exp[2]) < 1.0
        log("sample %s: expected actor pivot (%.0f, %.0f, %.0f) cm, actor (%.1f, %.1f, %.1f) -> %s" % (
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
