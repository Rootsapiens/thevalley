# blender -b -P chars_inspect.py -- <fbx> : prints actions, tris, bbox, materials (data import only)
import bpy, sys
f = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
(bpy.ops.import_scene.gltf(filepath=f) if f.lower().endswith(("glb","gltf")) else bpy.ops.import_scene.fbx(filepath=f))
print('ACTIONS', [(a.name, tuple(round(x) for x in a.frame_range)) for a in bpy.data.actions])
for o in bpy.data.objects:
    extra = ''
    if o.type == 'MESH':
        extra = 'tris=%d mats=%s dims=%s' % (sum(len(p.vertices)-2 for p in o.data.polygons), [m.name for m in o.data.materials if m], tuple(round(x,2) for x in o.dimensions))
    print('OBJ', o.type, o.name, tuple(round(x,3) for x in o.scale), extra)
print('IMAGES', [(i.name, tuple(i.size)) for i in bpy.data.images])
