"""Import the CC0 Quaternius tree meshes and report Unreal bounds.

This is a content-only preparation step. It does not open or edit a level, place actors,
or change the village-town coordinates. Run with Unreal Editor's Python scripting API.
"""
import json
import os
import sys
import traceback

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass
import ov_paths

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
REPO = ov_paths.repo_dir(PROJECT_DIR)
SOURCE_DIR = os.path.join(REPO, "art-src", "models", "quaternius-simple-nature", "source")
DEST = "/Game/OmegaValley/Environment/Nature/QuaterniusCC0"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())),
                      "ov_village_nature_import_result.json")
EAL = unreal.EditorAssetLibrary
# Tree3's source FBX has a malformed Icosphere face list and Unreal's FBX SDK cannot triangulate it.
TREES = ("Tree1", "Tree2", "Tree4")


def import_mesh(name):
    folder = DEST + "/" + name
    existing = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
                if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "StaticMesh"] \
        if EAL.does_directory_exist(folder) else []
    if existing:
        return EAL.load_asset(existing[0]), "kept"
    path = os.path.join(SOURCE_DIR, "Nature pack vol.3", "FBX", name + ".fbx")
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    task = unreal.AssetImportTask()
    for key, value in (("filename", path), ("destination_path", folder), ("automated", True),
                       ("replace_existing", False), ("save", True)):
        task.set_editor_property(key, value)
    options = unreal.FbxImportUI()
    options.set_editor_property("import_mesh", True)
    options.set_editor_property("import_as_skeletal", False)
    options.set_editor_property("import_materials", True)
    options.set_editor_property("import_textures", False)
    task.set_editor_property("options", options)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    meshes = [p for p in (task.get_editor_property("imported_object_paths") or [])
              if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "StaticMesh"]
    if not meshes:
        meshes = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
                  if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "StaticMesh"]
    if not meshes:
        raise RuntimeError("No StaticMesh imported from " + path)
    return EAL.load_asset(meshes[0]), "imported"


def main():
    result = {"ok": False, "destination": DEST, "trees": {}}
    try:
        with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as stream:
            credits = stream.read()
        if "Quaternius LowPoly Nature Pack vol. 3" not in credits or "CC0" not in credits:
            raise RuntimeError("CC0 nature credit missing; refusing import")
        for name in TREES:
            mesh, state = import_mesh(name)
            bounds = mesh.get_bounds()
            box = bounds.box_extent
            origin = bounds.origin
            result["trees"][name] = {
                "asset": mesh.get_path_name(), "state": state,
                "boundsOriginCm": [round(origin.x, 2), round(origin.y, 2), round(origin.z, 2)],
                "halfExtentCm": [round(box.x, 2), round(box.y, 2), round(box.z, 2)],
                "materials": len(mesh.get_editor_property("static_materials")),
                "triangles": int(mesh.get_num_triangles(0)),
            }
        EAL.save_directory(DEST, only_if_is_dirty=True, recursive=True)
        result["ok"] = True
    except Exception as exc:
        result["error"] = str(exc) + "\n" + traceback.format_exc()
        unreal.log_error("[OV Nature] " + result["error"])
    os.makedirs(os.path.dirname(RESULT), exist_ok=True)
    with open(RESULT, "w", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2)
    unreal.log("[OV Nature] imported %d tree meshes; ok=%s" % (len(result["trees"]), result["ok"]))
    return result


if __name__ != "import_village_nature":
    main()
