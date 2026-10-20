"""Import tactical player variants and build a reusable Unreal showcase map.

The source bodies and animations are Quaternius CC0. The equipment is original,
rigidly attached to the exported skeleton joints. Keep this import idempotent.
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

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
REPO = ov_paths.repo_dir(PROJECT_DIR)
OPERATOR_SRC = os.path.join(REPO, "art-src", "models", "characters", "valley-operators")
DEST = "/Game/OmegaValley/Characters/Players"
SHOWCASE = "/Game/OmegaValley/Maps/PlayerShowcase"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())),
                      "ov_player_characters_result.json")
EAL = unreal.EditorAssetLibrary
CHARACTERS = [("Raven_OperatorMale", os.path.join(OPERATOR_SRC, "soldier_male_operator.fbx")),
              ("Raven_OperatorFemale", os.path.join(OPERATOR_SRC, "soldier_female_operator.fbx"))]
SHOWCASE_TAG = unreal.Name("OV_PLAYER_SHOWCASE")


def credited():
    with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as f:
        text = f.read()
    return "Ultimate Animated Character Pack" in text and "CC0" in text


def import_character(asset_name, source_path):
    folder = DEST + "/" + asset_name
    existing = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
                if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "SkeletalMesh"] \
        if EAL.does_directory_exist(folder) else []
    if existing:
        return existing[0], "kept"

    task = unreal.AssetImportTask()
    task.set_editor_property("filename", source_path)
    task.set_editor_property("destination_path", folder)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", False)
    task.set_editor_property("save", True)
    task.set_editor_property("factory", unreal.FbxFactory())
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", True)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", True)
    ui.set_editor_property("import_animations", False)
    task.set_editor_property("options", ui)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])

    meshes = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
              if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "SkeletalMesh"]
    assert meshes, "no skeletal mesh imported from " + source_path
    return meshes[0], "imported"


def build_showcase(mesh_paths):
    """A small Unreal map that makes both upgraded player silhouettes easy to inspect."""
    import build_barn_level as B
    B.open_or_create_level(SHOWCASE)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in actors.get_all_level_actors():
        if actor.actor_has_tag(SHOWCASE_TAG):
            actors.destroy_actor(actor)

    floor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -15))
    floor.set_actor_label("PlayerShowcase_Ground")
    floor.static_mesh_component.set_static_mesh(EAL.load_asset("/Engine/BasicShapes/Cube.Cube"))
    floor.set_actor_scale3d(unreal.Vector(8, 5, 0.3))
    actors_for_tag = [floor]

    for label, asset_key, x in [("OPERATOR_MALE", "Raven_OperatorMale", -120),
                                ("OPERATOR_FEMALE", "Raven_OperatorFemale", 120)]:
        actor = actors.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(x, 0, 0))
        actor.set_actor_label(label)
        actor.skeletal_mesh_component.set_skinned_asset_and_update(EAL.load_asset(mesh_paths[asset_key]))
        actor.skeletal_mesh_component.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
        actor.set_actor_scale3d(unreal.Vector(1, 1, 1))
        actors_for_tag.append(actor)

    light = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 450))
    light.set_actor_label("PlayerShowcase_KeyLight")
    light.set_actor_rotation(unreal.Rotator(pitch=-25, yaw=-35, roll=0), False)
    actors_for_tag.append(light)
    cam = actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, -700, 185))
    cam.set_actor_label("PlayerShowcase_Camera")
    cam.set_actor_rotation(unreal.Rotator(pitch=-3, yaw=90, roll=0), False)
    cam.camera_component.set_editor_property("field_of_view", 44.0)
    actors_for_tag.append(cam)

    for actor in actors_for_tag:
        tags = list(actor.get_editor_property("tags"))
        tags.append(SHOWCASE_TAG)
        actor.set_editor_property("tags", tags)
    B.save_all()


def main():
    started = time.time()
    result = {"ok": False, "characters": {}}
    try:
        assert credited(), "Quaternius character pack is not credited as CC0; refusing to import"
        for asset_name, source in CHARACTERS:
            assert os.path.isfile(source), "source FBX missing: " + source
            path, state = import_character(asset_name, source)
            mesh = EAL.load_asset(path)
            result["characters"][asset_name] = {
                "mesh": path, "state": state,
                "materials": len(mesh.get_editor_property("materials")),
                "skeleton": mesh.get_editor_property("skeleton").get_path_name()
            }
            unreal.log("[OV PLAYERS] %s: %s, skeleton %s" %
                       (asset_name, path, result["characters"][asset_name]["skeleton"]))
        EAL.save_directory(DEST, only_if_is_dirty=True, recursive=True)
        build_showcase({name: item["mesh"] for name, item in result["characters"].items()})
        result["showcase"] = SHOWCASE
        result["ok"] = True
    except Exception as exc:
        result["error"] = "%s\n%s" % (exc, traceback.format_exc())
        unreal.log_error("[OV PLAYERS] " + result["error"])
    result["seconds"] = round(time.time() - started, 1)
    os.makedirs(os.path.dirname(RESULT), exist_ok=True)
    with open(RESULT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    return result


if __name__ != "import_player_characters":
    main()
