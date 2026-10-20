"""Imports the chosen Quaternius Ultimate Gun Pack FBX files (CC0, logged in CREDITS.md) into the UE project.

  <repo>/unreal/assets/guns/FBX/<name>.fbx  ->  /Game/OmegaValley/Weapons/Meshes/<name>/   (static mesh + its materials)

Chosen subset (GUNS below): Pistol_1, SubmachineGun_1, Shotgun_1, AssaultRifle_1. Our weapons (weapons.json) use these
meshes as bodies; names, numbers and behaviour are ours.
Idempotent: a gun whose folder already holds a static mesh is skipped; OV_REIMPORT=1 deletes and re-imports.
Run headless:
  UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\import_guns.py" -unattended -nosplash -nop4
Writes Saved/ov_guns_result.json: per gun the mesh path, triangle count, bounds (cm) and the longest axis.
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

GUNS = ["Pistol_1", "SubmachineGun_1", "Shotgun_1", "AssaultRifle_1"]
DEST = "/Game/OmegaValley/Weapons/Meshes"
PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
REPO = ov_paths.repo_dir(PROJECT_DIR)
SRC = os.path.join(REPO, "unreal", "assets", "guns", "FBX")
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), "ov_guns_result.json")
EAL = unreal.EditorAssetLibrary


def log(m):
    unreal.log("[OV GUNS] " + m)


def credited():
    with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as fh:
        return any(l.startswith("unreal/assets/guns/") and "CC0" in l for l in fh)


def meshes_in(folder):
    out = []
    for p in EAL.list_assets(folder, recursive=True, include_folder=False):
        a = EAL.find_asset_data(p)
        if str(a.asset_class_path.asset_name) == "StaticMesh":
            out.append(p.split(".")[0])
    return out


def import_one(name, reimport):
    folder = "%s/%s" % (DEST, name)
    have = meshes_in(folder) if EAL.does_directory_exist(folder) else []
    if have and not reimport:
        return have[0], "kept"
    if EAL.does_directory_exist(folder):
        EAL.delete_directory(folder)
    t = unreal.AssetImportTask()
    t.set_editor_property("filename", os.path.join(SRC, name + ".fbx"))
    t.set_editor_property("destination_path", folder)
    t.set_editor_property("automated", True)
    t.set_editor_property("replace_existing", True)
    t.set_editor_property("save", True)
    ui = unreal.FbxImportUI()           # used by the legacy FBX path; Interchange ignores it and uses its defaults
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", True)
    ui.set_editor_property("import_animations", False)
    smd = ui.get_editor_property("static_mesh_import_data")
    smd.set_editor_property("combine_meshes", True)
    smd.set_editor_property("generate_lightmap_u_vs", False)
    t.set_editor_property("options", ui)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    have = meshes_in(folder)
    assert have, "no static mesh imported from %s.fbx" % name
    return have[0], "imported"


def main():
    t0 = time.time()
    res = {"ok": False, "guns": {}}
    try:
        assert credited(), "unreal/assets/guns is not logged in CREDITS.md: refusing to import"
        reimport = os.environ.get("OV_REIMPORT") == "1"
        for name in GUNS:
            path, how = import_one(name, reimport)
            sm = EAL.load_asset(path)
            # Simple box collision is not needed (viewmodels never collide); keep Nanite off: tiny meshes.
            b = sm.get_bounding_box()
            ext = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]
            axis = "XYZ"[ext.index(max(ext))]
            tris = sm.get_num_triangles(0)
            res["guns"][name] = {"mesh": path, "how": how, "tris": tris, "sizeCm": [round(e, 1) for e in ext],
                                 "min": [round(b.min.x, 1), round(b.min.y, 1), round(b.min.z, 1)], "longAxis": axis,
                                 "materials": len(sm.get_editor_property("static_materials"))}
            log("%s: %s (%s) %s cm, long axis %s" % (name, path, how, res["guns"][name]["sizeCm"], axis))
        EAL.save_directory(DEST, only_if_is_dirty=True, recursive=True)
        res["ok"] = True
    except Exception as e:
        res["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV GUNS] " + res["error"])
    res["seconds"] = round(time.time() - t0, 1)
    os.makedirs(os.path.dirname(RESULT), exist_ok=True)
    with open(RESULT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1)
    return res


if __name__ != "import_guns":
    main()
