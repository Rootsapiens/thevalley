"""Build light, animated tactical operator gear for the Valley multiplayer.

Source bodies and animation clips: Quaternius Ultimate Animated Character Pack (CC0).
The gear meshes are original procedural additions, rigid-weighted to the matching bones.
Run with Blender 5.x: blender -b -P scripts/models/upgrade-operators.py
"""
from pathlib import Path
import shutil
import bpy

ROOT = Path(__file__).resolve().parents[2]
CHAR_DIR = ROOT / "public" / "models" / "characters"
OUT_DIR = ROOT / "art-src" / "models" / "characters" / "valley-operators"


def material(name, color, metallic=0.0, roughness=0.78):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def bevel_box(name, center, size, mat, bone, bevel=0.075):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Soft gear edges", "BEVEL")
    mod.width = bevel
    mod.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj, bone


def cylinder(name, center, radius, depth, mat, bone, axis="Z", vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    if axis == "Y":
        obj.rotation_euler.x = 1.5708
    elif axis == "X":
        obj.rotation_euler.y = 1.5708
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new("Rounded hardware", "BEVEL")
    mod.width = min(radius * 0.22, depth * 0.14)
    mod.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    return obj, bone


def make_gear(armature):
    # The source FBX's scene Root scales its armature and body together.
    # These layout measurements are in armature bind coordinates; convert them to scene space.
    s = armature.parent.scale.x if armature.parent else 1.0
    fabric = material("TacticalFabric", (0.12, 0.15, 0.12), roughness=0.94)
    carrier = material("PlateCarrier", (0.075, 0.09, 0.08), roughness=0.86)
    pouch = material("PouchCanvas", (0.22, 0.23, 0.17), roughness=0.92)
    armor = material("HardArmor", (0.10, 0.12, 0.11), metallic=0.08, roughness=0.68)
    hardware = material("MetalHardware", (0.32, 0.34, 0.31), metallic=0.68, roughness=0.38)
    lens = material("GoggleLens", (0.025, 0.045, 0.05), metallic=0.55, roughness=0.2)
    rubber = material("BootRubber", (0.045, 0.047, 0.043), roughness=0.96)
    pieces = []

    def box(name, at, size, mat, bone, bevel=0.055):
        pieces.append(bevel_box(name, tuple(v * s for v in at), tuple(v * s for v in size), mat, bone, bevel * s))

    def cyl(name, at, rad, depth, mat, bone, axis="Z"):
        pieces.append(cylinder(name, tuple(v * s for v in at), rad * s, depth * s, mat, bone, axis))

    # Chest rig, shoulder straps and reinforced back carrier.
    box("Carrier_Core", (0, -0.343, 1.72), (0.76, 0.16, 0.72), carrier, "Torso", 0.11)
    box("Front_Armor_Plate", (0, -0.444, 1.76), (0.59, 0.06, 0.48), armor, "Torso", 0.12)
    box("Carrier_Upper_Band", (0, -0.455, 2.02), (0.60, 0.045, 0.07), hardware, "Torso", 0.025)
    for x in (-0.25, 0.0, 0.25):
        box("Magazine_Pouch", (x, -0.49, 1.48), (0.19, 0.10, 0.22), pouch, "Torso", 0.035)
        box("Pouch_Flap", (x, -0.551, 1.56), (0.17, 0.025, 0.055), fabric, "Torso", 0.018)
        cyl("Pouch_Snap", (x, -0.57, 1.545), 0.018, 0.012, hardware, "Torso", "Y")
    for x in (-0.28, 0.28):
        box("Shoulder_Straps", (x, -0.265, 2.00), (0.14, 0.09, 0.43), fabric, "Torso", 0.05)
        box("Side_Cummerbund", (x * 1.55, 0.0, 1.71), (0.13, 0.36, 0.42), fabric, "Torso", 0.045)
    box("Back_Pack", (0, 0.345, 1.78), (0.52, 0.29, 0.67), fabric, "Torso", 0.11)
    box("Pack_Outer_Pocket", (0, 0.51, 1.66), (0.38, 0.07, 0.26), pouch, "Torso", 0.06)
    box("Belt", (0, 0.0, 1.22), (0.91, 0.49, 0.12), fabric, "Hips", 0.04)
    box("Buckle", (0, -0.27, 1.22), (0.13, 0.035, 0.075), hardware, "Hips", 0.018)
    for x in (-0.48, 0.48):
        box("Hip_Utility_Pouch", (x, -0.12, 1.27), (0.19, 0.23, 0.24), pouch, "Hips", 0.04)
        box("Cargo_Pocket", (x * 0.57, -0.03, 0.82), (0.24, 0.23, 0.26), fabric, "UpperLeg.L" if x > 0 else "UpperLeg.R", 0.035)

    # Recognisable operator profile: helmet rails, goggles, neck gaiter, radio and shoulder armor.
    box("Helmet_Shell", (0, 0.0, 2.71), (0.58, 0.58, 0.31), armor, "Head", 0.14)
    box("Helmet_Front_Rim", (0, -0.30, 2.62), (0.50, 0.09, 0.075), hardware, "Head", 0.028)
    box("Goggle_Frame", (0, -0.31, 2.43), (0.48, 0.075, 0.14), carrier, "Head", 0.052)
    box("Goggle_Lens", (0, -0.358, 2.43), (0.39, 0.025, 0.078), lens, "Head", 0.028)
    box("Neck_Gaiter", (0, -0.005, 2.10), (0.34, 0.35, 0.15), fabric, "Neck", 0.06)
    box("Shoulder_Pad_L", (0.48, 0.0, 1.96), (0.31, 0.37, 0.28), armor, "Shoulder.L", 0.085)
    box("Shoulder_Pad_R", (-0.48, 0.0, 1.96), (0.31, 0.37, 0.28), armor, "Shoulder.R", 0.085)
    for x, bone in ((0.86, "LowerArm.L"), (-0.86, "LowerArm.R")):
        box("Elbow_Guard", (x, -0.025, 1.84), (0.23, 0.27, 0.20), armor, bone, 0.06)
        box("Glove_Cuff", (x * 1.55, -0.015, 1.85), (0.14, 0.22, 0.17), fabric, "Fist.L" if x > 0 else "Fist.R", 0.04)
    box("Radio", (0.44, -0.29, 2.12), (0.14, 0.10, 0.23), carrier, "Torso", 0.035)
    cyl("Radio_Antenna", (0.46, -0.33, 2.30), 0.012, 0.23, hardware, "Torso")
    box("Shoulder_Unit_Patch", (-0.49, -0.194, 2.00), (0.16, 0.025, 0.12), pouch, "Shoulder.R", 0.025)

    # Knee caps and reinforced boot profiles.
    for x, side in ((0.26, "L"), (-0.26, "R")):
        bone = "LowerLeg." + side
        box("Knee_Pad", (x, -0.20, 0.63), (0.29, 0.12, 0.24), armor, bone, 0.07)
        box("Knee_Pad_Ridge", (x, -0.269, 0.63), (0.18, 0.025, 0.055), hardware, bone, 0.018)
        foot = "Foot." + side
        box("Combat_Boot", (x, -0.02, 0.14), (0.34, 0.50, 0.20), rubber, foot, 0.07)
        box("Boot_Sole", (x, -0.03, 0.045), (0.35, 0.51, 0.055), hardware, foot, 0.018)

    # Keep each item rigidly attached to its anatomical joint. This preserves the source
    # skeleton's bind-space transforms and exports as ordinary joint child nodes in glTF.
    by_bone = {}
    for obj, bone in pieces:
        world = obj.matrix_world.copy()
        obj.parent = armature
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        obj.matrix_world = world
        by_bone.setdefault(bone, []).append(obj)
    # A mesh per joint keeps the draw count modest while retaining correct rigid attachment.
    for bone, objects in by_bone.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = "Operator_Gear_" + bone.replace(".", "_")


def clean_and_build(name):
    source = CHAR_DIR / f"{name}.glb"
    out = OUT_DIR / f"{name}_operator.glb"
    web_out = CHAR_DIR / f"{name}_operator.glb"
    fbx = OUT_DIR / f"{name}_operator.fbx"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mat_name in ("TacticalFabric", "PlateCarrier", "PouchCanvas", "HardArmor", "MetalHardware", "GoggleLens", "BootRubber"):
        existing = bpy.data.materials.get(mat_name)
        if existing:
            bpy.data.materials.remove(existing, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    arm = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
    body = next((o for o in bpy.context.scene.objects if o.type == "MESH" and o.parent == arm), None)
    assert arm and body, f"No rigged body found for {name}"
    # Discard source preview camera/light objects and the standalone unrigged preview sphere.
    for obj in list(bpy.context.scene.objects):
        if obj not in (arm, body) and obj.parent != arm and obj.parent != body and obj.type not in ("EMPTY",):
            bpy.data.objects.remove(obj, do_unlink=True)
    make_gear(arm)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in ("ARMATURE", "MESH", "EMPTY"):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", use_selection=True,
                              export_animations=True, export_skins=True, export_morph=False,
                              export_materials="EXPORT", export_apply=False, export_cameras=False,
                              export_lights=False)
    shutil.copy2(out, web_out)
    # FBX is the source for Unreal; animation takes are embedded for the same action set.
    bpy.ops.export_scene.fbx(filepath=str(fbx), use_selection=True, add_leaf_bones=False,
                             bake_anim=True, bake_anim_use_all_actions=True,
                             bake_anim_simplify_factor=0.0, mesh_smooth_type="FACE",
                             use_armature_deform_only=True, path_mode="COPY", embed_textures=True)
    print(f"[OV OPERATORS] wrote {web_out}, {out}, and {fbx}")


if __name__ == "__main__":
    for character in ("soldier_male", "soldier_female"):
        clean_and_build(character)
