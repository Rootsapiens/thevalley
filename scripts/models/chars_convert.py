# blender -b -P chars_convert.py -- <repo_root> [Name ...]
# Imports Quaternius Ultimate Animated Character Pack FBX (data only), renames/prunes clips, adds "run"
# (walk keys compressed 1.6x in time; the pack has no run clip), rescales to real height, sets a skin tone,
# exports GLB to public/models/characters/ (m, +Y up, <=15k tris).
import bpy, sys, os, json, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
root = argv[0]
# target height (m, incl. hat/hair) and skin tone (sRGB 0-255) per character
TARGET = {'Soldier_Male': (1.85, (141, 95, 66)), 'Soldier_Female': (1.72, (224, 172, 138)),
          'Worker_Male': (1.78, (198, 140, 96)), 'Worker_Female': (1.66, (112, 72, 50)),
          'Cowboy_Male': (1.80, (234, 190, 150)), 'OldClassy_Female': (1.62, (214, 165, 130))}
NAMES = argv[1:] or list(TARGET)
src = os.path.join(root, 'art-src/models/characters/quaternius-uacp/x/Ultimate Animated Character Pack - Nov 2019/FBX')
out = os.path.join(root, 'public/models/characters')
os.makedirs(out, exist_ok=True)
KEEP = {'Idle': 'idle', 'Walk': 'walk', 'Shoot_OneHanded': 'shoot', 'Defeat': 'death', 'RecieveHit': 'hit',
        'Punch': 'punch', 'Walk_Carry': 'walk_carry'}
report = {}


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


for name in NAMES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(src, name + '.fbx'))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    for a in list(bpy.data.actions):
        short = a.name.split('|')[-1]
        if short in KEEP:
            a.name = KEEP[short]
        else:
            bpy.data.actions.remove(a)
    run = bpy.data.actions['walk'].copy()
    run.name = 'run'
    nfc = 0
    for layer in run.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    nfc += 1
                    for kp in fc.keyframe_points:
                        kp.co.x = 1 + (kp.co.x - 1) / 1.6
                        kp.handle_left.x = 1 + (kp.handle_left.x - 1) / 1.6
                        kp.handle_right.x = 1 + (kp.handle_right.x - 1) / 1.6
    assert nfc > 0, 'run clip: no fcurves found'
    for a in bpy.data.actions:
        a.use_fake_user = True
    for m in bpy.data.materials:  # FBX import leaves base-colour alpha 0 -> glTF MASK discards everything
        if m.use_nodes and "Principled BSDF" in m.node_tree.nodes:
            bsdf = m.node_tree.nodes["Principled BSDF"]
            c = bsdf.inputs["Base Color"].default_value
            bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)
            bsdf.inputs["Alpha"].default_value = 1.0
            m.blend_method = "OPAQUE" if hasattr(m, "blend_method") else None
    skin = bpy.data.materials.get("Skin")
    skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = tuple(lin(c) for c in TARGET[name][1]) + (1,)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions['idle']

    def height():
        bpy.context.view_layer.update()
        ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        zs = [(mesh.matrix_world @ mathutils.Vector(c)).z for c in ev.bound_box]
        return max(zs) - min(zs)

    f = TARGET[name][0] / height()
    root_empty = bpy.data.objects.new("Root", None)
    bpy.context.scene.collection.objects.link(root_empty)
    arm.parent = root_empty
    root_empty.scale = (f, f, f)
    h = height()
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    path = os.path.join(out, name.lower() + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=True, export_apply=False,
                              export_image_format='JPEG', export_materials='EXPORT')
    report[name] = dict(tris=tris, height_m=round(h, 3), clips=sorted(a.name for a in bpy.data.actions),
                        bytes=os.path.getsize(path), scale=round(f, 4),
                        mats=[m.name for m in mesh.data.materials if m])
    print('REPORT', name, json.dumps(report[name]))
json.dump(report, open(os.path.join(root, 'scripts/models/chars-report.json'), 'w'), indent=1)
