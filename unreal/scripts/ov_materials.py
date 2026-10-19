"""Materials for the barn slice, generated from code (re-run safe).

  M_OV_Base  flat colour + roughness + emissive (blockout, mountain, emissives)
  M_OV_Tex   Aktham's tileable sets: world-planar UVs like the web build (src/materials.ts: dominant axis, 1 tile = 2 m),
             BaseTex * Tint, NormalTex (DirectX green-down = UE native), Roughness. Tint = palette / texture base mean
             (the web build's divide-by-base trick, src/villageScene.ts), so averages match the palette.
  M_OV_Sky   valley-sky.jpg equirect backdrop, unlit, IsSky (feeds the real-time SkyLight capture). Direction -> uv as
             in studio/reports/aktham-blender.md: u = ((bearing - 270) mod 360) / 360, v = 0 zenith, 0.5 horizon.
"""
import unreal

import import_art

EAL = unreal.EditorAssetLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
MEL = unreal.MaterialEditingLibrary
MAT_DIR = "/Game/OmegaValley/Materials"


def _log(m):
    unreal.log("[OV] " + m)


def srgb_to_linear(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


# Texture sets: file stem -> base mean (sRGB hex, src/villageTextures.ts) and normal map present.
TEX = {
    "dirt-road": ("#4B352D", True), "grass-dry": ("#6A5C46", False), "wood-planks-barn": ("#7D685F", True),
    "roof-tiles-red": ("#973B24", True), "stone-wall": ("#98897E", True), "hay": ("#B1805F", False),
    "fence-wood": ("#6E3B25", False), "wall-painted": (None, False),
}

# palette name -> (sRGB hex, roughness, emissive linear rgb or None, texture stem or None, tile cm)
PALETTE = {
    "ground": ("#3E3B2C", 0.95, None, "grass-dry", 200.0),      # wet dry-grass and mud, late November
    "wood": ("#6A5446", 0.85, None, "wood-planks-barn", 200.0),  # weathered barn boards
    "woodDark": ("#3A2D24", 0.9, None, "wood-planks-barn", 200.0),
    "stone": ("#77716A", 0.9, None, "stone-wall", 200.0),
    "straw": ("#A88E55", 0.95, None, "hay", 120.0),
    "sacks": ("#8A7A5E", 0.95, None, "hay", 200.0),
    "roof": ("#6E3527", 0.75, None, "roof-tiles-red", 200.0),    # red clay tiles (Aktham's roof-tiles-red)
    "plaster": ("#9C9384", 0.9, None, None, 0.0),             # wall-painted.png is the green Night Shift block wall: not used
    "fence": ("#6B5844", 0.9, None, "fence-wood", 200.0),
    "mud": ("#241E17", 0.6, None, "dirt-road", 60.0),           # hoofprints: wet, darker
    "rock": ("#A39D94", 0.9, None, None, 0.0),                   # mountain face: the brightest surface in the opening shot
    "rockShade": ("#6F6A64", 0.9, None, None, 0.0),
    "cave": ("#030303", 1.0, None, None, 0.0),
    "tvWindow": ("#101418", 0.3, (0.35, 0.42, 0.55), None, 0.0),   # black-and-white TV glow
    "candle": ("#FFB46B", 0.5, (6.0, 2.6, 0.7), None, 0.0),
    "lantern": ("#FFC37A", 0.5, (40.0, 17.0, 4.5), None, 0.0),    # lantern glass, seen from inside the barn
    "iron": ("#1C1A18", 0.6, None, None, 0.0),
    "pine": ("#24301F", 0.9, None, None, 0.0),             # full village (build_village.py)
    "olive": ("#4A5340", 0.9, None, None, 0.0),
    "water": ("#141C22", 0.05, None, None, 0.0),
}


def _x(m, cls, x, y, **props):
    e = MEL.create_material_expression(m, cls, x, y)
    for k, v in props.items():
        e.set_editor_property(k, v)
    return e


def _l(a, a_out, b, b_in):
    if not MEL.connect_material_expressions(a, a_out, b, b_in):
        unreal.log_warning("[OV] material link failed: %s.%s -> %s.%s" % (a.get_name(), a_out, b.get_name(), b_in))


def _mask(m, src, ch, x, y):
    e = _x(m, unreal.MaterialExpressionComponentMask, x, y, r=(ch == "r"), g=(ch == "g"), b=(ch == "b"), a=False)
    _l(src, "", e, "")
    return e


def _bin(m, cls, a, b, x, y, const_b=None):
    e = _x(m, cls, x, y)
    _l(a, "", e, "A")
    if b is not None:
        _l(b, "", e, "B")
    elif const_b is not None:
        e.set_editor_property("const_b", const_b)
    return e


def _fresh(name, cls, factory):
    """Existing material: wipe its graph (instances keep pointing at it). New: create it."""
    path = "%s/%s" % (MAT_DIR, name)
    if EAL.does_asset_exist(path):
        m = EAL.load_asset(path)
        MEL.delete_all_material_expressions(m)
        return m
    return AT.create_asset(name, MAT_DIR, cls, factory)


def build_base():
    m = _fresh("M_OV_Base", unreal.Material, unreal.MaterialFactoryNew())
    col = _x(m, unreal.MaterialExpressionVectorParameter, -500, -200, parameter_name="Color",
             default_value=unreal.LinearColor(0.5, 0.5, 0.5, 1.0))
    rough = _x(m, unreal.MaterialExpressionScalarParameter, -500, 50, parameter_name="Roughness", default_value=0.85)
    emi = _x(m, unreal.MaterialExpressionVectorParameter, -500, 250, parameter_name="Emissive",
             default_value=unreal.LinearColor(0.0, 0.0, 0.0, 1.0))
    MEL.connect_material_property(col, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(emi, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


def build_tex(default_tex):
    m = _fresh("M_OV_Tex", unreal.Material, unreal.MaterialFactoryNew())
    # World-planar UVs, dominant axis (src/materials.ts): X-facing -> (Y, -Z), Y-facing -> (X, -Z), Z-facing -> (X, Y).
    P = _x(m, unreal.MaterialExpressionWorldPosition, -1900, 0)
    N = _x(m, unreal.MaterialExpressionVertexNormalWS, -1900, 300)
    aN = _x(m, unreal.MaterialExpressionAbs, -1750, 300)
    _l(N, "", aN, "")
    ax, ay, az = (_mask(m, aN, c, -1600, 220 + 80 * i) for i, c in enumerate("rgb"))
    myz = _bin(m, unreal.MaterialExpressionMax, ay, az, -1450, 300)
    sX = _x(m, unreal.MaterialExpressionSaturate, -1150, 260)
    _l(_bin(m, unreal.MaterialExpressionMultiply, _bin(m, unreal.MaterialExpressionSubtract, ax, myz, -1300, 260), None,
            -1220, 260, const_b=10000.0), "", sX, "")
    sY = _x(m, unreal.MaterialExpressionSaturate, -1150, 380)
    _l(_bin(m, unreal.MaterialExpressionMultiply, _bin(m, unreal.MaterialExpressionSubtract, ay, az, -1300, 380), None,
            -1220, 380, const_b=10000.0), "", sY, "")
    px, py, pz = (_mask(m, P, c, -1750, -80 + 80 * i) for i, c in enumerate("rgb"))
    npz = _bin(m, unreal.MaterialExpressionMultiply, pz, None, -1600, 80, const_b=-1.0)
    uvX = _bin(m, unreal.MaterialExpressionAppendVector, py, npz, -1450, -100)
    uvY = _bin(m, unreal.MaterialExpressionAppendVector, px, npz, -1450, 0)
    uvZ = _bin(m, unreal.MaterialExpressionAppendVector, px, py, -1450, 100)
    lyz = _x(m, unreal.MaterialExpressionLinearInterpolate, -1000, 50)
    _l(uvZ, "", lyz, "A"); _l(uvY, "", lyz, "B"); _l(sY, "", lyz, "Alpha")
    luv = _x(m, unreal.MaterialExpressionLinearInterpolate, -850, 0)
    _l(lyz, "", luv, "A"); _l(uvX, "", luv, "B"); _l(sX, "", luv, "Alpha")
    tile = _x(m, unreal.MaterialExpressionScalarParameter, -850, 150, parameter_name="TileCm", default_value=200.0)
    uv = _bin(m, unreal.MaterialExpressionDivide, luv, tile, -700, 50)

    base = _x(m, unreal.MaterialExpressionTextureSampleParameter2D, -500, -250, parameter_name="BaseTex", texture=default_tex)
    _l(uv, "", base, "UVs")
    tint = _x(m, unreal.MaterialExpressionVectorParameter, -500, -450, parameter_name="Tint",
              default_value=unreal.LinearColor(1.0, 1.0, 1.0, 1.0))
    bc = _x(m, unreal.MaterialExpressionMultiply, -250, -300)
    _l(base, "RGB", bc, "A"); _l(tint, "", bc, "B")
    nrm = _x(m, unreal.MaterialExpressionTextureSampleParameter2D, -500, 100, parameter_name="NormalTex",
             texture=unreal.load_object(None, "/Engine/EngineMaterials/FlatNormal.FlatNormal"), sampler_type=unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
    _l(uv, "", nrm, "UVs")
    rough = _x(m, unreal.MaterialExpressionScalarParameter, -500, 350, parameter_name="Roughness", default_value=0.9)
    emi = _x(m, unreal.MaterialExpressionVectorParameter, -500, 450, parameter_name="Emissive",
             default_value=unreal.LinearColor(0.0, 0.0, 0.0, 1.0))
    MEL.connect_material_property(bc, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(nrm, "RGB", unreal.MaterialProperty.MP_NORMAL)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(emi, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


SKY_UV_HLSL = """float3 d = -normalize(V);
float b = atan2(d.x, -d.y);
float u = frac((b - 4.71238898) / 6.28318531);
float v = acos(clamp(d.z, -1.0, 1.0)) / 3.14159265;
return float2(u, v);"""


def build_sky(sky_tex):
    m = _fresh("M_OV_Sky", unreal.Material, unreal.MaterialFactoryNew())
    for k, v in (("shading_model", unreal.MaterialShadingModel.MSM_UNLIT), ("two_sided", True), ("is_sky", True)):
        try:
            m.set_editor_property(k, v)
        except Exception as e:
            unreal.log_warning("[OV] M_OV_Sky.%s: %s" % (k, e))
    cv = _x(m, unreal.MaterialExpressionCameraVectorWS, -900, 0)
    cu = _x(m, unreal.MaterialExpressionCustom, -700, 0, code=SKY_UV_HLSL, description="EquirectUV",
            output_type=unreal.CustomMaterialOutputType.CMOT_FLOAT2)
    ci = unreal.CustomInput()
    ci.set_editor_property("input_name", "V")
    cu.set_editor_property("inputs", [ci])
    _l(cv, "", cu, "V")
    tex = _x(m, unreal.MaterialExpressionTextureSampleParameter2D, -450, 0, parameter_name="SkyTex", texture=sky_tex)
    _l(cu, "", tex, "UVs")
    k = _x(m, unreal.MaterialExpressionScalarParameter, -450, 250, parameter_name="SkyIntensity", default_value=1.0)
    mul = _x(m, unreal.MaterialExpressionMultiply, -200, 50)
    _l(tex, "RGB", mul, "A"); _l(k, "", mul, "B")
    MEL.connect_material_property(mul, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    MEL.recompile_material(m)
    EAL.save_loaded_asset(m)
    return m


def _mi(name, parent):
    path = "%s/%s" % (MAT_DIR, name)
    mi = EAL.load_asset(path) if EAL.does_asset_exist(path) else \
        AT.create_asset(name, MAT_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    MEL.set_material_instance_parent(mi, parent)
    return mi


def finish_compiling():
    """Block until textures and meshes are built (else the editor shows its checker placeholder in renders)."""
    for c in ("Editor.AsyncTextureCompilationFinishAll", "Editor.AsyncStaticMeshCompilationFinishAll"):
        unreal.SystemLibrary.execute_console_command(None, c)


def ensure_materials(sky_intensity=1.0):
    """Returns ({palette name: MI}, sky MI, stats). Imports Aktham's textures first if they are missing."""
    tex = import_art.main()                     # key -> asset path
    k = import_art.key

    def load(stem):
        p = tex.get(k(stem))
        return EAL.load_asset(p) if p else None

    base = build_base()
    tex_master = build_tex(load("grass-dry") or EAL.load_asset("/Engine/EngineResources/DefaultTexture"))
    mats, n_tex = {}, 0
    for name, (hexc, rough, emissive, stem, tile) in PALETTE.items():
        t = load(stem) if stem else None
        mi = _mi("MI_OV_" + name, tex_master if t else base)
        target = srgb_to_linear(hexc)
        if t:
            b_hex, has_n = TEX[stem]
            b = srgb_to_linear(b_hex) if b_hex else [1.0, 1.0, 1.0]
            tint = [min(4.0, target[i] / max(b[i], 1e-3)) if b_hex else 1.0 for i in range(3)]
            MEL.set_material_instance_texture_parameter_value(mi, "BaseTex", t)
            MEL.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(tint[0], tint[1], tint[2], 1.0))
            MEL.set_material_instance_scalar_parameter_value(mi, "TileCm", tile)
            n = load(stem + "_normal") if has_n else None
            if n:
                MEL.set_material_instance_texture_parameter_value(mi, "NormalTex", n)
            n_tex += 1
        else:
            MEL.set_material_instance_vector_parameter_value(mi, "Color", unreal.LinearColor(target[0], target[1], target[2], 1.0))
        MEL.set_material_instance_scalar_parameter_value(mi, "Roughness", rough)
        e = emissive or (0.0, 0.0, 0.0)
        MEL.set_material_instance_vector_parameter_value(mi, "Emissive", unreal.LinearColor(e[0], e[1], e[2], 1.0))
        MEL.update_material_instance(mi)
        EAL.save_loaded_asset(mi)
        mats[name] = mi
    sky_mi = None
    st = load("valley-sky")
    if st:
        sky_mi = _mi("MI_OV_Sky", build_sky(st))
        MEL.set_material_instance_scalar_parameter_value(sky_mi, "SkyIntensity", sky_intensity)
        MEL.update_material_instance(sky_mi)
        EAL.save_loaded_asset(sky_mi)
    else:
        unreal.log_warning("[OV] valley-sky texture missing: no sky backdrop")
    finish_compiling()
    _log("materials: %d textured, %d flat, sky %s" % (n_tex, len(mats) - n_tex, "on" if sky_mi else "off"))
    return mats, sky_mi, {"textured": n_tex, "flat": len(mats) - n_tex, "sky": bool(sky_mi)}
