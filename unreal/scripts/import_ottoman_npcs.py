"""Import the six already role-mapped, CC0 Ottoman GLBs and inspect UE assets.

Content-only preparation. No level, NPC data, placement, story state, or coordinates are edited.
The trader/vezir GLBs are intentionally omitted because those roles are unmapped in the game.
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
SOURCE = os.path.join(REPO, "public", "models", "ottoman-npcs")
DEST = "/Game/OmegaValley/Characters/Villagers/OttomanCC0"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())),
                      "ov_ottoman_npc_import_result.json")
NAMES = ("poor", "clergyman", "guy", "lady", "woman", "a-normal-guy-with-dark-skin")
EAL = unreal.EditorAssetLibrary


def imports_for(name):
    folder = DEST + "/" + name
    if EAL.does_directory_exist(folder):
        existing = EAL.list_assets(folder, recursive=True, include_folder=False)
        if existing:
            return existing, "kept"
    source = os.path.join(SOURCE, name + ".glb")
    if not os.path.isfile(source):
        raise FileNotFoundError(source)
    task = unreal.AssetImportTask()
    for key, value in (("filename", source), ("destination_path", folder), ("automated", True),
                       ("replace_existing", False), ("save", True)):
        task.set_editor_property(key, value)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = task.get_editor_property("imported_object_paths") or []
    if not paths:
        paths = EAL.list_assets(folder, recursive=True, include_folder=False)
    if not paths:
        raise RuntimeError("No assets imported from " + source)
    return paths, "imported"


def main():
    result = {"ok": False, "destination": DEST, "characters": {}, "engineApi": {}}
    try:
        with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as stream:
            credits = stream.read()
        with open(os.path.join(REPO, "studio", "art", "free-assets-manifest.md"), encoding="utf-8") as stream:
            manifest = stream.read()
        if "ottoman-npcs" not in credits or "CC0" not in manifest:
            raise RuntimeError("CC0 Ottoman pack credit missing; refusing import")
        result["engineApi"]["actorComponentMethods"] = [name for name in dir(unreal.Actor) if "component" in name.lower()]
        merge_api = getattr(unreal, "SkeletalMergingLibrary", None)
        result["engineApi"]["skeletalMergeMethods"] = [name for name in dir(merge_api) if not name.startswith("_")] if merge_api else []
        result["engineApi"]["mergeMeshesDoc"] = getattr(getattr(merge_api, "merge_meshes", None), "__doc__", "") if merge_api else ""
        merge_params = getattr(unreal, "SkeletalMeshMergeParams", None)
        result["engineApi"]["mergeParamsProperties"] = [name for name in dir(merge_params) if not name.startswith("_")] if merge_params else []
        result["engineApi"]["mergeParamsDoc"] = getattr(merge_params, "__doc__", "") if merge_params else ""
        result["engineApi"]["mergeSkeletonsDoc"] = getattr(getattr(merge_api, "merge_skeletons", None), "__doc__", "") if merge_api else ""
        editor_level = getattr(unreal, "EditorLevelLibrary", None)
        result["engineApi"]["editorLevelComponentMethods"] = [name for name in dir(editor_level) if "component" in name.lower()] if editor_level else []
        names = () if os.environ.get("OV_OTTOMAN_INSPECT") == "1" else NAMES
        for name in names:
            paths, state = imports_for(name)
            items = []
            for path in paths:
                asset = EAL.load_asset(path)
                if not asset:
                    continue
                item = {"path": path, "class": str(EAL.find_asset_data(path).asset_class_path.asset_name)}
                if isinstance(asset, unreal.StaticMesh):
                    bounds = asset.get_bounds()
                    origin, ext = bounds.origin, bounds.box_extent
                    item.update(boundsOriginCm=[round(origin.x, 2), round(origin.y, 2), round(origin.z, 2)],
                                halfExtentCm=[round(ext.x, 2), round(ext.y, 2), round(ext.z, 2)],
                                materials=len(asset.get_editor_property("static_materials")),
                                triangles=int(asset.get_num_triangles(0)))
                elif isinstance(asset, unreal.SkeletalMesh):
                    bounds = asset.get_bounds()
                    origin, ext = bounds.origin, bounds.box_extent
                    item.update(boundsOriginCm=[round(origin.x, 2), round(origin.y, 2), round(origin.z, 2)],
                                halfExtentCm=[round(ext.x, 2), round(ext.y, 2), round(ext.z, 2)],
                                materials=len(asset.get_editor_property("materials")))
                items.append(item)
            result["characters"][name] = {"state": state, "assets": items}
        if os.environ.get("OV_OTTOMAN_INSPECT") == "1":
            folder = DEST + "/poor"
            parts = [EAL.load_asset(path) for path in EAL.list_assets(folder, recursive=True, include_folder=False)
                     if str(EAL.find_asset_data(path).asset_class_path.asset_name) == "SkeletalMesh"]
            params = unreal.SkeletalMeshMergeParams()
            params.set_editor_property("meshes_to_merge", parts)
            params.set_editor_property("needs_cpu_access", False)
            params.set_editor_property("skeleton", parts[0].get_editor_property("skeleton"))
            params.set_editor_property("skeleton_before", True)
            merged = unreal.SkeletalMergingLibrary.merge_meshes(params)
            result["mergeProbe"] = {"valid": bool(merged)}
            if merged:
                merged_skeleton = merged.get_editor_property("skeleton")
                result["mergeProbe"].update(path=merged.get_path_name(), outer=merged.get_outer().get_path_name(),
                                             skeleton=merged_skeleton.get_path_name() if merged_skeleton else None,
                                             materials=len(merged.get_editor_property("materials")))
                # `merge_meshes` returns an unregistered transient asset in UE 5.8.
                # Do not pass it to AssetTools.duplicate_asset: this crashed the commandlet.
                result["mergeProbe"]["persistentAsset"] = False
        EAL.save_directory(DEST, only_if_is_dirty=True, recursive=True)
        result["ok"] = all(c["assets"] for c in result["characters"].values())
    except Exception as exc:
        result["error"] = str(exc) + "\n" + traceback.format_exc()
        unreal.log_error("[OV Ottoman NPCs] " + result["error"])
    os.makedirs(os.path.dirname(RESULT), exist_ok=True)
    with open(RESULT, "w", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2)
    if os.environ.get("OV_OTTOMAN_INSPECT") == "1" and not result.get("error"):
        result["ok"] = True
    unreal.log("[OV Ottoman NPCs] imported %d role-safe CC0 figures; ok=%s" %
               (len(result["characters"]), result["ok"]))
    return result


if __name__ != "import_ottoman_npcs":
    main()
