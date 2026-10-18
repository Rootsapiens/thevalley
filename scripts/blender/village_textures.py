# Omega Valley -- village tileable PBR set, procedural Blender node materials baked to 1024^2.
# Rebuild (from project root):
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P scripts/blender/village_textures.py -- [--only name,name] [--res 1024]
#   then: node scripts/blender/encode-art.mjs   (writes public/art/*.jpg and prints sizes / palette dE / seam numbers)
# Seamless by construction: every noise/voronoi samples a 4D torus (cos/sin of u and v), every grid pattern uses an integer
# count per tile, and the normal map is a wrap-around Sobel of the baked height. Seam is also measured (art-src/tex/seams.json).
# Writes art-src/tex/<name>_albedo.png (sRGB), _normal.png (OpenGL +Y), _rough.png, _height.png, <name>-tile2x2.png.
# Albedo average is normalised to the palette-derived colour the game already uses for that surface (src/villageScene.ts COL).
import bpy, math, sys, os, json, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(n, d): return argv[argv.index(n) + 1] if n in argv else d
RES = int(arg('--res', '1024'))
ONLY = arg('--only', '')
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'art-src', 'tex'); os.makedirs(OUT, exist_ok=True)
TAU = 2 * math.pi

PAL = json.load(open(os.path.join(ROOT, 'studio', 'art', 'palette.json')))
def s2l(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def l2s(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)
def P(t): h = PAL[t]; return np.array([s2l(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)])
def mix(a, b, t, k=1.0): return (P(a) * (1 - t) + P(b) * t) * k

# Target averages (linear) = the flat colours villageScene.ts uses today, so swapping a texture in keeps the frame's balance.
TARGET = {
    'dirt-road': ('COL.mud', mix('rust', 'concreteDark', 0.62, 0.5)),
    'grass-dry': ('(COL.grassA+COL.grassB)/2', (mix('wallPaint', 'rust', 0.38, 0.5) + mix('wallPaint', 'hudAmber', 0.3, 0.46)) / 2),
    'wood-planks-barn': ('COL.timber', mix('rust', 'concrete', 0.55, 0.8)),
    'roof-tiles-red': ('mix(rust,emergencyRed,0.3)*0.8', mix('rust', 'emergencyRed', 0.3, 0.8)),
    'stone-wall': ('COL.stone', mix('concrete', 'sodium', 0.1, 0.95)),
    'hay': ('mix(sodium,concrete,0.55)*0.75 (COL.hay #BC9057 is dE 28.8 off-palette)', mix('sodium', 'concrete', 0.55, 0.75)),
    'fence-wood': ('COL.timberDark', mix('rust', 'hazardBlack', 0.45, 1.05)),
}
NORMAL_K = {'dirt-road': 3.0, 'grass-dry': 2.0, 'wood-planks-barn': 3.0, 'roof-tiles-red': 4.0, 'stone-wall': 5.0, 'hay': 2.5, 'fence-wood': 2.5}

sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 8; sc.cycles.use_denoising = False
bpy.ops.mesh.primitive_plane_add(size=1)
PLANE = bpy.context.object
bpy.context.view_layer.objects.active = PLANE; PLANE.select_set(True)

class NB:
    def __init__(s, t): s.t, s.n, s.l = t, t.nodes, t.links
    def node(s, typ, **kw):
        n = s.n.new(typ)
        for k, v in kw.items(): setattr(n, k, v)
        return n
    def _in(s, node, i, v):
        if isinstance(v, bpy.types.NodeSocket): s.l.new(v, node.inputs[i])
        elif v is not None: node.inputs[i].default_value = v
    def m(s, op, a, b=None, c=None):
        n = s.node('ShaderNodeMath', operation=op); s._in(n, 0, a)
        if b is not None: s._in(n, 1, b)
        if c is not None: s._in(n, 2, c)
        return n.outputs[0]
    def comb(s, x, y, z):
        n = s.node('ShaderNodeCombineXYZ'); s._in(n, 0, x); s._in(n, 1, y); s._in(n, 2, z); return n.outputs[0]
    def ss(s, a, b, x):
        n = s.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP'); s._in(n, 0, x)
        n.inputs[1].default_value = a; n.inputs[2].default_value = b; return n.outputs[0]
    def lerp(s, f, a, b): return s.m('ADD', a, s.m('MULTIPLY', f, s.m('SUBTRACT', b, a)))
    def mixc(s, f, a, b, blend='MIX'):
        n = s.node('ShaderNodeMix', data_type='RGBA', blend_type=blend); s._in(n, 0, f)
        s._in(n, 6, a if isinstance(a, bpy.types.NodeSocket) else (*a, 1.0)); s._in(n, 7, b if isinstance(b, bpy.types.NodeSocket) else (*b, 1.0))
        return n.outputs[2]
    def torus(s, u, v, nu, nv, off=0.0):
        """Periodic 4D embedding of (u, v): nu, nv = feature counts per tile along u and v."""
        au, av = s.m('MULTIPLY', u, TAU), s.m('MULTIPLY', v, TAU)
        ru, rv = nu / TAU, nv / TAU
        vec = s.comb(s.m('MULTIPLY_ADD', s.m('COSINE', au), ru, off), s.m('MULTIPLY', s.m('SINE', au), ru), s.m('MULTIPLY_ADD', s.m('COSINE', av), rv, off * 0.7))
        w = s.m('MULTIPLY', s.m('SINE', av), rv)
        return vec, w
    def noise(s, u, v, nu, nv, off=0.0, detail=4.0, rough=0.5, distort=0.0):
        vec, w = s.torus(u, v, nu, nv, off)
        n = s.node('ShaderNodeTexNoise'); n.noise_dimensions = '4D'
        s.l.new(vec, n.inputs['Vector']); s.l.new(w, n.inputs['W'])
        n.inputs['Scale'].default_value = 1.0; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = distort
        return n.outputs['Fac']
    def voronoi(s, u, v, nu, nv, feature='F1', off=0.0, rnd=1.0):
        vec, w = s.torus(u, v, nu, nv, off)
        n = s.node('ShaderNodeTexVoronoi'); n.voronoi_dimensions = '4D'; n.feature = feature
        s.l.new(vec, n.inputs['Vector']); s.l.new(w, n.inputs['W']); n.inputs['Scale'].default_value = 1.0
        n.inputs['Randomness'].default_value = rnd
        return n
    def white(s, a, b=0.0):
        n = s.node('ShaderNodeTexWhiteNoise'); n.noise_dimensions = '2D'
        s.l.new(s.comb(a, b, 0.0) if isinstance(a, bpy.types.NodeSocket) or isinstance(b, bpy.types.NodeSocket) else None, n.inputs['Vector'])
        return n.outputs['Value']
    def cell(s, x, n):  # floor(x * n) mod n  -> periodic integer index
        return s.m('FLOORED_MODULO', s.m('FLOOR', s.m('MULTIPLY', x, n)), n)
    def fr(s, x, n): return s.m('FRACT', s.m('MULTIPLY', x, n))

# ---------------- builders: return (albedo colour socket, height 0..1 socket, roughness socket or None) ----------------
def dirt_road(nb, u, v):
    A = nb.noise(u, v, 3, 3, 0, 5, 0.55)
    B = nb.noise(u, v, 22, 22, 3, 4, 0.6)
    vo = nb.voronoi(u, v, 26, 26, 'F1', 7)
    peb = nb.m('MULTIPLY', nb.ss(0.3, 0.16, vo.outputs['Distance']), nb.ss(0.45, 0.6, nb.node_sep(vo.outputs['Color'])))
    wetn = nb.noise(u, v, 2, 2, 11, 3, 0.5)
    wet = nb.ss(0.56, 0.64, wetn)
    c = nb.mixc(nb.ss(0.3, 0.7, B), (0.26, 0.17, 0.11), (0.46, 0.34, 0.23))
    c = nb.mixc(nb.m('MULTIPLY', nb.ss(0.35, 0.68, A), 0.75), c, (0.17, 0.11, 0.07))
    c = nb.mixc(peb, c, (0.62, 0.57, 0.50))
    c = nb.mixc(nb.m('MULTIPLY', wet, 0.7), c, (0.06, 0.045, 0.04))
    h = nb.m('ADD', nb.m('ADD', nb.m('MULTIPLY', A, 0.45), nb.m('MULTIPLY', B, 0.25)), nb.m('MULTIPLY', peb, 0.3))
    h = nb.lerp(wet, h, 0.32)
    r = nb.lerp(wet, nb.m('ADD', 0.86, nb.m('MULTIPLY', B, 0.1)), 0.22)
    return c, h, r

def grass_dry(nb, u, v):
    layers = []
    for k, (nu, nv, off) in enumerate([(5, 64, 0), (64, 5, 4), (6, 56, 9), (56, 6, 13)]):
        uu = nb.m('ADD', u, v) if k == 2 else (nb.m('SUBTRACT', u, v) if k == 3 else u)
        layers.append(nb.ss(0.5, 0.72, nb.noise(uu, v, nu, nv, off, 3, 0.5, 0.6)))
    bl = layers[0]
    for L in layers[1:]: bl = nb.m('MAXIMUM', bl, L)
    clump = nb.noise(u, v, 5, 5, 21, 4, 0.5)
    soil = nb.ss(0.62, 0.72, nb.noise(u, v, 7, 7, 31, 3, 0.5))
    c = nb.mixc(clump, (0.20, 0.17, 0.08), (0.30, 0.25, 0.10))
    c = nb.mixc(nb.m('MULTIPLY', bl, 0.8), c, (0.46, 0.38, 0.17))
    c = nb.mixc(nb.m('MULTIPLY', soil, nb.m('SUBTRACT', 1, bl)), c, (0.14, 0.10, 0.07))
    h = nb.m('ADD', nb.m('MULTIPLY', bl, 0.6), nb.m('MULTIPLY', clump, 0.4))
    return c, h, None

def planks(nb, u, v):
    N = 8
    u = nb.m('ADD', u, 0.5 / N)          # wrap edge falls mid-board, not on a gap
    f = nb.fr(u, N); idx = nb.cell(u, N)
    r = nb.white(idx, 1.0); r2 = nb.white(idx, 2.0)
    gap = nb.m('SUBTRACT', 1, nb.m('MULTIPLY', nb.ss(0.0, 0.035, f), nb.ss(1.0, 0.965, f)))
    jv = nb.m('FRACT', nb.m('SUBTRACT', v, r2))
    joint = nb.m('SUBTRACT', 1, nb.m('MULTIPLY', nb.ss(0.0, 0.006, jv), nb.ss(1.0, 0.994, jv)))
    grain = nb.noise(u, v, 110, 2, 0, 6, 0.6, 1.5)
    # per-board offset of the grain so neighbours differ (boundaries are gaps, so this stays seamless)
    grain2 = nb.noise(u, nb.m('ADD', v, r), 70, 3, 5, 4, 0.55, 2.0)
    g = nb.m('MULTIPLY', nb.m('ADD', grain, grain2), 0.5)
    tone = nb.m('ADD', 0.78, nb.m('MULTIPLY', r, 0.44))
    base = nb.mixc(g, (0.40, 0.17, 0.09), (0.56, 0.28, 0.15))
    c = nb.node('ShaderNodeVectorMath', operation='SCALE'); nb._in(c, 0, base); nb._in(c, 3, tone); c = c.outputs[0]
    weather = nb.noise(u, v, 4, 6, 17, 3, 0.5)
    c = nb.mixc(nb.m('MULTIPLY', nb.ss(0.6, 0.8, weather), 0.18), c, (0.42, 0.36, 0.30))
    dark = nb.m('MAXIMUM', gap, nb.m('MULTIPLY', joint, 0.8))
    c = nb.mixc(dark, c, (0.05, 0.03, 0.02))
    h = nb.m('SUBTRACT', nb.m('ADD', 0.75, nb.m('MULTIPLY', g, 0.2)), nb.m('MULTIPLY', dark, 0.75))
    return c, h, None

def roof_tiles(nb, u, v):
    NC, NR = 8, 10
    u, v = nb.m('ADD', u, 0.5 / NC), nb.m('ADD', v, 0.5 / NR)   # wrap edges fall mid-tile
    fu, fv = nb.fr(u, NC), nb.fr(v, NR)
    ci, ri = nb.cell(u, NC), nb.cell(v, NR)
    r = nb.white(ci, nb.m('ADD', ri, 0.37))
    barrel = nb.m('POWER', nb.m('SINE', nb.m('MULTIPLY', fu, math.pi)), 0.6)
    ramp = nb.m('POWER', fv, 0.8)                     # each row rises under the next one: step at the lower edge (fv = 0)
    edge = nb.ss(0.0, 0.06, fv)                       # shadow line under the overlapping tile
    h = nb.m('ADD', nb.m('MULTIPLY', barrel, 0.55), nb.m('MULTIPLY', ramp, 0.4))
    h = nb.m('MULTIPLY', h, nb.m('ADD', 0.6, nb.m('MULTIPLY', edge, 0.4)))
    dirt = nb.noise(u, v, 6, 6, 3, 4, 0.55)
    c = nb.mixc(r, (0.33, 0.085, 0.04), (0.48, 0.16, 0.07))
    c = nb.mixc(nb.m('MULTIPLY', nb.ss(0.5, 0.75, dirt), 0.5), c, (0.17, 0.12, 0.08))
    lich = nb.ss(0.7, 0.78, nb.noise(u, v, 9, 9, 23, 4, 0.6))
    c = nb.mixc(nb.m('MULTIPLY', lich, 0.5), c, (0.30, 0.28, 0.17))
    shade = nb.m('MULTIPLY', nb.m('ADD', 0.35, nb.m('MULTIPLY', barrel, 0.65)), nb.m('ADD', 0.45, nb.m('MULTIPLY', edge, 0.55)))
    c = nb.mixc(shade, (0.04, 0.02, 0.015), c)
    return c, h, None

def stone_wall(nb, u, v):
    # dry-stone courses: 7 courses per tile, 4-6 stones per course (integer counts keep it periodic), edges warped by
    # periodic noise so the joints wander like hand-laid stone
    NR = 7
    wu = nb.m('MULTIPLY', nb.m('SUBTRACT', nb.noise(u, v, 6, 6, 31, 3, 0.5), 0.5), 0.07)
    wv = nb.m('MULTIPLY', nb.m('SUBTRACT', nb.noise(u, v, 6, 6, 37, 3, 0.5), 0.5), 0.05)
    uu, vv = nb.m('ADD', u, wu), nb.m('ADD', v, nb.m('ADD', wv, 0.5 / NR))   # wrap edge mid-course
    row = nb.cell(vv, NR); fv = nb.fr(vv, NR)
    off = nb.white(row, 0.3)
    K = nb.m('ADD', 4.0, nb.m('FLOOR', nb.m('MULTIPLY', nb.white(row, 0.7), 2.999)))
    ux = nb.m('MULTIPLY', nb.m('ADD', uu, off), K)
    fu = nb.m('FRACT', ux); si = nb.m('FLOORED_MODULO', nb.m('FLOOR', ux), K)
    du = nb.m('DIVIDE', nb.m('MINIMUM', fu, nb.m('SUBTRACT', 1, fu)), K)
    dv = nb.m('DIVIDE', nb.m('MINIMUM', fv, nb.m('SUBTRACT', 1, fv)), NR)
    chip = nb.m('MULTIPLY', nb.m('SUBTRACT', nb.noise(u, v, 40, 40, 41, 3, 0.5), 0.5), 0.012)
    e = nb.m('ADD', nb.m('MINIMUM', du, dv), chip)
    rnd = nb.white(nb.m('ADD', si, nb.m('MULTIPLY', row, 7.0)), 0.11)
    gap = nb.ss(0.008, 0.003, e)
    dome = nb.ss(0.0, 0.06, e)
    surf = nb.noise(u, v, 30, 30, 5, 5, 0.6)
    lich = nb.ss(0.68, 0.76, nb.noise(u, v, 10, 10, 9, 4, 0.6))
    c = nb.mixc(rnd, (0.36, 0.33, 0.28), (0.52, 0.47, 0.40))
    c = nb.mixc(nb.m('MULTIPLY', surf, 0.5), c, (0.28, 0.25, 0.22))
    c = nb.mixc(nb.m('MULTIPLY', lich, 0.45), c, (0.38, 0.36, 0.22))
    c = nb.mixc(gap, c, (0.03, 0.025, 0.02))
    h = nb.m('MULTIPLY', nb.m('ADD', nb.m('MULTIPLY', dome, 0.8), nb.m('MULTIPLY', surf, 0.2)), nb.m('SUBTRACT', 1, nb.m('MULTIPLY', gap, 0.9)))
    return c, h, None

def hay(nb, u, v):
    bl = None
    for k, (sk, nu, nv, off) in enumerate([(0, 4, 90, 0), (1, 5, 80, 3), (-1, 5, 80, 7), (2, 6, 70, 11), (-2, 6, 70, 15)]):
        uu = u if sk == 0 else nb.m('ADD', u, nb.m('MULTIPLY', v, sk))
        L = nb.ss(0.52, 0.7, nb.noise(v if k % 2 else uu, uu if k % 2 else v, nu, nv, off, 2, 0.5, 0.4))
        bl = L if bl is None else nb.m('MAXIMUM', bl, nb.m('MULTIPLY', L, 0.9 - 0.08 * k))
    clump = nb.noise(u, v, 6, 6, 19, 3, 0.5)
    c = nb.mixc(clump, (0.30, 0.22, 0.09), (0.42, 0.33, 0.14))
    c = nb.mixc(bl, (0.10, 0.07, 0.03), c)
    c = nb.mixc(nb.m('MULTIPLY', nb.ss(0.75, 1.0, bl), 0.5), c, (0.62, 0.52, 0.26))
    h = nb.m('ADD', nb.m('MULTIPLY', bl, 0.75), nb.m('MULTIPLY', clump, 0.25))
    return c, h, None

def fence_wood(nb, u, v):
    grain = nb.noise(u, v, 3, 120, 0, 6, 0.6, 2.0)     # rails run along u
    fine = nb.noise(u, v, 8, 300, 4, 3, 0.5, 0.5)
    crack = nb.ss(0.035, 0.0, nb.m('ABSOLUTE', nb.m('SUBTRACT', nb.noise(u, v, 2, 26, 8, 3, 0.5, 1.0), 0.5)))
    vo = nb.voronoi(u, v, 4, 5, 'F1', 13)
    knot = nb.m('MULTIPLY', nb.ss(0.14, 0.04, vo.outputs['Distance']), nb.ss(0.75, 0.85, nb.node_sep(vo.outputs['Color'])))
    weather = nb.noise(u, v, 3, 5, 21, 3, 0.5)
    c = nb.mixc(nb.m('MULTIPLY', nb.m('ADD', grain, fine), 0.5), (0.16, 0.08, 0.05), (0.28, 0.17, 0.11))
    c = nb.mixc(nb.m('MULTIPLY', nb.ss(0.45, 0.7, weather), 0.6), c, (0.30, 0.27, 0.24))   # silver weathering
    c = nb.mixc(nb.m('MAXIMUM', crack, knot), c, (0.04, 0.025, 0.02))
    h = nb.m('SUBTRACT', nb.m('ADD', 0.6, nb.m('MULTIPLY', grain, 0.3)), nb.m('MULTIPLY', nb.m('MAXIMUM', crack, nb.m('MULTIPLY', knot, 0.5)), 0.6))
    return c, h, None

def _sep(self, col):
    n = self.node('ShaderNodeSeparateColor'); self.l.new(col, n.inputs[0]); return n.outputs[0]
NB.node_sep = _sep

BUILD = {'dirt-road': dirt_road, 'grass-dry': grass_dry, 'wood-planks-barn': planks, 'roof-tiles-red': roof_tiles,
         'stone-wall': stone_wall, 'hay': hay, 'fence-wood': fence_wood}

def bake(name, builder):
    m = bpy.data.materials.new(name); nt = m.node_tree; nt.nodes.clear(); nb = NB(nt)
    out = nb.node('ShaderNodeOutputMaterial')
    tc = nb.node('ShaderNodeTexCoord'); sp = nb.node('ShaderNodeSeparateXYZ'); nb.l.new(tc.outputs['UV'], sp.inputs[0])
    col, h, r = builder(nb, sp.outputs[0], sp.outputs[1])
    em = nb.node('ShaderNodeEmission'); nb.l.new(em.outputs[0], out.inputs['Surface'])
    img = bpy.data.images.new(name + '_bake', RES, RES, float_buffer=True, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    tn = nb.node('ShaderNodeTexImage'); tn.image = img; nt.nodes.active = tn
    PLANE.data.materials.clear(); PLANE.data.materials.append(m)
    res = {}
    for key, sock in (('albedo', col), ('height', h), ('rough', r)):
        if sock is None: continue
        for l in list(em.inputs[0].links): nt.links.remove(l)
        nt.links.new(sock, em.inputs[0])
        bpy.ops.object.bake(type='EMIT', margin=0)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(RES, RES, 4)[:, :, :3].copy()
        res[key] = px
    return res

def save_png(path, rgb01):
    hgt, wid = rgb01.shape[:2]
    im = bpy.data.images.new('out', wid, hgt, alpha=False, float_buffer=False)
    im.colorspace_settings.name = 'Non-Color'
    q = np.round(np.clip(rgb01, 0, 1) * 255) / 255
    rgba = np.concatenate([q, np.ones((hgt, wid, 1), np.float32)], -1).astype(np.float32)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

def seam_ratio(a):
    """Seam test on both axes. For each axis: the mean |diff| of the wrap pair (last->first column/row) and its percentile
    among all interior neighbour pairs. A real seam lands at the 100th percentile; a seamless tile sits mid-distribution.
    Returns (pct_u, pct_v, ratio_u, ratio_v) with ratio = wrap diff / median interior pair diff."""
    a = a.astype(np.float64)
    out = []
    for ax in (1, 0):
        b = np.moveaxis(a, ax, 0)                    # pairs along this axis
        pairs = np.abs(np.diff(b, axis=0)).reshape(b.shape[0] - 1, -1).mean(1)
        wrap = np.abs(b[0] - b[-1]).mean()
        out.append((float((pairs < wrap).mean() * 100), float(wrap / np.median(pairs))))
    return out[0][0], out[1][0], out[0][1], out[1][1]

report = {}
names = [n for n in BUILD if not ONLY or n in ONLY.split(',')]
for name in names:
    t = time.time()
    r = bake(name, BUILD[name])
    alb = r['albedo']
    label, tgt = TARGET[name]
    mean = alb.reshape(-1, 3).mean(0)
    alb = np.clip(alb * (tgt / np.maximum(mean, 1e-6)), 0, 1)        # average == palette-derived target
    alb_s = l2s(alb)
    h = r['height'][:, :, 0]; h = (h - h.min()) / max(1e-6, h.max() - h.min())
    k = NORMAL_K[name]
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * k * (RES / 256)
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * k * (RES / 256)
    n = np.stack([-dx, -dy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    nrm = n * 0.5 + 0.5
    # Blender pixel rows run bottom-up; flip once so PNG row 0 = top (v = 1)
    flip = lambda a: a[::-1]
    save_png(os.path.join(OUT, f'{name}_albedo.png'), flip(alb_s))
    save_png(os.path.join(OUT, f'{name}_normal.png'), flip(nrm))
    save_png(os.path.join(OUT, f'{name}_height.png'), flip(np.repeat(h[:, :, None], 3, -1)))
    if 'rough' in r: save_png(os.path.join(OUT, f'{name}_rough.png'), flip(np.clip(r['rough'], 0, 1)))
    save_png(os.path.join(OUT, f'{name}-tile2x2.png'), np.tile(flip(alb_s), (2, 2, 1)))
    q8 = np.round(alb_s * 255)
    su, sv, sru, srv = seam_ratio(q8)
    nu, nv, nru, nrv = seam_ratio(np.round(nrm * 255))
    report[name] = dict(target=label, target_srgb='#' + ''.join(f'{int(round(float(x) * 255)):02X}' for x in l2s(tgt)),
                        seam_pct_albedo=[round(su, 1), round(sv, 1)], seam_ratio_albedo=[round(sru, 2), round(srv, 2)], seam_pct_normal=[round(nu, 1), round(nv, 1)], seam_ratio_normal=[round(nru, 2), round(nrv, 2)],
                        bake_s=round(time.time() - t, 1), rough='rough' in r)
    print('TEX', name, json.dumps(report[name]))
old = {}
jp = os.path.join(OUT, 'seams.json')
if os.path.exists(jp): old = json.load(open(jp))
old.update(report); json.dump(old, open(jp, 'w'), indent=1)
