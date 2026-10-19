# blender -b -P contact_sheet.py -- <repo_root> <out_png>   (preview only, not shipped)
import bpy, sys, os, glob, math
a = sys.argv[sys.argv.index('--') + 1:]
root, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
files = sorted(glob.glob(os.path.join(root, 'public/models/*.glb')))
cols = 9
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    meshes = [o for o in new if o.type == 'MESH']
    mx = max(max(o.dimensions) for o in meshes) or 1
    sc = 1.0 / mx if 'rug' not in f else 1.0 / mx
    for r in roots:
        r.scale = (sc, sc, sc)
        r.location = ((i % cols) * 1.4, -(i // cols) * 1.4, 0)
    print('CELL', i, os.path.basename(f))
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = 2200
rows = (len(files) + cols - 1) // cols
sc.render.resolution_y = int(2200 * (rows * 1.4) / (cols * 1.4))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = cols * 1.4 + 0.2
cx = (cols - 1) * 0.7
cy = -(rows - 1) * 0.7
# look from front-above at 35 degrees, front = +Y in Blender's -Y... camera on -Y side
ang = math.radians(60)
cam.rotation_euler = (ang, 0, 0)
d = 30
cam.location = (cx, cy - d * math.sin(ang), d * math.cos(ang))
sc.camera = cam
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
