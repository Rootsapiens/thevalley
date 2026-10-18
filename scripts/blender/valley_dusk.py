# Omega Valley -- "valley-dusk" backdrop: 3D blockout of the valley rendered in Cycles, painterly via compositor.
# Rebuild (from project root):
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P scripts/blender/valley_dusk.py -- \
#       --mode key|pano|both [--pct 100] [--samples 48] [--out art-src]
#   then: node scripts/blender/encode-art.mjs   (crops the panorama overscan, writes public/art/*.jpg, prints numbers)
# Outputs (art-src/): valley-dusk-key.png 1920x1080, valley-sky-overscan.png 4224x2048 (4096 + 64 px wrap margin per side).
#
# World frame: Blender X = east, Y = north, Z = up, metres, origin = the farmer's barn (game spawn area), village ground ~0.
# Game frame (three.js): x = east, y = up, z = south  ->  game(x, y, z) = blender(x, z, -y).
# Compass per studio/world/decisions-noor.md: sun bearing 240 deg, elevation 4 deg, warm ~2000 K; mountain + cave at 45 deg.
# Angular sizes follow src/villageScene.ts silhouettes: peak ~17.5 deg up, cave arch 1.47 deg wide with its sill ~5.6 deg up.
# Sky/fog formulas mirror villageScene.ts skyColor()/fogAt() with the same palette-derived constants.
# Panorama layout = standard equirect, matches three.js EquirectangularReflectionMapping:
#   u = ((bearing - 270) mod 360) / 360  (W at u=0, N at 0.25, E at 0.5, S at 0.75), horizon at v = 0.5.
import bpy, math, sys, time, json, os
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default
MODE = arg('--mode', 'both')
PCT = int(arg('--pct', '100'))
SAMPLES = int(arg('--samples', '48'))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, arg('--out', 'art-src'))
os.makedirs(OUT, exist_ok=True)

deg = math.pi / 180
SUN_B, SUN_E = 240.0, 4.0
MTN_B = 45.0
def bdir(b, e=0.0):
    return np.array([math.sin(b * deg) * math.cos(e * deg), math.cos(b * deg) * math.cos(e * deg), math.sin(e * deg)])
SUN_DIR = bdir(SUN_B, SUN_E)

# ---------------- palette (same tokens and mixes as villageScene.ts, linear sRGB) ----------------
PAL = json.load(open(os.path.join(ROOT, 'studio', 'art', 'palette.json')))
def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def P(t):
    h = PAL[t]; return np.array([s2l(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)])
def mix(a, b, t, k=1.0):
    return (P(a) * (1 - t) + P(b) * t) * k
SKY = dict(zenith=P('skyNight') * 7.5, horizon=mix('fogHaze', 'skyNight', 0.35, 3.6), warm=mix('sodium', 'rust', 0.15, 1.5),
           glow=mix('hudAmber', 'concrete', 0.35, 2.2), below=mix('fogHaze', 'hazardBlack', 0.4, 1.2), bandPow=8.0, fogWarm=0.32, fogGlow=0.2)
COL = dict(stone=mix('concrete', 'sodium', 0.1, 0.95), stoneDry=mix('concrete', 'rust', 0.2, 0.72), slate=mix('metal', 'concreteDark', 0.35, 0.62),
           mud=mix('rust', 'concreteDark', 0.62, 0.5), grassA=mix('wallPaint', 'rust', 0.38, 0.5), grassB=mix('wallPaint', 'hudAmber', 0.3, 0.46),
           pine=mix('wallPaint', 'ink', 0.62, 0.75), bark=mix('rust', 'ink', 0.55, 0.62), timber=mix('rust', 'concrete', 0.55, 0.8),
           timberDark=mix('rust', 'hazardBlack', 0.45, 1.05), ink=P('ink'), window=mix('sodium', 'hudAmber', 0.4, 2.2),
           snow=mix('hudAmber', 'concrete', 0.5, 0.95), rock=mix('concrete', 'rust', 0.25, 0.42), rockCool=mix('metal', 'concreteDark', 0.5, 0.5),
           root=mix('rust', 'hazardBlack', 0.55, 0.6), hide=mix('rust', 'hazardBlack', 0.5, 0.5))
SUN_COL = mix('sodium', 'hudAmber', 0.25, 1.0)  # same as the game's DirectionalLight colour (~2000 K orange)

# ---------------- numpy noise ----------------
def _h(ix, iy, seed):
    h = (ix.astype(np.int64).astype(np.uint32) * np.uint32(374761393)) ^ (iy.astype(np.int64).astype(np.uint32) * np.uint32(668265263)) \
        ^ np.uint32((seed * 2246822519) & 0xffffffff)
    h = (h ^ (h >> np.uint32(13))) * np.uint32(1274126177)
    h = h ^ (h >> np.uint32(16))
    return h.astype(np.float64) / 4294967295.0
def vnoise(x, y, seed=0):
    xi, yi = np.floor(x), np.floor(y); fx, fy = x - xi, y - yi
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a, b = _h(xi, yi, seed), _h(xi + 1, yi, seed); c, d = _h(xi, yi + 1, seed), _h(xi + 1, yi + 1, seed)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy
def fbm(x, y, octv=5, seed=0):
    s, a, n = 0.0, 0.5, 0.0
    for i in range(octv):
        s = s + a * vnoise(x * 2 ** i + 17.3 * i, y * 2 ** i - 9.1 * i, seed + i); n += a; a *= 0.5
    return s / n
def ridged(x, y, octv=5, seed=0):
    s, a, n = 0.0, 0.5, 0.0
    for i in range(octv):
        v = 1 - np.abs(2 * vnoise(x * 2 ** i + 5.7 * i, y * 2 ** i + 3.3 * i, seed + 31 * i) - 1)
        s = s + a * v * v; n += a; a *= 0.5
    return s / n
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---------------- terrain ----------------
def stream_x(y):   # the stream runs N-S along the village's east edge (regions/village.md: map cols 35-36)
    return 108 + 55 * np.sin(y / 520 + 0.4) * sstep(150, 600, np.abs(y)) + 22 * np.sin(y / 190 + 1.3)
def floor_z(y):    # valley floor: rises to the north (valley head 1,300 m), falls to the south (gorge 780 m)
    return -38 + np.where(y > 0, 0.05 * y, 0.022 * y)
PEAK = bdir(MTN_B)[:2] * 5000
CAVE_XY = bdir(MTN_B)[:2] * 2800
SH1 = bdir(21)[:2] * 4600
SH2 = bdir(71)[:2] * 4400
def cone(X, Y, c, h, R, k):
    r = np.hypot(X - c[0], Y - c[1]); return h * np.clip(1 - r / R, 0, 1) ** k
def terrain_base(X, Y):
    xs, zf = stream_x(Y), floor_z(Y)
    dx = X - xs
    w = np.maximum(-dx, 0)
    west = zf + 40 * sstep(0, 115, w) + 0.035 * np.maximum(w - 130, 0) + 10 * (fbm(X / 700, Y / 700, 4, 3) - 0.5) * sstep(150, 600, w)
    # west ridge with the mast (450 m W, ~110 m higher), kept out of the WSW so the 4-deg sun clears it
    west += 108 * np.exp(-((X + 440) / 120) ** 2) * np.exp(-((Y - 170) / 250) ** 2) * (0.85 + 0.3 * fbm(X / 300, Y / 300, 3, 5))
    e = np.maximum(dx, 0)
    east = zf + 2.5 * sstep(0, 12, e) + 8 * fbm(X / 400, Y / 400, 3, 7) * sstep(0, 200, e) \
        + 0.11 * np.maximum(e - 1250, 0) * (0.55 + 0.9 * fbm(X / 1600, Y / 1600, 4, 11))
    z = np.where(dx < 0, west, east)
    # the channel
    z -= 1.6 * np.exp(-(dx / 4.5) ** 2)
    # the mountain: massive cone + two shoulders, ridged for arêtes and gullies
    rd = 0.8 + 0.4 * ridged(X / 1300, Y / 1300, 3, 21) + 0.04 * fbm(X / 160, Y / 160, 2, 23)
    r = np.hypot(X - PEAK[0], Y - PEAK[1])
    th = np.arctan2(Y - PEAK[1], X - PEAK[0])
    # radial spurs (aretes) with couloirs between them, wandering with distance
    spur = 1 - np.abs(np.sin(th * 3.5 + 1.2 * fbm(r / 700, th, 3, 51) + r / 2600))
    rd = rd * (0.86 + 0.24 * spur * sstep(200, 900, r))
    m = (480 / (1 + np.exp((r - 2000) / 300)) + cone(X, Y, PEAK, 1120, 2300, 1.5)) * rd   # massif + summit pyramid, steep lower face
    m = np.maximum(m, cone(X, Y, SH1, 780, 2100, 1.5) * rd)
    m = np.maximum(m, cone(X, Y, SH2, 660, 2000, 1.5) * rd)
    z = np.maximum(z, floor_z(Y) + m)
    # distant ranges all round (2-3 deg), lower in the WSW so the sun sits on them
    R = np.hypot(X, Y)
    bear = (np.degrees(np.arctan2(X, Y)) + 360) % 360
    dw = np.abs(((bear - SUN_B + 540) % 360) - 180)
    low = 1 - 0.55 * np.exp(-(dw / 28) ** 2)
    far = sstep(6500, 9500, R) * (260 + 420 * fbm(X / 2600, Y / 2600, 5, 13)) * low
    z = np.maximum(z, far + np.where(dw < 60, -40, 0) * 0)
    return z

# cave face: a local cliff step carved at the cave so the arch sits in a vertical face
N_FACE = -bdir(MTN_B)[:2]             # faces the village (SW)
T_FACE = np.array([N_FACE[1], -N_FACE[0]])
CAVE_W, CAVE_H = 72.0, 54.0           # game arch: 12 x 9 at 466 m -> 1.47 deg x 1.1 deg; at 2.8 km = 72 x 54 m
def cliff_term(X, Y, base):
    a = (X - CAVE_XY[0]) * N_FACE[0] + (Y - CAVE_XY[1]) * N_FACE[1]
    t = (X - CAVE_XY[0]) * T_FACE[0] + (Y - CAVE_XY[1]) * T_FACE[1]
    zc = ZC
    jag = 10 * (fbm(t / 45 + 3, t / 45, 3, 41) - 0.5) * sstep(50, 90, np.abs(t))
    a2 = a + jag
    lat = sstep(260, 140, np.abs(t))
    behind = sstep(0, -5, a2)
    top = zc + 105                       # flat bench top: merges into the rising slope ~250 m behind the face
    up = behind * np.maximum(0, top - base)
    ledge = (1 - behind) * np.minimum(0, (zc - 1.5 + 0.12 * np.maximum(a2, 0)) - base) * sstep(140, 30, a2)
    return lat * (up + ledge)
ZC = float(terrain_base(np.array([CAVE_XY[0]]), np.array([CAVE_XY[1]]))[0]) - 25
def terrain(X, Y):
    b = terrain_base(X, Y)
    return b + cliff_term(X, Y, b)
def tz(x, y):
    return float(terrain(np.array([x], float), np.array([y], float))[0])

# ---------------- scene reset ----------------
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 4; cy.diffuse_bounces = 2; cy.glossy_bounces = 2; cy.transmission_bounces = 2; cy.transparent_max_bounces = 12
cy.volume_bounces = 0
cy.caustics_reflective = False; cy.caustics_refractive = False
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = 0.0
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'

# ---------------- node helpers ----------------
class NB:
    def __init__(self, tree): self.t = tree; self.n = tree.nodes; self.l = tree.links
    def node(self, typ, **kw):
        n = self.n.new(typ)
        for k, v in kw.items(): setattr(n, k, v)
        return n
    def _in(self, node, i, v):
        sock = node.inputs[i]
        if hasattr(v, 'is_output') or isinstance(v, bpy.types.NodeSocket): self.l.new(v, sock)
        elif v is not None: sock.default_value = v
    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self._in(n, 0, a)
        if b is not None: self._in(n, 1, b)
        if c is not None: self._in(n, 2, c)
        return n.outputs[0]
    def vec(self, op, a, b=None, out=0):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self._in(n, 0, a)
        if b is not None: self._in(n, 1, b)
        return n.outputs[out]
    def vconst(self, v):
        n = self.node('ShaderNodeCombineXYZ')
        for i in range(3): n.inputs[i].default_value = float(v[i])
        return n.outputs[0]
    def rgb(self, c):
        n = self.node('ShaderNodeRGB'); n.outputs[0].default_value = (float(c[0]), float(c[1]), float(c[2]), 1.0); return n.outputs[0]
    def sep(self, v):
        n = self.node('ShaderNodeSeparateXYZ'); self.l.new(v, n.inputs[0]); return n.outputs
    def mixc(self, f, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        self._in(n, 0, f); self._in(n, 6, a if not isinstance(a, np.ndarray) else (*a, 1.0)); self._in(n, 7, b if not isinstance(b, np.ndarray) else (*b, 1.0))
        return n.outputs[2]
    def scale(self, col, f):   # colour * scalar via vector math
        return self.vec('SCALE', col, None) if False else self._scale(col, f)
    def _scale(self, col, f):
        n = self.node('ShaderNodeVectorMath', operation='SCALE'); self._in(n, 0, col); self._in(n, 3, f); return n.outputs[0]
    def add(self, a, b): return self.vec('ADD', a, b)
    def smooth(self, a, b, x):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP'); self._in(n, 0, x)
        n.inputs[1].default_value = a; n.inputs[2].default_value = b; n.inputs[3].default_value = 0.0; n.inputs[4].default_value = 1.0
        return n.outputs[0]

def sky_color(nb, d, clouds=True):
    """Direction (world, normalized) -> sky radiance. Mirrors villageScene.ts skyColor() plus clouds and a Belt of Venus."""
    x, y, z = nb.sep(d)
    h = z
    hz = nb.math('MAXIMUM', h, 0.0)
    t = nb.math('POWER', nb.math('MINIMUM', hz, 1.0), 0.55)
    base = nb.mixc(t, SKY['horizon'], SKY['zenith'])
    sl = math.hypot(SUN_DIR[0], SUN_DIR[1])
    hl = nb.math('MAXIMUM', nb.math('SQRT', nb.math('ADD', nb.math('MULTIPLY', x, x), nb.math('MULTIPLY', y, y))), 1e-4)
    cosH = nb.math('DIVIDE', nb.math('ADD', nb.math('MULTIPLY', x, SUN_DIR[0] / sl), nb.math('MULTIPLY', y, SUN_DIR[1] / sl)), hl)
    band = nb.math('MULTIPLY', nb.math('POWER', nb.math('MAXIMUM', nb.math('MULTIPLY_ADD', cosH, 0.5, 0.5), 0.0), SKY['bandPow']),
                   nb.math('EXPONENT', nb.math('MULTIPLY', hz, -7.0)))
    col = nb.add(base, nb._scale(nb.rgb(SKY['warm']), band))
    cs = nb.math('MAXIMUM', nb.vec('DOT_PRODUCT', d, nb.vconst(SUN_DIR), out=1), 0.0)
    g = nb.math('ADD', nb.math('MULTIPLY', nb.math('POWER', cs, 28.0), 0.9), nb.math('MULTIPLY', nb.math('POWER', cs, 7.0), 0.16))
    # artistic: a soft sun core in the haze (no hard disc)
    g = nb.math('ADD', g, nb.math('MULTIPLY', nb.math('POWER', cs, 2400.0), 6.0))
    col = nb.add(col, nb._scale(nb.rgb(SKY['glow']), g))
    # Belt of Venus over the antisolar horizon (the mountain side), with the cool earth shadow beneath it
    anti = nb.math('POWER', nb.math('MAXIMUM', nb.math('MULTIPLY_ADD', cosH, -0.5, 0.5), 0.0), 3.0)
    beltH = nb.math('EXPONENT', nb.math('MULTIPLY', nb.math('POWER', nb.math('DIVIDE', nb.math('SUBTRACT', h, 0.16), 0.08), 2.0), -1.0))
    col = nb.add(col, nb._scale(nb.rgb(mix('sodium', 'concrete', 0.55, 0.11)), nb.math('MULTIPLY', anti, beltH)))
    if clouds:
        # thin stratus on a sky plane: underside lit warm near the sun, slate elsewhere
        hz2 = nb.math('MAXIMUM', h, 0.02)
        px = nb.math('DIVIDE', x, hz2); py = nb.math('DIVIDE', y, hz2)
        v = nb.node('ShaderNodeCombineXYZ'); nb._in(v, 0, nb.math('MULTIPLY', px, 0.35)); nb._in(v, 1, nb.math('MULTIPLY', py, 1.0))
        tex = nb.node('ShaderNodeTexNoise'); nb.l.new(v.outputs[0], tex.inputs['Vector'])
        tex.inputs['Scale'].default_value = 0.9; tex.inputs['Detail'].default_value = 6.0; tex.inputs['Roughness'].default_value = 0.55
        tex.inputs['Distortion'].default_value = 0.3
        dens = nb.smooth(0.52, 0.72, tex.outputs['Fac'])
        alt = nb.math('MULTIPLY', nb.smooth(0.025, 0.09, h), nb.smooth(0.55, 0.2, h))
        dens = nb.math('MULTIPLY', nb.math('MULTIPLY', dens, alt), 0.75)
        lit = nb.math('MULTIPLY', nb.math('POWER', nb.math('MAXIMUM', nb.math('MULTIPLY_ADD', cosH, 0.5, 0.5), 0.0), 3.0), 1.0)
        ccol = nb.mixc(lit, mix('fogHaze', 'skyNight', 0.5, 2.6), mix('sodium', 'emergencyRed', 0.25, 0.9))
        col = nb.mixc(dens, col, ccol)
    # below the horizon (only seen past the terrain edge)
    col = nb.mixc(nb.smooth(0.0, 0.035, nb.math('MULTIPLY', h, -1.0)), col, SKY['below'])   # game uses 0.25 (hidden by its ground); 2 deg here so no warm band shows under the near clip
    return col

def fog_color(nb, d):
    """Mirrors villageScene.ts fogAt(): horizon colour + warm band toward the sun + glow."""
    x, y, z = nb.sep(d)
    sl = math.hypot(SUN_DIR[0], SUN_DIR[1])
    hl = nb.math('MAXIMUM', nb.math('SQRT', nb.math('ADD', nb.math('MULTIPLY', x, x), nb.math('MULTIPLY', y, y))), 1e-4)
    cosH = nb.math('DIVIDE', nb.math('ADD', nb.math('MULTIPLY', x, SUN_DIR[0] / sl), nb.math('MULTIPLY', y, SUN_DIR[1] / sl)), hl)
    band = nb.math('POWER', nb.math('MAXIMUM', nb.math('MULTIPLY_ADD', cosH, 0.5, 0.5), 0.0), SKY['bandPow'])
    cs = nb.math('MAXIMUM', nb.vec('DOT_PRODUCT', d, nb.vconst(SUN_DIR), out=1), 0.0)
    g = nb.math('ADD', nb.math('MULTIPLY', nb.math('POWER', cs, 28.0), 0.9), nb.math('MULTIPLY', nb.math('POWER', cs, 7.0), 0.16))
    col = nb.add(nb.rgb(SKY['horizon']), nb._scale(nb.rgb(SKY['warm'] * SKY['fogWarm']), band))
    col = nb.add(col, nb._scale(nb.rgb(SKY['glow'] * SKY['fogGlow']), g))
    return col

# ---------------- aerial perspective group (camera position set per render) ----------------
def make_fog_group():
    g = bpy.data.node_groups.new('AerialFog', 'ShaderNodeTree')
    g.interface.new_socket('Surface', in_out='INPUT', socket_type='NodeSocketShader')
    g.interface.new_socket('Shader', in_out='OUTPUT', socket_type='NodeSocketShader')
    nb = NB(g)
    gi = nb.node('NodeGroupInput'); go = nb.node('NodeGroupOutput')
    geo = nb.node('ShaderNodeNewGeometry')
    cam = nb.node('ShaderNodeCombineXYZ', name='CAM', label='CAM')
    rel = nb.vec('SUBTRACT', geo.outputs['Position'], cam.outputs[0])
    dist = nb.vec('LENGTH', rel, out=1)
    d = nb.vec('NORMALIZE', rel)
    _, _, pz = nb.sep(geo.outputs['Position'])
    camz = cam.inputs[2]
    # density: thin everywhere + cold valley mist that pools below ~-10 m (path-average height)
    zavg = nb.math('MULTIPLY', nb.math('ADD', pz, nb.node('ShaderNodeValue', name='CAMZ').outputs[0]), 0.5)
    low = nb.math('EXPONENT', nb.math('DIVIDE', nb.math('MAXIMUM', nb.math('ADD', zavg, 30.0), 0.0), -90.0))
    dens = nb.math('ADD', 1 / 9000.0, nb.math('MULTIPLY', low, 1 / 2600.0))
    f = nb.math('SUBTRACT', 1.0, nb.math('EXPONENT', nb.math('MULTIPLY', nb.math('MULTIPLY', dist, dens), -1.0)))
    f = nb.math('MINIMUM', f, 0.93)
    fc = fog_color(nb, d)
    # the mist itself reads cold blue: tint the low-mist share toward the cool horizon
    cool = nb.mixc(nb.math('MULTIPLY', low, 0.6), fc, mix('fogHaze', 'metal', 0.4, 3.4))
    em = nb.node('ShaderNodeEmission'); nb.l.new(cool, em.inputs[0]); em.inputs[1].default_value = 1.0
    mx = nb.node('ShaderNodeMixShader'); nb.l.new(f, mx.inputs[0]); nb.l.new(gi.outputs[0], mx.inputs[1]); nb.l.new(em.outputs[0], mx.inputs[2])
    nb.l.new(mx.outputs[0], go.inputs[0])
    return g
FOG = make_fog_group()
def set_fog_cam(p):
    c = FOG.nodes['CAM']
    for i in range(3): c.inputs[i].default_value = float(p[i])
    FOG.nodes['CAMZ'].outputs[0].default_value = float(p[2])

def material(name, build):
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear(); nb = NB(nt)
    out = nb.node('ShaderNodeOutputMaterial')
    shader = build(nb)
    fg = nb.node('ShaderNodeGroup'); fg.node_tree = FOG
    nb.l.new(shader, fg.inputs[0])
    # undersides (seen only through the panorama's 200 m near clip) render as the dark below-horizon sky, not lit fog
    geo = nb.node('ShaderNodeNewGeometry')
    be = nb.node('ShaderNodeEmission'); be.inputs[0].default_value = (*SKY['below'], 1.0)
    bm = nb.node('ShaderNodeMixShader'); nb.l.new(geo.outputs['Backfacing'], bm.inputs[0])
    nb.l.new(fg.outputs[0], bm.inputs[1]); nb.l.new(be.outputs[0], bm.inputs[2]); nb.l.new(bm.outputs[0], out.inputs['Surface'])
    return m

def principled(nb, col, rough=0.95, normal=None):
    p = nb.node('ShaderNodeBsdfPrincipled')
    nb._in(p, 'Base Color', col if not isinstance(col, np.ndarray) else (*col, 1.0))
    p.inputs['Roughness'].default_value = rough
    p.inputs['Specular IOR Level'].default_value = 0.25
    if normal is not None: nb.l.new(normal, p.inputs['Normal'])
    return p.outputs[0]

def terrain_mat(nb):
    geo = nb.node('ShaderNodeNewGeometry')
    _, _, nz = nb.sep(geo.outputs['Normal'])
    _, _, pz = nb.sep(geo.outputs['Position'])
    tc = geo.outputs['Position']
    n1 = nb.node('ShaderNodeTexNoise'); nb.l.new(tc, n1.inputs['Vector']); n1.inputs['Scale'].default_value = 1 / 140; n1.inputs['Detail'].default_value = 8
    n2 = nb.node('ShaderNodeTexNoise'); nb.l.new(tc, n2.inputs['Vector']); n2.inputs['Scale'].default_value = 1 / 18; n2.inputs['Detail'].default_value = 5
    # ground: dry grass / mud mottling on the valley floor and slopes
    grass = nb.mixc(n1.outputs['Fac'], COL['grassA'], COL['grassB'])
    grass = nb.mixc(nb.smooth(0.55, 0.75, n2.outputs['Fac']), grass, COL['mud'])
    # rock where steep or high; strata via a stretched noise
    rockc = nb.mixc(n2.outputs['Fac'], COL['rock'], COL['rockCool'])
    steep = nb.smooth(0.86, 0.7, nz)
    high = nb.smooth(260, 520, nb.math('ADD', pz, nb.math('MULTIPLY', n1.outputs['Fac'], 160)))
    c = nb.mixc(nb.math('MAXIMUM', steep, high), grass, rockc)
    # snow above ~1,400 m (+510 m here), only where it can lie
    sn = nb.math('MULTIPLY', nb.smooth(400, 520, nb.math('ADD', pz, nb.math('MULTIPLY', n1.outputs['Fac'], 120))), nb.smooth(0.28, 0.5, nz))
    # couloirs and rock ribs: noise stretched downhill breaks the snow into streaks
    mp = nb.node('ShaderNodeMapping'); nb.l.new(tc, mp.inputs['Vector']); mp.inputs['Scale'].default_value = (1 / 200, 1 / 200, 1 / 1400)
    rib = nb.node('ShaderNodeTexNoise'); nb.l.new(mp.outputs[0], rib.inputs['Vector']); rib.inputs['Detail'].default_value = 3
    rib.inputs['Distortion'].default_value = 0.4
    sn = nb.math('MULTIPLY', sn, nb.smooth(0.22, 0.36, rib.outputs['Fac']))
    c = nb.mixc(sn, c, COL['snow'])
    bump = nb.node('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6; bump.inputs['Distance'].default_value = 6.0
    nb.l.new(n2.outputs['Fac'], bump.inputs['Height'])
    return principled(nb, c, 1.0, bump.outputs[0])

def flat_mat(col, rough=0.9):
    return lambda nb: principled(nb, col, rough)
def emit_mat(col, strength=1.0):
    def b(nb):
        e = nb.node('ShaderNodeEmission'); e.inputs[0].default_value = (*col, 1.0); e.inputs[1].default_value = strength; return e.outputs[0]
    return b
def water_mat(nb):
    p = nb.node('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (*(COL['ink'] * 2), 1)
    p.inputs['Roughness'].default_value = 0.06
    p.inputs['IOR'].default_value = 1.33
    return p.outputs[0]

MATS = {}
def mat(key):
    if key in MATS: return MATS[key]
    builders = dict(terrain=terrain_mat, stone=flat_mat(COL['stone']), slate=flat_mat(COL['slate'], 0.7), pine=flat_mat(COL['pine']),
                    timber=flat_mat(COL['timber']), window=emit_mat(COL['window'], 1.0), cave=emit_mat(COL['ink'] * 0.6, 1.0),
                    root=flat_mat(COL['root'], 0.8), water=water_mat, hide=flat_mat(COL['hide']), olive=flat_mat(mix('wallPaint', 'concrete', 0.4, 0.42)),
                    rockface=flat_mat(COL['rock'] * 1.05, 1.0), ink=emit_mat(COL['ink'] * 0.5, 1.0))
    MATS[key] = material(key, builders[key]); return MATS[key]

# ---------------- mesh helpers ----------------
def mesh_obj(name, verts, faces, matkeys, face_mat=None, smooth=False):
    me = bpy.data.meshes.new(name)
    verts = np.asarray(verts, np.float32); faces = np.asarray(faces, np.int32)
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.ravel())
    nl = faces.shape[1]
    me.loops.add(faces.size); me.loops.foreach_set('vertex_index', faces.ravel())
    me.polygons.add(len(faces)); me.polygons.foreach_set('loop_start', np.arange(0, faces.size, nl, dtype=np.int32))
    me.update(calc_edges=True)
    for k in matkeys: me.materials.append(mat(k))
    if face_mat is not None: me.polygons.foreach_set('material_index', np.asarray(face_mat, np.int32))
    if smooth: me.polygons.foreach_set('use_smooth', np.ones(len(faces), bool))
    me.validate()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o

def build_terrain(center, r0, r1, na):
    da = 2 * math.pi / na
    q = 1 + 1.25 * da
    radii = [r0]
    while radii[-1] < r1: radii.append(radii[-1] * q)
    radii = np.array(radii)
    A = np.arange(na) * da
    RR, AA = np.meshgrid(radii, A, indexing='ij')
    X = center[0] + RR * np.sin(AA); Y = center[1] + RR * np.cos(AA)
    Z = terrain(X, Y)
    verts = np.stack([X, Y, Z], -1).reshape(-1, 3)
    nr = len(radii)
    i = np.arange(nr - 1)[:, None]; j = np.arange(na)[None, :]
    a = i * na + j; b = i * na + (j + 1) % na
    faces = np.stack([a, b, b + na, a + na], -1).reshape(-1, 4)
    # centre fan as quads collapsed to triangles is avoided: add a centre vertex
    cz = tz(center[0], center[1])
    verts = np.vstack([verts, [center[0], center[1], cz]])
    ci = len(verts) - 1
    tri = np.stack([np.full(na, ci), (np.arange(na) + 1) % na, np.arange(na)], -1)
    o = mesh_obj('terrain', verts, faces, ['terrain'], smooth=True)
    o2 = mesh_obj('terrain_cap', verts, tri, ['terrain'], smooth=True)
    print(f'terrain: {nr} rings x {na} = {len(verts)} verts')
    return o

def house_mesh(name, w, d, h, roof_h, lit):
    # box + gable roof (+ two small window quads per long side if lit); ridge along local X
    hw, hd = w / 2, d / 2
    v = [(-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0), (-hw, -hd, h), (hw, -hd, h), (hw, hd, h), (-hw, hd, h),
         (-hw - .4, -hd - .5, h - .2), (hw + .4, -hd - .5, h - .2), (hw + .4, hd + .5, h - .2), (-hw - .4, hd + .5, h - .2), (-hw - .4, 0, h + roof_h), (hw + .4, 0, h + roof_h)]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 13, 12), (6, 7, 12, 13)]
    fm = [0, 0, 0, 0, 0, 0]
    f += [(8, 9, 13, 12), (10, 11, 12, 13), (8, 12, 11, 11), (9, 10, 13, 13)]
    fm += [1, 1, 1, 1]
    if lit:
        for sy, side in ((-hd - 0.05, -1), (hd + 0.05, 1)):
            for cx in (-hw * 0.45, hw * 0.4):
                b = len(v)
                v += [(cx - .5, sy, h * .45), (cx + .5, sy, h * .45), (cx + .5, sy, h * .45 + 1.1), (cx - .5, sy, h * .45 + 1.1)]
                f.append((b, b + 1, b + 2, b + 3) if side < 0 else (b + 3, b + 2, b + 1, b)); fm.append(2)
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], [tuple(dict.fromkeys(x)) for x in f]); me.update()
    for k in ('stone', 'slate', 'window'): me.materials.append(mat(k))
    for p, mi in zip(me.polygons, fm): p.material_index = mi
    return me

HOUSES = {}
def place_house(x, y, yaw, kind=0, lit=False, scale=1.0):
    key = (kind, lit)
    if key not in HOUSES:
        w, d, h, rh = [(10, 7, 5.5, 2.8), (8, 6, 4.5, 2.3), (14, 9, 6.5, 3.4), (20, 20, 7.5, 5.0)][kind]
        HOUSES[key] = house_mesh(f'house{kind}{"L" if lit else ""}', w, d, h, rh, lit)
    o = bpy.data.objects.new('h', HOUSES[key]); sc.collection.objects.link(o)   # linked duplicate = instance
    z = min(tz(x, y), tz(x + 4, y + 4), tz(x - 4, y - 4))
    o.location = (x, y, z - 0.3); o.rotation_euler = (0, 0, yaw); o.scale = (scale, scale, scale)
    return o

def scatter_trees(seed, n, region, minr, kind='pine'):
    rng = np.random.default_rng(seed)
    pts = []
    while len(pts) < n:
        X = rng.uniform(region[0], region[1], 4000); Y = rng.uniform(region[2], region[3], 4000)
        keep = (fbm(X / 260, Y / 260, 3, seed) > 0.56) & (np.hypot(X, Y) > minr)
        Z = terrain(X, Y)
        keep &= (Z < 430) & (np.abs(X - stream_x(Y)) > 25)
        for x, y, z in zip(X[keep], Y[keep], Z[keep]):
            pts.append((x, y, z))
            if len(pts) >= n: break
    pts = np.array(pts)
    seg = 6
    vs, fs = [], []
    hs = rng.uniform(9, 17, len(pts)) if kind == 'pine' else rng.uniform(4, 6, len(pts))
    for k, (x, y, z) in enumerate(pts):
        hgt = hs[k]; r = hgt * (0.26 if kind == 'pine' else 0.55)
        base = len(vs) * 0 + k * (seg + 1)
        z0 = z + (1.5 if kind == 'pine' else 1.2)
        for s in range(seg):
            a = s / seg * 2 * math.pi + k
            vs.append((x + r * math.cos(a), y + r * math.sin(a), z0))
        vs.append((x, y, z0 + hgt if kind == 'pine' else z0 + hgt * 0.6))
        for s in range(seg):
            fs.append((base + s, base + (s + 1) % seg, base + seg))
    o = mesh_obj(kind + 's', vs, fs, [kind])
    print(f'{kind}s: {len(pts)}')
    return o

def stream():
    ys = np.linspace(-5000, 5200, 1400)
    xs = stream_x(ys); zs = floor_z(ys) - 0.9
    dx = np.gradient(xs, ys); n = np.stack([np.ones_like(dx), -dx], -1); n /= np.linalg.norm(n, axis=1)[:, None]
    w = 3.0 + 0.8 * np.sin(ys / 80)
    L = np.stack([xs - n[:, 0] * w, ys - n[:, 1] * w, zs], -1); Rr = np.stack([xs + n[:, 0] * w, ys + n[:, 1] * w, zs], -1)
    v = np.vstack([L, Rr]); m = len(ys)
    f = [(i, i + 1, m + i + 1, m + i) for i in range(m - 1)]
    return mesh_obj('stream', v, f, ['water'])

def mist_layer(name, z_off, seed, strength, width=700):
    ys = np.linspace(-4500, 4500, 160); xs = np.linspace(-8, width + 500, 40)   # floodplain only: east of the stream, never under the village
    v, f = [], []
    for yi, y in enumerate(ys):
        for xi, x in enumerate(xs):
            X = stream_x(np.array([y]))[0] + x
            v.append((X, y, floor_z(np.array([y]))[0] + z_off))
    nx = len(xs)
    for yi in range(len(ys) - 1):
        for xi in range(nx - 1):
            a = yi * nx + xi; f.append((a, a + 1, a + nx + 1, a + nx))
    me_o = None
    m = bpy.data.materials.new(name); nt = m.node_tree; nt.nodes.clear(); nb = NB(nt)
    out = nb.node('ShaderNodeOutputMaterial')
    geo = nb.node('ShaderNodeNewGeometry')
    mp = nb.node('ShaderNodeMapping'); nb.l.new(geo.outputs['Position'], mp.inputs['Vector']); mp.inputs['Scale'].default_value = (1 / 260, 1 / 900, 1 / 260)
    tx = nb.node('ShaderNodeTexNoise'); tx.noise_dimensions = '4D'; nb.l.new(mp.outputs[0], tx.inputs['Vector']); tx.inputs['Detail'].default_value = 5; tx.inputs['W'].default_value = seed
    a = nb.math('MULTIPLY', nb.smooth(0.42, 0.75, tx.outputs['Fac']), strength)
    cam = FOG.nodes['CAM']
    # direction-aware colour so the mist picks up the warm band toward the sun, cool elsewhere
    camv = nb.vconst((0, 0, 0)); camv.node.name = 'MCAM'
    d = nb.vec('NORMALIZE', nb.vec('SUBTRACT', geo.outputs['Position'], camv))
    fc = nb.mixc(0.55, fog_color(nb, d), mix('fogHaze', 'metal', 0.4, 3.6))
    em = nb.node('ShaderNodeEmission'); nb.l.new(fc, em.inputs[0])
    tr = nb.node('ShaderNodeBsdfTransparent')
    mx = nb.node('ShaderNodeMixShader'); nb.l.new(a, mx.inputs[0]); nb.l.new(tr.outputs[0], mx.inputs[1]); nb.l.new(em.outputs[0], mx.inputs[2])
    nb.l.new(mx.outputs[0], out.inputs['Surface'])
    MISTS.append(m)
    me = bpy.data.meshes.new(name); me.from_pydata(v, [], f); me.update(); me.materials.append(m)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.visible_shadow = False; o.visible_diffuse = False
    return o
MISTS = []
def set_cam_all(p):
    set_fog_cam(p)
    for m in MISTS:
        c = m.node_tree.nodes['MCAM']
        for i in range(3): c.inputs[i].default_value = float(p[i])

def cave():
    """Cliff face with the black arch (+ two small side mouths) and faint roots creeping out of it."""
    n3 = np.array([N_FACE[0], N_FACE[1], 0.0]); t3 = np.array([T_FACE[0], T_FACE[1], 0.0])
    c0 = np.array([CAVE_XY[0], CAVE_XY[1], ZC])
    def arch(cx, cz, w, h, depth, segs=14):
        r = w / 2; v = [c0 + n3 * depth + t3 * (cx - r) + np.array([0, 0, cz - 2])]
        v.append(c0 + n3 * depth + t3 * (cx - r) + np.array([0, 0, cz + h - r]))
        for s in range(1, segs):
            a = math.pi - s / segs * math.pi
            v.append(c0 + n3 * depth + t3 * (cx + r * math.cos(a)) + np.array([0, 0, cz + h - r + r * math.sin(a)]))
        v.append(c0 + n3 * depth + t3 * (cx + r) + np.array([0, 0, cz + h - r]))
        v.append(c0 + n3 * depth + t3 * (cx + r) + np.array([0, 0, cz - 2]))
        return v
    objs = []
    for (cx, cz, w, h) in [(0, 0, CAVE_W, CAVE_H), (-150, 72, 12, 10), (142, 22, 10, 8)]:
        vv = arch(cx, cz, w, h, 16)
        objs.append(mesh_obj('cave', vv, [list(range(len(vv)))], ['ink']))
    # roots: tubes from the arch, along the ledge and up the face
    rng = np.random.default_rng(7)
    cu = bpy.data.curves.new('roots', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 1
    for k in range(11):
        side = rng.choice([-1, 1]); up = rng.random() < 0.45
        s0 = side * rng.uniform(10, CAVE_W / 2 - 4)
        pts = []
        L = rng.uniform(70, 220); steps = 14
        for i in range(steps):
            f = i / (steps - 1)
            tt = s0 + side * f * L * (0.7 if up else 0.5) + 6 * math.sin(f * 9 + k)
            if up:
                p = c0 + t3 * tt + n3 * 18 + np.array([0, 0, 8 + f * L * 0.45 + 3 * math.sin(f * 7 + k)])
            else:
                a = f * L * 0.75
                q = c0 + t3 * tt + n3 * (1.5 + a)
                p = np.array([q[0], q[1], tz(q[0], q[1]) + 0.8])
            pts.append(p)
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (*p, 1.0); sp.points[i].radius = 2.0 * (1 - 0.8 * i / (len(pts) - 1))
    cu.materials.append(mat('root'))
    ro = bpy.data.objects.new('roots', cu); sc.collection.objects.link(ro)
    return objs

# ---------------- build ----------------
t0 = time.time()
build_terrain((0, 0), 6, 19000, 1440)
stream()
for i, (zo, st) in enumerate([(4, 0.4), (11, 0.28), (22, 0.18)]):
    mist_layer(f'mist{i}', zo, i * 3.7 + 1, st)
cave()
scatter_trees(11, 2600, (-3000, -250, -1500, 3500), 260)            # west slope + ridge pines
scatter_trees(12, 2200, (300, 3500, -2500, 2600), 300)               # east-bank pines below the mountain
scatter_trees(13, 900, (-1800, -300, -2600, -300), 300, 'olive')     # olive terraces SW
# outlying houses (>= 200 m: the core within 150 m is built in-game; key art adds the core below)
rng = np.random.default_rng(5)
far_houses = []
for (b, d0, d1, n) in [(175, 260, 650, 9), (195, 380, 900, 6), (150, 600, 1100, 4), (8, 520, 900, 5), (105, 900, 1500, 4), (215, 800, 1300, 4), (330, 600, 1000, 3)]:
    for k in range(n):
        bb = b + rng.uniform(-9, 9); dd = rng.uniform(d0, d1)
        x, y = bdir(bb)[:2] * dd
        if abs(x - stream_x(np.array([y]))[0]) < 30: x -= 45
        far_houses.append(place_house(x, y, rng.uniform(0, math.pi), int(rng.integers(0, 3)), bool(rng.random() < 0.35)))
print(f'build {time.time() - t0:.1f}s; ZC={ZC:.1f} cave sill elevation from barn = {math.degrees(math.atan2(ZC - 1.7, 2800)):.2f} deg')

# horizon elevation per bearing, measured on the heightfield (for the report)
def horizon_elev(b, eye):
    r = np.geomspace(150, 19000, 3000); d = bdir(b)
    z = terrain(d[0] * r, d[1] * r)
    return math.degrees(np.max(np.arctan2(z - eye, r)))
EYE = tz(0, 0) + 1.7
print('horizon elev (deg): ' + ', '.join(f'{b}:{horizon_elev(b, EYE):.2f}' for b in (0, 21, 45, 71, 90, 135, 180, 240, 270, 290, 330)))

# ---------------- world, sun ----------------
w = bpy.data.worlds.new('dusk'); sc.world = w
nt = w.node_tree; nt.nodes.clear(); nb = NB(nt)
tc = nb.node('ShaderNodeTexCoord')
d = nb.vec('NORMALIZE', tc.outputs['Generated'])
bg = nb.node('ShaderNodeBackground'); nb.l.new(sky_color(nb, d), bg.inputs[0]); bg.inputs[1].default_value = 1.0
wo = nb.node('ShaderNodeOutputWorld'); nb.l.new(bg.outputs[0], wo.inputs[0])
sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 7.0; sun_d.angle = 0.6 * deg; sun_d.color = tuple(SUN_COL / SUN_COL.max())
sun = bpy.data.objects.new('sun', sun_d); sc.collection.objects.link(sun)
from mathutils import Vector
sun.rotation_euler = Vector(SUN_DIR.tolist()).to_track_quat('Z', 'Y').to_euler()

# ---------------- compositor: painterly ----------------
def compositor(kuwa_size, glare=True):
    tr = bpy.data.node_groups.get('Comp') or bpy.data.node_groups.new('Comp', 'CompositorNodeTree')
    tr.nodes.clear()
    if not tr.interface.items_tree:
        tr.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    sc.compositing_node_group = tr
    sc.render.use_compositing = True
    n, l = tr.nodes, tr.links
    rl = n.new('CompositorNodeRLayers')
    img = rl.outputs['Image']
    if glare:
        g = n.new('CompositorNodeGlare'); g.inputs['Type'].default_value = 'Bloom'; g.inputs['Threshold'].default_value = 0.9
        g.inputs['Strength'].default_value = 0.35; g.inputs['Size'].default_value = 0.6
        l.new(img, g.inputs['Image']); img = g.outputs['Image']
    k = n.new('CompositorNodeKuwahara'); k.inputs['Size'].default_value = kuwa_size; k.inputs['Type'].default_value = 'Anisotropic'
    k.inputs['Uniformity'].default_value = 4; k.inputs['Sharpness'].default_value = 0.75; k.inputs['Eccentricity'].default_value = 1.0
    k.inputs['High Precision'].default_value = True
    l.new(img, k.inputs['Image']); img = k.outputs['Image']
    cb = n.new('CompositorNodeColorBalance')   # subtle grade: cool lift, warm gain
    cb.inputs[4].default_value = (0.97, 0.99, 1.04, 1); cb.inputs[8].default_value = (1.04, 1.0, 0.95, 1)
    l.new(img, cb.inputs['Image']); img = cb.outputs['Image']
    go = n.new('NodeGroupOutput'); l.new(img, go.inputs[0])

def render(path):
    t = time.time(); sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    dt = time.time() - t; print(f'RENDER {os.path.basename(path)} {sc.render.resolution_x}x{sc.render.resolution_y}@{PCT}% samples={SAMPLES}: {dt:.1f}s')
    return dt

# ---------------- panorama ----------------
if MODE in ('pano', 'both'):
    cd = bpy.data.cameras.new('pano'); cd.type = 'PANO'; cd.panorama_type = 'EQUIRECTANGULAR'
    W, M = 4096, 64
    cd.longitude_min = -math.pi * (W + 2 * M) / W; cd.longitude_max = math.pi * (W + 2 * M) / W
    cd.latitude_min = -math.pi / 2; cd.latitude_max = math.pi / 2
    cd.clip_start = 200.0; cd.clip_end = 40000   # the game builds everything inside ~200 m; the panorama shows only what lies beyond
    cam = bpy.data.objects.new('pano', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0, 0, EYE); cam.rotation_euler = (90 * deg, 0, -90 * deg)   # image centre = east, level horizon
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W + 2 * M, 2048, PCT
    set_cam_all(cam.location)
    compositor(5 * PCT / 100)
    render(os.path.join(OUT, 'valley-sky-overscan.png'))

# ---------------- key art ----------------
if MODE in ('key', 'both'):
    for o in far_houses: o.hide_render = False
    # village core from the region map (regions/village.md), 1 cell = 5 m, barn (cols 13-16, rows 2-5) at the origin
    MAP = open(os.path.join(ROOT, 'studio', 'world', 'regions', 'village.md'), encoding='utf-8').read().split('```')[1].strip('\n').split('\n')[2:]
    grid = [row[5:45] for row in MAP]
    def cell(c, r): return (c * 5 + 2.5 - 72.5, -(r * 5 + 2.5 - 17.5))
    seen = set(); krng = np.random.default_rng(9)
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            if ch in 'HBCKS' and (c, r) not in seen:
                cells = [(c, r)]; stack = [(c, r)]; seen.add((c, r))
                while stack:
                    a, b = stack.pop()
                    for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        aa, bb = a + da, b + db
                        if 0 <= bb < len(grid) and 0 <= aa < len(grid[bb]) and grid[bb][aa] == ch and (aa, bb) not in seen:
                            seen.add((aa, bb)); cells.append((aa, bb)); stack.append((aa, bb))
                cs = np.array([cell(*x) for x in cells]); cx, cyy = cs.mean(0)
                kind = {'H': 0, 'B': 3 if len(cells) >= 12 else 2, 'C': 2, 'K': 2, 'S': 2}[ch]
                yaw = 0 if np.ptp(cs[:, 0]) >= np.ptp(cs[:, 1]) else math.pi / 2
                place_house(cx, cyy, yaw, kind, bool(krng.random() < 0.5) and ch != 'B')
    # bell tower [3]: 5 x 5 m, 22 m
    bx, by = cell(16, 9)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, tz(bx, by) + 11)); tw = bpy.context.object; tw.scale = (5, 5, 22); tw.data.materials.append(mat('stone'))
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=4.0, depth=5, location=(bx, by, tz(bx, by) + 24.5)); sp = bpy.context.object
    sp.rotation_euler = (0, 0, math.pi / 4); sp.data.materials.append(mat('slate'))
    # the herd: single file from the barn toward the stepping stones and the mountain (45 deg), Joseph last
    def animal(x, y, yaw, s=1.0, child=False):
        if child:
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.22, depth=1.25, location=(x, y, tz(x, y) + 0.63)); o = bpy.context.object
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.14, location=(x, y, tz(x, y) + 1.38))
            o2 = bpy.context.object
            for q in (o, o2): q.data.materials.append(mat('hide'))
            return
        zb = tz(x, y)
        parts = [((0, 0, 1.15), (2.1, 0.75, 0.75)), ((1.25, 0, 1.35), (0.55, 0.4, 0.45))] + [((sx, sy, 0.45), (0.16, 0.16, 0.9)) for sx in (-0.75, 0.75) for sy in (-0.25, 0.25)]
        for (px, py, pz), (sx, sy, sz) in parts:
            ca, sa = math.cos(yaw), math.sin(yaw)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x + (px * ca - py * sa) * s, y + (px * sa + py * ca) * s, zb + pz * s))
            o = bpy.context.object; o.scale = (sx * s, sy * s, sz * s); o.rotation_euler = (0, 0, yaw); o.data.materials.append(mat('hide'))
    hd = bdir(45)[:2]; yaw = math.atan2(hd[1], hd[0])
    start = np.array([14.0, 10.0])
    for k in range(15):
        p = start + hd * (24 + k * 6.5) + np.array([1.2, -1.2]) * math.sin(k * 1.7)
        animal(p[0], p[1], yaw, 0.85 if k % 3 else 1.0)
    p = start + hd * 6; animal(p[0], p[1], yaw, child=True)

    cd = bpy.data.cameras.new('key'); cd.lens = 35; cd.sensor_width = 36; cd.clip_start = 1; cd.clip_end = 40000
    cd.shift_y = 0.1; cd.shift_x = 0.0
    cam = bpy.data.objects.new('key', cd); sc.collection.objects.link(cam); sc.camera = cam
    # map vegetation near the core (pines NW and across the stream, olive terraces west of the wall)
    scatter_trees(21, 260, (-260, -45, -10, 260), 0)
    scatter_trees(22, 300, (125, 520, -250, 320), 0)
    scatter_trees(23, 380, (-330, -45, -290, -25), 0, 'olive')
    kp = np.array([-40.0, -330.0]); cam.location = (kp[0], kp[1], tz(*kp) + 40)
    look = 26.0
    for o in far_houses:   # nothing big right under the lens
        if math.hypot(o.location.x - kp[0], o.location.y - kp[1]) < 160: o.hide_render = True
    cam.rotation_euler = (90 * deg, 0, -look * deg)    # level camera (horizon not tilted); framing via lens shift
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, PCT
    set_cam_all(cam.location)
    compositor(7 * PCT / 100)
    render(os.path.join(OUT, 'valley-dusk-key.png'))
print(f'TOTAL {time.time() - t0:.1f}s')
