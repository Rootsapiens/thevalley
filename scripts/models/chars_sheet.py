# blender -b -P chars_sheet.py -- <repo_root> <out.png> : front-view contact sheet of public/models/characters/*.glb (workbench)
import bpy, sys, os, glob, math
root, outp = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
files = sorted(glob.glob(os.path.join(root, 'public/models/characters/*.glb')))
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    for o in [x for x in new if x.name.startswith("Icosphere")]:  # glTF importer bone-shape helper
        bpy.data.objects.remove(o)
    for o in [x for x in bpy.data.objects if x not in before and x.parent is None]:
            o.location.x = (i - (len(files) - 1) / 2) * 1.2
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
bpy.context.scene.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 8.4
cam.location = (0, -10, 0.95)
cam.rotation_euler = (math.radians(90), 0, 0)
s = bpy.context.scene
s.camera = cam
s.render.engine = 'BLENDER_EEVEE'
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (math.radians(60), 0, math.radians(-25)); s.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.28, 0.32, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
s.display.shading.light = 'STUDIO'
s.display.shading.color_type = 'MATERIAL'

s.view_settings.view_transform = 'Standard'
s.render.film_transparent = False
s.render.resolution_x, s.render.resolution_y = 1600, 420
s.render.filepath = outp
bpy.ops.render.render(write_still=True)
import mathutils
dg = bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type == 'MESH':
        ev = o.evaluated_get(dg)
        c = [o.matrix_world @ mathutils.Vector(v) for v in ev.bound_box]
        print('BB', o.name, tuple(round(x, 2) for x in c[0]), tuple(round(x, 2) for x in c[6]), o.hide_render, o.hide_viewport, o.visible_get(), [u.name for u in o.users_collection])
