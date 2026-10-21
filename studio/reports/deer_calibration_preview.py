"""Offline deer scale/contact preview; run with Blender 5.2, never imported by game."""
import bpy
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-incoming/nidal-hall-animals/quaternius-deer.glb'
OUT = Path(__file__).with_name('aktham-deer-calibration.png')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
deps = bpy.context.evaluated_depsgraph_get()

def bounds():
    corners = []
    for ob in meshes:
        eo = ob.evaluated_get(deps)
        em = eo.to_mesh()
        corners.extend(eo.matrix_world @ v.co for v in em.vertices)
        eo.to_mesh_clear()
    return tuple(min(p[i] for p in corners) for i in range(3)), tuple(max(p[i] for p in corners) for i in range(3))

raw_min, raw_max = bounds()
print('DEER_RAW_BOUNDS', raw_min, raw_max)
# Blender imports glTF as Z-up. Use a tentative 1.65 m full visible height.
scale = 1.65 / (raw_max[2] - raw_min[2])
roots = [o for o in bpy.context.scene.objects if o.parent is None]
for root in roots:
    root.scale *= scale
bpy.context.view_layer.update()
scaled_min, scaled_max = bounds()
for root in roots:
    root.location.z -= scaled_min[2]
bpy.context.view_layer.update()
placed_min, placed_max = bounds()
print('DEER_SCALE', scale)
print('DEER_PLACED_BOUNDS', placed_min, placed_max)

# Neutral Hall-like display context, intentionally not a copy of runtime Hall.
def cube(name, location, size, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new(name + ' material')
    mat.diffuse_color = (*color, 1)
    ob.data.materials.append(mat)
    return ob

cube('stone display floor', (0, 0, -0.05), (6, 5, 0.1), (0.35, 0.34, 0.30))
cube('Hall backdrop', (0, 2.0, 1.6), (6, 0.1, 3.2), (0.48, 0.42, 0.32))
cube('contact ruler 1m', (1.55, 0, 0.5), (0.035, 0.035, 1), (0.92, 0.72, 0.20))
for height in (0, 0.5, 1):
    cube('ruler tick', (1.55, -0.04, height + 0.005), (0.22, 0.035, 0.015), (0.92, 0.72, 0.20))

bpy.ops.object.camera_add(location=(4.3, -6.0, 2.5))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 0.9)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
bpy.ops.object.light_add(type='AREA', location=(-3, -3, 5))
bpy.context.object.data.energy = 900
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 5
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1000
scene.render.resolution_y = 750
scene.render.resolution_percentage = 100
scene.world.color = (0.45, 0.45, 0.45)
scene.render.filepath = str(OUT)
bpy.ops.render.render(write_still=True)
