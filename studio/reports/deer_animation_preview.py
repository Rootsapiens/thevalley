"""Offline Blender 5.2 deer Idle frame/contact inspection; never loaded by game."""
import bpy
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'art-incoming/nidal-hall-animals/quaternius-deer.glb'))
scene = bpy.context.scene
arm = bpy.data.objects['AnimalArmature']
mesh = bpy.data.objects['Deer']
root = bpy.data.objects['RootNode']
for track in arm.animation_data.nla_tracks:
    track.mute = True
arm.animation_data.action = bpy.data.actions['Idle']
scale = 0.3149539229
root.scale *= scale
bpy.context.view_layer.update()

def sample(frame):
    scene.frame_set(frame)
    deps = bpy.context.evaluated_depsgraph_get()
    ob = mesh.evaluated_get(deps)
    em = ob.to_mesh()
    coords = [ob.matrix_world @ v.co for v in em.vertices]
    ob.to_mesh_clear()
    low = sorted(coords, key=lambda p: p.z)[:12]
    contacts = {name: round(min(p.z for p in coords if x(p) and y(p)), 5)
                for name, x, y in (
                    ('front-left', lambda p: p.x < 0, lambda p: p.y > 0.2),
                    ('front-right', lambda p: p.x >= 0, lambda p: p.y > 0.2),
                    ('rear-left', lambda p: p.x < 0, lambda p: p.y < -0.4),
                    ('rear-right', lambda p: p.x >= 0, lambda p: p.y < -0.4))}
    return (tuple(round(min(p[i] for p in coords), 5) for i in range(3)),
            tuple(round(max(p[i] for p in coords), 5) for i in range(3)),
            [(round(p.x, 4), round(p.y, 4), round(p.z, 5)) for p in low[:6]],
            contacts,
            tuple(round(v, 5) for v in arm.matrix_world.translation),
            tuple(round(v, 5) for v in root.matrix_world.translation))

for frame in (0, 20, 40, 60, 80):
    print('DEER_IDLE_SAMPLE', frame, sample(frame))

# Establish a fixed floor from the first frame, without correcting later frames.
scene.frame_set(0)
first_min = sample(0)[0][2]
root.location.z -= first_min
bpy.context.view_layer.update()
for frame in (0, 20, 40, 60, 80):
    print('DEER_IDLE_FLOOR_SAMPLE', frame, sample(frame))

def cube(name, location, size, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new(name + ' material')
    mat.diffuse_color = (*color, 1)
    ob.data.materials.append(mat)

cube('reference floor', (0, 0, -0.05), (5, 5, 0.1), (0.35, 0.34, 0.30))
cube('reference backdrop', (0, 2, 1.6), (5, 0.1, 3.2), (0.48, 0.42, 0.32))
cube('1m ruler', (1.4, 0, 0.5), (0.035, 0.035, 1), (0.92, 0.72, 0.20))
bpy.ops.object.camera_add(location=(4.1, -5.5, 2.4))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 0.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam
bpy.ops.object.light_add(type='AREA', location=(-3, -3, 5))
bpy.context.object.data.energy = 900
bpy.context.object.data.size = 5
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 800
scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
scene.world.color = (0.45, 0.45, 0.45)
scene.frame_set(40)
scene.render.filepath = str(Path(__file__).with_name('aktham-deer-idle-frame40.png'))
bpy.ops.render.render(write_still=True)
