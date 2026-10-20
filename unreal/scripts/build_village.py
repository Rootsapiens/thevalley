"""Builds /Game/OmegaValley/Maps/Village: the barn slice plus the full village blockout (queue item 4, a first pass).

Data: <unreal>/data/village-town.json + village-terrain.glb, written by scripts/export-village-json.mjs next to
village-barn.json (read-only on src/). Game metres (x east, y up, z south) -> UE cm (X east, Y south, Z up) via ov_units.
  terrain   groundY() at 1 m (+ a 400 m flat skirt), imported with Interchange glTF, Nanite, complex collision
  town      every non-invisible townSolids() box, material by group / building kind; gable roofs over the houses
  trees     olives (trunk + round crown) and pines (trunk + cone); the stream as a water strip
  slice     the barn corner from build_barn_level.py (same builders, same lighting and lanterns)
Landmark checks: the shrine (2255, -3730) cm and the church tower centre (250, 2750) cm; terrain bounds vs the export.
Run: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\build_village.py"  (or run_village.ps1)
Writes Saved/ov_village_result.json.
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
import build_barn_level as B  # noqa: E402  (module import: its main() does not run)
import ov_paths  # noqa: E402
import ov_units as U  # noqa: E402

MAP = "/Game/OmegaValley/Maps/Village"
ART = "/Game/OmegaValley/Village"
TOWN = ov_paths.data_file(B.PROJECT_DIR, "village-town.json")
RESULT = os.path.join(os.path.dirname(B.RESULT), "ov_village_result.json")
EAL = unreal.EditorAssetLibrary

KIND_MAT = {"church": "stone", "tower": "stone", "house": "plaster", "school": "plaster", "cafe": "plaster", "barn": "wood", "shed": "wood"}
GROUP_MAT = {"fence": "fence", "wall": "stone", "step": "stone", "prop": "stone", "pole": "woodDark", "grave": "stone", "stone": "stone"}


# Village stills (LS_VillageStills, rendered by render_mrq.ps1 -Jobs village): label, eye, target (game m), vertical FOV.
VSTILLS = [
    ("VStill_Aerial", (-70.0, 60.0, 150.0), (30.0, 0.0, 40.0), 55.0),
    ("VStill_Square", (-5.0, 1.7, 58.0), (24.0, 4.0, 30.0), 65.0),
]


def import_terrain(t):
    glb = os.path.join(os.path.dirname(TOWN), t["file"])
    task = unreal.AssetImportTask()
    for k, v in (("filename", glb), ("destination_path", ART), ("automated", True), ("replace_existing", True), ("save", True)):
        task.set_editor_property(k, v)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    mesh = None
    for p in task.get_editor_property("imported_object_paths") or []:
        a = EAL.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            mesh = a
    if not mesh:
        raise RuntimeError("terrain import produced no StaticMesh from %s" % glb)
    try:
        bs = mesh.get_editor_property("body_setup")
        bs.set_editor_property("collision_trace_flag", unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    except Exception as e:
        B.warn("terrain collision: %s" % e)
    try:
        ns = mesh.get_editor_property("nanite_settings")
        ns.set_editor_property("enabled", True)
        sme = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
        if sme:
            sme.set_nanite_settings(mesh, ns, True)
        else:
            mesh.set_editor_property("nanite_settings", ns)
    except Exception as e:
        B.warn("terrain nanite: %s" % e)
    EAL.save_loaded_asset(mesh)
    return mesh


def build_terrain(town, mats):
    t = town["terrain"]
    mesh = import_terrain(t)
    a = B.spawn(unreal.StaticMeshActor, (0, 0, 0), None, "VillageTerrain", "Ground")
    smc = a.static_mesh_component
    smc.set_static_mesh(mesh)
    smc.set_material(0, mats["ground"])
    smc.set_editor_property("mobility", unreal.ComponentMobility.STATIC)
    origin, ext = a.get_actor_bounds(False)
    got = {"min": [origin.x - ext.x, origin.y - ext.y, origin.z - ext.z], "max": [origin.x + ext.x, origin.y + ext.y, origin.z + ext.z]}
    exp = town["checks"]["terrainUeCm"]
    err = max(abs(got[k][i] - exp[k]["xyz"[i]]) for k in ("min", "max") for i in range(3))
    B.log("terrain bounds: got min %s max %s, expected %s -> max error %.1f cm" % (
        [round(v) for v in got["min"]], [round(v) for v in got["max"]], exp, err))
    return {"maxErrCm": round(err, 1), "ok": err < 5.0}


def build_town(town, mats):
    n = 0
    for i, s in enumerate(town["solids"]):
        g = s["group"]
        if g == "tree":
            continue
        mat = KIND_MAT.get(s.get("kind"), "plaster") if g == "building" else GROUP_MAT.get(g, "stone")
        c, sz = U.box_to_ue(s)
        B.shape("Cube", c, sz, mats[mat], "Town_%s_%03d" % (s.get("id", g), i), "Town/" + (s.get("id") or g))
        n += 1
    roofs = 0
    for b in town["buildings"]:
        if b["roof"] != "gable":
            continue
        eave = b["floor"] + b["eave"] + 0.5         # townSolids: shell top = floor + eave + 0.5
        half = min(b["x1"] - b["x0"], b["z1"] - b["z0"]) / 2.0
        B.gable_roof(b, eave, eave + 0.45 * half, mats, "Town_" + b["id"], "Town/" + b["id"], over=0.4, th=0.22, solid_gables=True)
        roofs += 1
    return n, roofs


def build_trees(town, mats):
    for i, t in enumerate(town["trees"]["olives"]):
        s = t["s"]
        B.shape("Cylinder", U.loc(t["x"], t["y"] + 0.9 * s, t["z"]), (26 * s, 26 * s, 180 * s), mats["woodDark"], "Olive%03d_Trunk" % i, "Town/Trees")
        B.shape("Sphere", U.loc(t["x"], t["y"] + 2.5 * s, t["z"]), (340 * s, 340 * s, 260 * s), mats["olive"], "Olive%03d_Crown" % i, "Town/Trees")
    for i, t in enumerate(town["trees"]["pines"]):
        h = t["h"]
        B.shape("Cylinder", U.loc(t["x"], t["y"] + h * 0.2, t["z"]), (h * 3.5, h * 3.5, h * 40), mats["woodDark"], "Pine%03d_Trunk" % i, "Town/Trees")
        B.shape("Cone", U.loc(t["x"], t["y"] + h * 0.6, t["z"]), (h * 32, h * 32, h * 80), mats["pine"], "Pine%03d_Crown" % i, "Town/Trees")
    return len(town["trees"]["olives"]) + len(town["trees"]["pines"])


def build_stream(town, mats):
    rows = town["stream"]["rows"]
    for (z, x, half, wy), nxt in zip(rows, rows[1:] + [None]):
        z1 = nxt[0] if nxt else z + 2
        B.gbox(x - half, wy - 0.5, z, x + half, wy, z1, mats["water"], "Stream_%+04d" % z, "Town/Stream")
    f = town["fountain"]
    B.shape("Cylinder", U.loc(f["x"], f["h"] / 2, f["z"]), (f["r"] * 200, f["r"] * 200, f["h"] * 100), mats["stone"], "Fountain", "Town")
    return len(rows)


def main():
    t0 = time.time()
    res = {"ok": False, "map": MAP}
    try:
        B.load_look()
        with open(B.DATA, encoding="utf-8") as fh:
            d = json.load(fh)
        with open(TOWN, encoding="utf-8") as fh:
            town = json.load(fh)
        B.open_or_create_level(MAP)
        B.clear_generated()
        import ov_materials
        mats, sky_mi, res["materials"] = ov_materials.ensure_materials(B.SKY_INTENSITY)
        res["terrain"] = build_terrain(town, mats)
        B.build_barn(d, mats)
        B.build_yard(d, mats)
        B.build_fences(d, mats)
        B.build_trees(d, mats)
        B.build_trail(d, mats)
        B.build_mountain(d, mats)
        res["townBoxes"], res["roofs"] = build_town(town, mats)
        import decorate_rooms_rajaie
        res["residentialRooms"] = decorate_rooms_rajaie.decorate(town, mats)
        import decorate_rooms_tareq
        res["publicRooms"] = decorate_rooms_tareq.decorate(town, mats)
        res["trees"] = build_trees(town, mats)
        res["streamStrips"] = build_stream(town, mats)
        B.build_lighting(d, sky_mi)
        B.build_lanterns(d, mats)
        B.build_markers(d)
        cams = []
        for label, eye, tgt, fov in VSTILLS:
            b, p = B.look_at(eye, tgt)
            cams.append(B.cine_cam(label, eye, b, p, fov_v_deg=fov))
        import make_stills
        res["stills"] = make_stills.main(cams, "LS_VillageStills", "ov_village_stills.json")
        res["landmark"] = B.check_landmark(d)
        tw = town["checks"]["tower"]["ueCm"]
        towers = [a for a in B.EAS.get_all_level_actors() if a.get_actor_label().startswith("Town_tower_")]
        if towers:
            o, e = towers[0].get_actor_bounds(False)
            xs = [a.get_actor_bounds(False) for a in towers]
            cx = (min(b[0].x - b[1].x for b in xs) + max(b[0].x + b[1].x for b in xs)) / 2
            cy = (min(b[0].y - b[1].y for b in xs) + max(b[0].y + b[1].y for b in xs)) / 2
            res["tower"] = {"expected": [tw["x"], tw["y"]], "got": [round(cx, 1), round(cy, 1)], "ok": abs(cx - tw["x"]) < 1 and abs(cy - tw["y"]) < 1}
            B.log("landmark tower: expected (%.0f, %.0f) cm, got (%.1f, %.1f)" % (tw["x"], tw["y"], cx, cy))
        B.save_all()
        res.update(ok=bool(res["landmark"]["ok"] and res["terrain"]["ok"] and res.get("tower", {}).get("ok")),
                   actors=B.STATS["actors"], seconds=round(time.time() - t0, 1))
        B.log("built %s: %d actors in %.1f s" % (MAP, B.STATS["actors"], time.time() - t0))
    except Exception as e:
        res["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV] village build failed: " + res["error"])
    finally:
        with open(RESULT, "w", encoding="utf-8") as fh:
            json.dump(res, fh, indent=1)
    return res


if __name__ != "build_village":
    main()
