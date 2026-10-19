# blender -b -P chars_ual.py -- <repo_root>
# Quaternius Universal Animation Library (Standard, Godot GLB): keeps the 1.83 m mannequin + the clips we need,
# renamed idle/walk/run/sprint/aim/shoot/death/hit, exports public/models/characters/mannequin.glb. Data import only.
import bpy, os, sys, json
root = sys.argv[sys.argv.index('--') + 1]
src = os.path.join(root, 'art-src/models/characters/quaternius-ual/x/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb')
KEEP = {'Idle_Loop': 'idle', 'Walk_Loop': 'walk', 'Jog_Fwd_Loop': 'run', 'Sprint_Loop': 'sprint', 'Pistol_Idle_Loop': 'aim',
        'Pistol_Shoot': 'shoot', 'Death01': 'death', 'Hit_Chest': 'hit', 'Crouch_Idle_Loop': 'crouch'}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in [o for o in bpy.data.objects if o.name.startswith('Icosphere')]:
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    if a.name in KEEP:
        a.name = KEEP[a.name]
    else:
        bpy.data.actions.remove(a)
for a in bpy.data.actions:
    a.use_fake_user = True
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
for m in mesh.data.materials:
    if m and m.use_nodes:
        b = m.node_tree.nodes.get('Principled BSDF')
        if b:
            b.inputs['Alpha'].default_value = 1.0
            b.inputs['Base Color'].default_value = {'M_Main': (0.30, 0.27, 0.20, 1), 'M_Joints': (0.05, 0.05, 0.05, 1)}.get(m.name, b.inputs['Base Color'].default_value)  # neutral khaki + dark joints, game tints M_Main per team
path = os.path.join(root, 'public/models/characters/mannequin.glb')
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True, export_image_format='JPEG')
print('REPORT', json.dumps(dict(tris=sum(len(p.vertices) - 2 for p in mesh.data.polygons), bytes=os.path.getsize(path),
      clips=sorted(a.name for a in bpy.data.actions), mats=[m.name for m in mesh.data.materials if m],
      colors={m.name: [round(x, 3) for x in m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value] for m in mesh.data.materials if m and m.use_nodes})))
