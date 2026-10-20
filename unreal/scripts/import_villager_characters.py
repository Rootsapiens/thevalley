"""Import the six free Quaternius RPG characters and build a textured Unreal showcase."""
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
PACK = os.path.join(REPO, "art-src", "models", "characters", "quaternius-rpg-character-pack")
FBX_DIR = os.path.join(PACK, "FBX")
TEXTURE_DIR = os.path.join(PACK, "Textures")
DEST = "/Game/OmegaValley/Characters/Villagers/RPGCharacterPack"
SHOWCASE = "/Game/OmegaValley/Maps/VillagerShowcase"
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())),
                      "ov_villager_characters_result.json")
CAST = ["Cleric", "Monk", "Ranger", "Rogue", "Warrior", "Wizard"]
SHOWCASE_TAG = unreal.Name("OV_VILLAGER_SHOWCASE")
EAL = unreal.EditorAssetLibrary


def import_fbx(name):
    folder = DEST + "/" + name
    paths = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
             if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "SkeletalMesh"] \
        if EAL.does_directory_exist(folder) else []
    if paths:
        return paths[0], "kept"
    source = os.path.join(FBX_DIR, name + ".fbx")
    if not os.path.isfile(source):
        raise RuntimeError("Missing source FBX: " + source)
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", source)
    task.set_editor_property("destination_path", folder)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", False)
    task.set_editor_property("save", True)
    task.set_editor_property("factory", unreal.FbxFactory())
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", True)
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("import_animations", False)
    task.set_editor_property("options", ui)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = [p for p in EAL.list_assets(folder, recursive=True, include_folder=False)
             if str(EAL.find_asset_data(p).asset_class_path.asset_name) == "SkeletalMesh"]
    if not paths:
        raise RuntimeError("No skeletal mesh imported from " + source)
    return paths[0], "imported"


def import_texture(name):
    folder = DEST + "/Textures"
    path = folder + "/" + name + "_Texture"
    existing = EAL.load_asset(path)
    if existing:
        return existing, "kept"
    source = os.path.join(TEXTURE_DIR, name + "_Texture.png")
    if not os.path.isfile(source):
        raise RuntimeError("Missing source texture: " + source)
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", source)
    task.set_editor_property("destination_path", folder)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", False)
    task.set_editor_property("save", True)
    task.set_editor_property("factory", unreal.TextureFactory())
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    texture = EAL.load_asset(path)
    if not texture:
        raise RuntimeError("Texture import failed: " + source)
    return texture, "imported"


def make_textured_material(name, texture):
    folder = DEST + "/Materials"
    path = folder + "/M_OV_Villager_" + name
    material = EAL.load_asset(path)
    if material:
        return material, "kept"
    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "M_OV_Villager_" + name, folder, unreal.Material, unreal.MaterialFactoryNew())
    if not material:
        raise RuntimeError("Could not create material " + path)
    sample = unreal.MaterialEditingLibrary.create_material_expression(
        material, unreal.MaterialExpressionTextureSample, -320, 0)
    sample.set_editor_property("texture", texture)
    unreal.MaterialEditingLibrary.connect_material_property(
        sample, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    roughness = unreal.MaterialEditingLibrary.create_material_expression(
        material, unreal.MaterialExpressionConstant, -80, 180)
    roughness.set_editor_property("r", 0.82)
    unreal.MaterialEditingLibrary.connect_material_property(
        roughness, "", unreal.MaterialProperty.MP_ROUGHNESS)
    EAL.save_loaded_asset(material)
    return material, "created"


def build_showcase(cast):
    import build_barn_level as B
    B.open_or_create_level(SHOWCASE)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for actor in actors.get_all_level_actors():
        if actor.actor_has_tag(SHOWCASE_TAG):
            actors.destroy_actor(actor)

    floor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, -15))
    floor.set_actor_label("VillagerShowcase_Ground")
    floor.static_mesh_component.set_static_mesh(EAL.load_asset("/Engine/BasicShapes/Cube.Cube"))
    floor.set_actor_scale3d(unreal.Vector(10, 5, 0.3))
    made = [floor]
    for i, name in enumerate(CAST):
        x = (i % 3 - 1) * 250.0
        y = (i // 3) * 240.0
        actor = actors.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(x, y, 0))
        actor.set_actor_label("VILLAGER_" + name.upper())
        actor.skeletal_mesh_component.set_skinned_asset_and_update(EAL.load_asset(cast[name]["mesh"]))
        actor.skeletal_mesh_component.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
        for slot in range(cast[name]["materialSlots"]):
            actor.skeletal_mesh_component.set_material(slot, EAL.load_asset(cast[name]["material"]))
        made.append(actor)

    light = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 650))
    light.set_actor_label("VillagerShowcase_KeyLight")
    light.set_actor_rotation(unreal.Rotator(pitch=-20, yaw=-35, roll=0), False)
    made.append(light)
    camera = actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, -1000, 280))
    camera.set_actor_label("VillagerShowcase_Camera")
    camera.set_actor_rotation(unreal.Rotator(pitch=-8, yaw=90, roll=0), False)
    camera.camera_component.set_editor_property("field_of_view", 48.0)
    made.append(camera)
    for actor in made:
        tags = list(actor.get_editor_property("tags"))
        tags.append(SHOWCASE_TAG)
        actor.set_editor_property("tags", tags)
    B.save_all()


def main():
    started = time.time()
    result = {"ok": False, "characters": {}, "showcase": SHOWCASE}
    try:
        textures = {}
        for name in CAST:
            texture, texture_state = import_texture(name)
            material, material_state = make_textured_material(name, texture)
            mesh_path, mesh_state = import_fbx(name)
            mesh = EAL.load_asset(mesh_path)
            slots = len(mesh.get_editor_property("materials"))
            result["characters"][name] = {
                "mesh": mesh_path, "material": material.get_path_name(), "texture": texture.get_path_name(),
                "materialSlots": max(1, slots), "meshState": mesh_state,
                "textureState": texture_state, "materialState": material_state,
                "skeleton": mesh.get_editor_property("skeleton").get_path_name()
            }
            unreal.log("[OV VILLAGERS] %s: %s; %d slots; %s" % (name, mesh_path, slots,
                                                                  result["characters"][name]["skeleton"]))
        EAL.save_directory(DEST, only_if_is_dirty=True, recursive=True)
        build_showcase(result["characters"])
        result["ok"] = True
    except Exception as exc:
        result["error"] = "%s\n%s" % (exc, traceback.format_exc())
        unreal.log_error("[OV VILLAGERS] " + result["error"])
    result["seconds"] = round(time.time() - started, 1)
    os.makedirs(os.path.dirname(RESULT), exist_ok=True)
    with open(RESULT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    return result


if __name__ != "import_villager_characters":
    main()
