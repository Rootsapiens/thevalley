# blender -b -P convert.py -- <repo_root> [out_name ...]
# Imports glTF/GLB DATA only (nothing from the packs is executed), decimates, keeps only the base-colour
# texture (shrunk), recentres the origin, exports GLB (meters, +Y up, front faces +Z).
import bpy, sys, os, json, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
root = argv[0]
only = set(argv[1:])
spec = json.load(open(os.path.join(root, 'scripts/models/spec.json'), encoding='utf-8'))
outdir = os.path.join(root, 'public/models')
os.makedirs(outdir, exist_ok=True)
report = {}


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def simplify_materials(texmax, color):
    for mat in list(bpy.data.materials):
        if not mat.use_nodes:
            continue
        nt = mat.node_tree
        low = mat.name.lower()
        for n in list(nt.nodes):
            if n.type != 'BSDF_PRINCIPLED':
                continue
            for sock in ('Normal', 'Metallic', 'Roughness'):
                for l in list(n.inputs[sock].links):
                    nt.links.remove(l)
            is_metal = any(k in low for k in ('brass', 'metal', 'iron', 'steel'))
            n.inputs['Metallic'].default_value = 0.6 if is_metal else 0.0
            n.inputs['Roughness'].default_value = 0.45 if is_metal else 0.85
            if color:
                for l in list(n.inputs['Base Color'].links):
                    nt.links.remove(l)
                n.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1)
            if 'glass' in low:
                for s in ('Base Color', 'Alpha'):
                    for l in list(n.inputs[s].links):
                        nt.links.remove(l)
                n.inputs['Base Color'].default_value = (0.85, 0.9, 0.88, 1)
                n.inputs['Alpha'].default_value = 0.25
                n.inputs['Roughness'].default_value = 0.1
            if 'flame' in low:
                for s in ('Base Color', 'Alpha'):
                    for l in list(n.inputs[s].links):
                        nt.links.remove(l)
                n.inputs['Base Color'].default_value = (1, 0.6, 0.15, 1)
                n.inputs['Emission Color'].default_value = (1, 0.55, 0.1, 1)
                n.inputs['Emission Strength'].default_value = 3.0
        for _ in range(3):
            for n in list(nt.nodes):
                if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'SEPARATE_COLOR', 'SEPARATE_RGB', 'MIX', 'MATH', 'MAPPING', 'TEX_COORD') \
                        and not any(o.links for o in n.outputs):
                    nt.nodes.remove(n)
    for img in bpy.data.images:
        if not img.size[0] or img.users == 0:
            continue
        if max(img.size) > texmax:
            s = texmax / max(img.size)
            img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))


def bounds(meshes):
    mn = mathutils.Vector((1e9,) * 3)
    mx = mathutils.Vector((-1e9,) * 3)
    for o in meshes:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i])
                mx[i] = max(mx[i], w[i])
    return mn, mx


def apply_all(meshes):
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


for e in spec:
    name = e['out']
    if only and name not in only:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kind, ident = e['src'].split(':')
    if kind == 'ph':
        path = os.path.join(root, 'art-src/models/polyhaven', ident, ident + '_1k.gltf')
    else:
        path = os.path.join(root, 'art-src/models/kenney/furniture-kit/x/Models/GLTF format', ident + '.glb')
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    apply_all(meshes)
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    tot0 = sum(tris_of(o) for o in meshes)
    budget = e.get('tris', 5000)
    if tot0 > budget:
        r = budget / tot0
        for o in meshes:
            m = o.modifiers.new('dec', 'DECIMATE')
            m.ratio = max(0.01, r)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='dec')
    mn, mx = bounds(meshes)
    if 'h' in e or 's' in e:
        s = e['s'] if 's' in e else e['h'] / (mx.z - mn.z)
        for o in meshes:
            o.scale = (s, s, s)
        apply_all(meshes)
        mn, mx = bounds(meshes)
    cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    origin = e.get('origin', 'floor')
    if origin == 'floor':
        off = mathutils.Vector((cx, cy, mn.z))
    elif origin == 'top':
        off = mathutils.Vector((cx, cy, mx.z))
    else:  # back-face centre (Blender +Y is glTF -Z = back)
        off = mathutils.Vector((cx, mx.y, (mn.z + mx.z) / 2))
    for o in meshes:
        o.location -= off
    apply_all(meshes)
    mn, mx = bounds(meshes)
    simplify_materials(e.get('tex', 512), e.get('color'))
    fp = os.path.join(outdir, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=fp, export_format='GLB', export_yup=True, export_apply=True,
                              export_image_format='JPEG', export_jpeg_quality=72, export_materials='EXPORT',
                              export_cameras=False, export_lights=False, export_extras=False)
    t1 = sum(tris_of(o) for o in meshes)
    report[name] = {'src': e['src'], 'room': e['room'], 'tris0': tot0, 'tris': t1,
                    'w': round(mx.x - mn.x, 3), 'd': round(mx.y - mn.y, 3), 'h': round(mx.z - mn.z, 3),
                    'bytes': os.path.getsize(fp)}
    print('DONE', name, report[name])

rp = 'last-report-part.json' if only else 'last-report.json'
json.dump(report, open(os.path.join(root, 'scripts/models', rp), 'w'), indent=1)
