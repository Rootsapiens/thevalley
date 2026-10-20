"""Builds /Game/OmegaValley/Maps/BarnSlice from unreal/data/village-barn.json (exported by scripts/export-village-json.mjs).

Run headless (what run_trial.ps1 does):
  UnrealEditor-Cmd.exe <repo>\\unreal\\OmegaValley\\OmegaValley.uproject -run=pythonscript
      -script="<repo>\\unreal\\scripts\\build_barn_level.py" -unattended -nosplash -nop4
Or inside the editor: Tools > Execute Python Script... > this file.

Re-runnable: every actor it spawns carries the tag OV_AUTO and is deleted before the next build. Actors you place by
hand (no tag) are kept. Units: the JSON is in game metres (x east, y up, z south); ov_units.py converts to UE
centimetres (X east, Y south, Z up). Lighting per studio/world/decisions-noor.md: sun bearing 240 deg, elevation 4 deg,
~2000 K; cool blue sky and fog; mountain and cave mouth at bearing 45 deg.
Writes Saved/ov_build_result.json (actor count, seconds, landmark check) for run_trial.ps1.
"""
import json
import math
import os
import sys
import time
import traceback

import unreal

# ---------- Paths ----------
try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:   # some exec modes do not set __file__
    HERE = None
PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
SCRIPTS = HERE or os.path.join(PROJECT_DIR, "..", "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)
import ov_units as U  # noqa: E402
import ov_paths  # noqa: E402

REPO = ov_paths.repo_dir(PROJECT_DIR)
DATA = ov_paths.data_file(PROJECT_DIR)
RESULT = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), "ov_build_result.json")
MAP = "/Game/OmegaValley/Maps/BarnSlice"
MAT_DIR = "/Game/OmegaValley/Materials"
TAG = "OV_AUTO"

# ---------- Look tunables (first things to tweak during the trial) ----------
# Optional overrides without editing this file: <unreal>/data/look.json, e.g. {"SUN_LUX": 30, "EXPOSURE_BIAS": 0.5}.
SUN_LUX = 25.0               # DirectionalLight, lux. No SkyAtmosphere (the sky is valley-sky.jpg), so no attenuation
SUN_KELVIN = 2000.0          # decisions-noor.md: warm orange, ~2000 K
SKY_INTENSITY = 2.5          # valley-sky.jpg emissive multiplier (backdrop + real-time SkyLight capture)
SKY_LIGHT_INTENSITY = 2.2      # lifts the shaded north and east faces (readability)
SKY_RADIUS_CM = 2000000.0    # backdrop sphere, 20 km; fog stops at FOG_CUTOFF_CM so the painted sky stays clean
EXPOSURE_BIAS = 0.0          # auto exposure (histogram) clamped to AE_MIN_EV..AE_MAX_EV (EV100)
AE_MIN_EV = 1.0             # first MRQ pass sat on -1.0 and blew every sunlit wall out
AE_MAX_EV = 3.0
LOCAL_SHADOW_CONTRAST = 0.7  # local exposure: lifts barn interiors and the shaded east walls (readability)
FOG_DENSITY = 0.006
FOG_FALLOFF = 0.2
FOG_START_CM = 1500.0
FOG_CUTOFF_CM = 1500000.0
FOG_HAZE_SRGB = "#2A3440"    # palette fogHaze: cool blue
FOG_INSCATTER_SCALE = 4.0
LANTERN_CD = 60.0            # aisle lanterns (candela), ~1900 K; post lanterns get POST_LANTERN_CD
POST_LANTERN_CD = 25.0
LANTERN_KELVIN = 1900.0
SHOW_MOUNTAIN_MESH = False   # the painted mountain in valley-sky.jpg (cave measured at 45.09 deg) reads better than the cone;
                             # the cone and cave slab stay in the level (hidden) as the measured reference
# Mountain proxy (world-bible.md: cave mouth 2.8 km NE, ~280 m above the village; peak 2,350 m vs ~900 m)
MOUNTAIN_RADIUS_M = 2500.0

EAL = unreal.EditorAssetLibrary
AT = unreal.AssetToolsHelpers.get_asset_tools()
MEL = unreal.MaterialEditingLibrary
EAS = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def log(msg):
    unreal.log("[OV] " + msg)


def warn(msg):
    unreal.log_warning("[OV] " + msg)


def set_props(obj, pairs):
    """Set editor properties, trying alternative names per key (property names moved between 5.x releases)."""
    for names, value in pairs:
        names = names if isinstance(names, (list, tuple)) else [names]
        for n in names:
            try:
                obj.set_editor_property(n, value)
                break
            except Exception:
                continue
        else:
            warn("could not set %s on %s" % ("/".join(names), obj.get_name() if hasattr(obj, "get_name") else type(obj).__name__))


def srgb_to_linear(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def load_look():
    """Overrides from <unreal>/data/look.json (upper-case tunables only)."""
    p = os.path.join(ov_paths.unreal_dir(PROJECT_DIR), "data", "look.json")
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as fh:
            for k, v in json.load(fh).items():
                if k.isupper() and k in globals():
                    globals()[k] = v
                    log("look.json: %s = %s" % (k, v))


# ---------- Level ----------
def open_or_create_level(path):
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    exists = EAL.does_asset_exist(path)
    if les:
        try:
            if (les.load_level(path) if exists else les.new_level(path)):
                return
        except Exception as e:
            warn("LevelEditorSubsystem failed (%s), using EditorLoadingAndSavingUtils" % e)
    if exists:
        unreal.EditorLoadingAndSavingUtils.load_map(path)
    else:
        world = unreal.EditorLoadingAndSavingUtils.new_blank_map(False)
        unreal.EditorLoadingAndSavingUtils.save_map(world, path)


def save_all():
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    try:
        if les:
            les.save_current_level()
    except Exception as e:
        warn("save_current_level: %s" % e)
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)


def clear_generated():
    n = 0
    for a in EAS.get_all_level_actors():
        if a.actor_has_tag(TAG):
            EAS.destroy_actor(a)
            n += 1
    if n:
        log("removed %d generated actors from the previous build" % n)


# ---------- Spawning ----------
MESH = {}
STATS = {"actors": 0}


def mesh(kind):
    if kind not in MESH:
        MESH[kind] = EAL.load_asset("/Engine/BasicShapes/%s.%s" % (kind, kind))
    return MESH[kind]


def rot(pitch=0.0, yaw=0.0, roll=0.0):
    return unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw)


def spawn(cls, loc_cm, rotation=None, label=None, folder=None):
    a = EAS.spawn_actor_from_class(cls, unreal.Vector(*loc_cm), rotation or rot())
    if label:
        a.set_actor_label(label)
    if folder:
        a.set_folder_path("OV/" + folder)
    tags = list(a.get_editor_property("tags"))
    tags.append(unreal.Name(TAG))
    a.set_editor_property("tags", tags)
    STATS["actors"] += 1
    return a


def shape(kind, centre_cm, size_cm, mat, label, folder, rotation=None, cast_shadow=True):
    """A BasicShapes mesh (100 cm, pivot at centre) scaled to size_cm."""
    a = spawn(unreal.StaticMeshActor, centre_cm, rotation, label, folder)
    smc = a.static_mesh_component
    smc.set_static_mesh(mesh(kind))
    smc.set_material(0, mat)
    smc.set_editor_property("mobility", unreal.ComponentMobility.STATIC)
    if not cast_shadow:
        smc.set_editor_property("cast_shadow", False)
    a.set_actor_scale3d(unreal.Vector(size_cm[0] / 100.0, size_cm[1] / 100.0, size_cm[2] / 100.0))
    return a


def gbox(x0, y0, z0, x1, y1, z1, mat, label, folder):
    """Axis-aligned box from game-space corners (m)."""
    b = {"min": {"x": min(x0, x1), "y": min(y0, y1), "z": min(z0, z1)}, "max": {"x": max(x0, x1), "y": max(y0, y1), "z": max(z0, z1)}}
    c, s = U.box_to_ue(b)
    return shape("Cube", c, s, mat, label, folder)


def gable_roof(r, eave, ridge, mats, label, folder, over=0.4, th=0.25, solid_gables=True, wall=0.5):
    """Two roof slabs plus stepped gable ends over rect r (game m). The ridge runs along the longer side."""
    along_z = (r["z1"] - r["z0"]) >= (r["x1"] - r["x0"])
    half = ((r["x1"] - r["x0"]) if along_z else (r["z1"] - r["z0"])) / 2.0
    mid_p = ((r["x0"] + r["x1"]) if along_z else (r["z0"] + r["z1"])) / 2.0
    lo, hi = (r["z0"], r["z1"]) if along_z else (r["x0"], r["x1"])
    a = math.atan2(ridge - eave, half)
    length = (half + over) / math.cos(a)
    y_low = eave - math.tan(a) * over
    for side in (-1, 1):
        # underside line from (ridge at the centre) to (y_low at half + over); lift by th/2 along the outward normal
        p_mid = mid_p + side * (half + over) / 2.0
        y_mid = (ridge + y_low) / 2.0
        p_c = p_mid + side * math.sin(a) * th / 2.0
        y_c = y_mid + math.cos(a) * th / 2.0
        span = (hi - lo) + 2 * over
        if along_z:   # slope across game x = UE X: pitch about UE Y
            c = U.loc(p_c, y_c, (lo + hi) / 2.0)
            shape("Cube", c, (length * 100, span * 100, th * 100), mats["roof"], "%s_Roof%s" % (label, "E" if side > 0 else "W"),
                  folder, rot(pitch=-side * math.degrees(a)))
        else:         # slope across game z = UE Y: roll about UE X
            c = U.loc((lo + hi) / 2.0, y_c, p_c)
            shape("Cube", c, (span * 100, length * 100, th * 100), mats["roof"], "%s_Roof%s" % (label, "S" if side > 0 else "N"),
                  folder, rot(roll=side * math.degrees(a)))
    # Gable ends: stacked steps (half-width measured at each step's middle), hidden under the roof slabs.
    n = 12
    dh = (ridge - eave) / n
    for i in range(n):
        y0 = eave + i * dh
        w = half * (ridge - (y0 + dh / 2)) / (ridge - eave)
        ends = [(lo, hi)] if solid_gables else [(lo, lo + wall), (hi - wall, hi)]
        for k, (e0, e1) in enumerate(ends):
            if along_z:
                gbox(mid_p - w, y0, e0, mid_p + w, y0 + dh, e1, mats[label_mat(label)], "%s_Gable%d_%02d" % (label, k, i), folder)
            else:
                gbox(e0, y0, mid_p - w, e1, y0 + dh, mid_p + w, mats[label_mat(label)], "%s_Gable%d_%02d" % (label, k, i), folder)
    shape("Cube", U.loc((r["x0"] + r["x1"]) / 2.0, ridge + th, (r["z0"] + r["z1"]) / 2.0),
          ((0.35 if along_z else (hi - lo) + 2 * over) * 100, ((hi - lo) + 2 * over if along_z else 0.35) * 100, 0.2 * 100),
          mats["woodDark"], label + "_Ridge", folder)


def label_mat(label):
    return "wood" if label.startswith("Barn") else "plaster"


# ---------- Builders ----------
def build_ground(d, mats):
    g = d["ground"]
    if g["max"] - g["min"] > 0.05:
        warn("ground in the slice is not flat (%.2f..%.2f m): flat proxy used; sculpt a Landscape for the slope" % (g["min"], g["max"]))
    # Slice ground (fine distance field) and an outer valley floor out past the mountain foot.
    s = d["slice"]
    gbox(s["x0"] - 40, -1.0, s["z0"] - 40, s["x1"] + 40, g["min"], s["z1"] + 40, mats["ground"], "Ground_Slice", "Ground")
    ring = 6000.0
    gbox(-ring, -1.2, -ring, ring, g["min"] - 0.02, ring, mats["ground"], "Ground_Valley", "Ground")


def build_barn(d, mats):
    L = d["layout"]
    B = L["barn"]
    eave, plinth = B["eave"], B["plinth"]
    for i, b in enumerate(x for x in d["boxes"] if x["group"] == "barn-shell"):
        mn, mx = b["min"], b["max"]
        gbox(mn["x"], 0.0, mn["z"], mx["x"], plinth, mx["z"], mats["stone"], "Barn_Plinth%d" % i, "Barn")
        gbox(mn["x"], plinth, mn["z"], mx["x"], eave, mx["z"], mats["wood"], "Barn_Wall%d" % i, "Barn")
    t = B["wall"]
    gbox(B["door"]["x0"], B["door"]["h"], B["z0"], B["door"]["x1"], eave, B["z0"] + t, mats["wood"], "Barn_LintelN", "Barn")
    gbox(B["back"]["x0"], B["back"]["h"], B["z1"] - t, B["back"]["x1"], eave, B["z1"], mats["wood"], "Barn_LintelS", "Barn")
    gbox(B["x0"] + t, 0.0, B["z0"] + t, B["x1"] - t, 0.03, B["z1"] - t, mats["woodDark"], "Barn_Floor", "Barn")
    gable_roof({"x0": B["x0"], "x1": B["x1"], "z0": B["z0"], "z1": B["z1"]}, eave, B["ridge"], mats, "Barn", "Barn",
               over=B["overhang"], th=0.3, solid_gables=False, wall=t)
    lo = L["loft"]
    gbox(lo["x0"], lo["y"] - 0.15, lo["z0"], lo["x1"], lo["y"], lo["z1"], mats["wood"], "Barn_Loft", "Barn")
    S = L["stalls"]
    for side in (-1, 1):   # straw bedding in the stalls
        gbox(side * S["aisle"], 0.03, S["z0"], side * S["manger"], 0.08, -S["z0"], mats["straw"], "Barn_Straw%+d" % side, "Barn/Stalls")
    groups = {"barn-door": ("woodDark", "Barn"), "stall": ("wood", "Barn/Stalls"), "manger": ("woodDark", "Barn/Stalls"),
              "barn-post": ("wood", "Barn/Stalls")}
    for i, b in enumerate(d["boxes"]):
        grp = b["group"]
        if grp in groups:
            mat, folder = groups[grp]
        elif grp == "barn-prop":
            cx = (b["min"]["x"] + b["max"]["x"]) / 2
            mat, folder = ("straw" if cx < -7 else "sacks" if cx > 7 else "wood"), "Barn/Props"
        else:
            continue
        c, s = U.box_to_ue(b)
        shape("Cube", c, s, mats[mat], "%s_%03d" % (grp, i), folder)


def build_yard(d, mats):
    L = d["layout"]
    houses = [("Farmhouse", L["farmhouse"])] + [("House%d" % (i + 1), h) for i, h in enumerate(L["houses"])] + [("H3", L["h3"])]
    for name, h in houses:
        gbox(h["x0"], 0.0, h["z0"], h["x1"], 0.6, h["z1"], mats["stone"], name + "_Plinth", "Yard")
        gbox(h["x0"], 0.6, h["z0"], h["x1"], 5.0, h["z1"], mats["plaster"], name + "_Body", "Yard")
        half = min(h["x1"] - h["x0"], h["z1"] - h["z0"]) / 2.0
        gable_roof(h, 5.0, 5.0 + 0.45 * half, mats, name, "Yard", over=0.4, th=0.22, solid_gables=True)
    # The farmhouse window with the TV glow (examinable 'tv'): an emissive pane just proud of the east wall.
    fh = L["farmhouse"]
    gbox(fh["x1"], 1.0, -2.6, fh["x1"] + 0.03, 2.0, -1.4, mats["tvWindow"], "Farmhouse_TVWindow", "Yard")
    for b in d["boxes"]:
        if b["group"] == "yard-prop":
            c, s = U.box_to_ue(b)
            shape("Cube", c, s, mats["stone"] if (b["max"]["x"] - b["min"]["x"]) > 1.5 else mats["woodDark"], "YardProp", "Yard")
        elif b["group"] == "shrine":
            c, s = U.box_to_ue(b)
            a = shape("Cube", c, s, mats["stone"], "Shrine", "Yard")
            STATS["shrine"] = a
            top = b["max"]
            sh = L["shrine"]
            gbox(sh["x"] - 0.03, top["y"], sh["z"] - 0.03, sh["x"] + 0.03, top["y"] + 0.12, sh["z"] + 0.03, mats["candle"], "Shrine_Candle", "Yard")
            p = spawn(unreal.PointLight, U.loc(sh["x"], top["y"] + 0.35, sh["z"]), None, "Shrine_CandleLight", "Lights")
            lc = p.get_component_by_class(unreal.PointLightComponent)
            set_props(lc, [("intensity_units", unreal.LightUnits.CANDELAS), ("intensity", 4.0), ("attenuation_radius", 450.0), ("use_temperature", True), ("temperature", 1800.0),
                           ("mobility", unreal.ComponentMobility.MOVABLE)])
        elif b["group"] == "stone-wall":
            c, s = U.box_to_ue(b)
            shape("Cube", c, s, mats["stone"], "NorthWall", "Yard")


def build_fences(d, mats):
    post, rail_h = 2.4, (0.35, 0.75, 1.12)
    for fi, (x0, z0, x1, z1) in enumerate(d["layout"]["fences"]):
        length = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(math.ceil(length / post)))
        for k in range(n + 1):
            x, z = x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n
            gbox(x - 0.06, 0.0, z - 0.06, x + 0.06, 1.25, z + 0.06, mats["fence"], "Fence%d_Post%02d" % (fi, k), "Fences")
        for j, y in enumerate(rail_h):
            if x0 == x1:
                gbox(x0 - 0.03, y - 0.06, min(z0, z1), x0 + 0.03, y + 0.06, max(z0, z1), mats["fence"], "Fence%d_Rail%d" % (fi, j), "Fences")
            else:
                gbox(min(x0, x1), y - 0.06, z0 - 0.03, max(x0, x1), y + 0.06, z0 + 0.03, mats["fence"], "Fence%d_Rail%d" % (fi, j), "Fences")


def build_trees(d, mats):
    for ti, t in enumerate(d["layout"]["trees"]):
        h = t["h"]
        trunk = h * 0.62
        shape("Cylinder", U.loc(t["x"], trunk / 2, t["z"]), (44, 44, trunk * 100), mats["woodDark"], "Tree%d_Trunk" % ti, "Trees")
        for k in range(5):    # leafless crown: five branches tilted 32..48 deg out of the trunk top
            tilt, yaw = 32 + 4 * k, 15 + 72 * k + 11 * ti
            ln = h * (0.42 - 0.03 * k)
            up = (math.sin(math.radians(tilt)) * math.cos(math.radians(yaw)), math.sin(math.radians(tilt)) * math.sin(math.radians(yaw)),
                  math.cos(math.radians(tilt)))
            base = U.loc(t["x"], trunk * (0.8 + 0.04 * k), t["z"])
            c = (base[0] + up[0] * ln * 50, base[1] + up[1] * ln * 50, base[2] + up[2] * ln * 50)
            shape("Cylinder", c, (12, 12, ln * 100), mats["woodDark"], "Tree%d_Branch%d" % (ti, k), "Trees", rot(pitch=-tilt, yaw=yaw))


def build_trail(d, mats):
    s = d["slice"]
    pts = d["trail"]["points"]
    n = 0
    for i in range(1, len(pts) - 1):
        x, z = pts[i]
        if not (s["x0"] <= x <= s["x1"] and s["z0"] <= z <= s["z1"]):
            continue
        dx, dz = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        ln = math.hypot(dx, dz) or 1.0
        side = 0.13 if i % 2 else -0.13          # alternate left/right hooves, single file
        px, pz = x + (-dz / ln) * side, z + (dx / ln) * side
        bearing = math.degrees(math.atan2(dx, -dz))
        inside_barn = abs(px) < 9.5 and abs(pz) < 9.5
        shape("Cube", U.loc(px, 0.04 if inside_barn else 0.004, pz), (14, 11, 1), mats["mud"], "Hoofprint_%03d" % i, "Trail",
              rot(yaw=U.bearing_to_yaw(bearing)), cast_shadow=False)
        n += 1
    log("trail: %d hoofprints" % n)


def build_mountain(d, mats):
    lm = d["landmarks"]
    cave = lm["caveMouth"]
    peak_rise = lm["peak"]["riseM"]
    R, FOOT = MOUNTAIN_RADIUS_M, 20.0     # the cone foot sits 20 m below the ground so its edge never shows
    # Place the cone so its SW face passes through the cave mouth: rise(d) + FOOT = (peak + FOOT) * (1 - (D - d) / R).
    D = cave["distanceM"] + R * (1 - (cave["riseM"] + FOOT) / (peak_rise + FOOT))
    b0 = d["lighting"]["mountain"]["bearing"]
    for name, db, k in (("Mountain", 0.0, 1.0), ("Mountain_ShoulderW", -23.0, 0.56), ("Mountain_ShoulderE", 27.0, 0.5)):
        dist = D if k == 1.0 else D * 1.08
        p = U.bearing_point(b0 + db, dist)
        h, rad = (peak_rise + FOOT) * k, R * (0.75 + 0.25 * k)
        a = shape("Cone", U.loc(p["x"], 0.0, p["z"]), (rad * 200, rad * 200, h * 100), mats["rock"] if k == 1.0 else mats["rockShade"],
                  name, "Mountain")
        origin, extent = a.get_actor_bounds(False)
        loc = a.get_actor_location()
        a.set_actor_location(unreal.Vector(loc.x, loc.y, loc.z + (-FOOT * 100.0 - (origin.z - extent.z))), False, False)   # foot 20 m below ground
    # Cave mouth: a black slab lying on the SW face at 2.8 km, 40 m wide, tilted to the face slope.
    slope = math.degrees(math.atan2(peak_rise + FOOT, R))
    p = U.bearing_point(cave["bearing"], cave["distanceM"])
    shape("Cube", U.loc(p["x"], cave["riseM"] + 1.5, p["z"]), (35 * 100, cave["widthM"] * 100, 3 * 100), mats["cave"], "CaveMouth", "Mountain",
          rot(pitch=slope, yaw=U.bearing_to_yaw(cave["bearing"])), cast_shadow=False)
    if not SHOW_MOUNTAIN_MESH:
        for a in EAS.get_all_level_actors():
            if a.get_actor_label().startswith(("Mountain", "CaveMouth")):
                a.set_actor_hidden_in_game(True)


def build_lighting(d, sky_mi):
    sun = d["lighting"]["sun"]
    pitch, yaw, _ = U.sun_rotation(sun["bearing"], sun["elevation"])
    a = spawn(unreal.DirectionalLight, (0, 0, 50000), rot(pitch=pitch, yaw=yaw), "Sun_240_4", "Lights")
    lc = a.get_component_by_class(unreal.DirectionalLightComponent)
    set_props(lc, [("mobility", unreal.ComponentMobility.MOVABLE), ("intensity", SUN_LUX), ("use_temperature", True),
                   ("temperature", SUN_KELVIN), ("atmosphere_sun_light", False), ("cast_shadows", True), ("light_source_angle", 0.53),
                   ("volumetric_scattering_intensity", 2.0)])
    STATS["sun"] = a
    # Backdrop: valley-sky.jpg on a 20 km sphere (unlit, IsSky). No SkyAtmosphere: the painted sky is the reference.
    if sky_mi:
        s = shape("Sphere", (0, 0, 0), (SKY_RADIUS_CM * 2,) * 3, sky_mi, "SkyBackdrop_ValleySky", "Lights", cast_shadow=False)
        smc = s.static_mesh_component
        smc.set_collision_profile_name("NoCollision")
        set_props(smc, [("mobility", unreal.ComponentMobility.MOVABLE), ("affect_distance_field_lighting", False),
                        ("affect_dynamic_indirect_lighting", False), ("visible_in_ray_tracing", False)])
    else:
        spawn(unreal.SkyAtmosphere, (0, 0, 0), None, "SkyAtmosphere", "Lights")
    sl = spawn(unreal.SkyLight, (0, 0, 1000), None, "SkyLight", "Lights")
    slc = sl.get_component_by_class(unreal.SkyLightComponent)
    set_props(slc, [("mobility", unreal.ComponentMobility.MOVABLE), ("real_time_capture", True), ("intensity", SKY_LIGHT_INTENSITY)])
    fog = spawn(unreal.ExponentialHeightFog, (0, 0, 0), None, "HeightFog_ColdBlue", "Lights")
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    r, g, b = [c * FOG_INSCATTER_SCALE for c in srgb_to_linear(FOG_HAZE_SRGB)]
    set_props(fc, [("fog_density", FOG_DENSITY), ("fog_height_falloff", FOG_FALLOFF), ("start_distance", FOG_START_CM),
                   (("fog_inscattering_luminance", "fog_inscattering_color"), unreal.LinearColor(r, g, b, 1.0)),
                   ("fog_cutoff_distance", FOG_CUTOFF_CM), ("enable_volumetric_fog", True)])
    ppv = spawn(unreal.PostProcessVolume, (0, 0, 0), None, "PostProcess_Dusk", "Lights")
    ppv.set_editor_property("unbound", True)
    s = ppv.get_editor_property("settings")
    set_props(s, [
        ("override_auto_exposure_method", True), ("auto_exposure_method", unreal.AutoExposureMethod.AEM_HISTOGRAM),
        ("override_auto_exposure_apply_physical_camera_exposure", True), ("auto_exposure_apply_physical_camera_exposure", False),
        ("override_auto_exposure_bias", True), ("auto_exposure_bias", EXPOSURE_BIAS),
        ("override_auto_exposure_min_brightness", True), ("auto_exposure_min_brightness", AE_MIN_EV),
        ("override_auto_exposure_max_brightness", True), ("auto_exposure_max_brightness", AE_MAX_EV),
        ("override_auto_exposure_speed_up", True), ("auto_exposure_speed_up", 2.0),
        ("override_auto_exposure_speed_down", True), ("auto_exposure_speed_down", 1.5),
        ("override_local_exposure_shadow_contrast_scale", True), ("local_exposure_shadow_contrast_scale", LOCAL_SHADOW_CONTRAST),
        ("override_local_exposure_highlight_contrast_scale", True), ("local_exposure_highlight_contrast_scale", 0.8),
        ("override_dynamic_global_illumination_method", True),
        ("dynamic_global_illumination_method", unreal.DynamicGlobalIlluminationMethod.LUMEN),
        ("override_reflection_method", True), ("reflection_method", unreal.ReflectionMethod.LUMEN),
        ("override_white_temp", True), ("white_temp", 6000.0),
        ("override_vignette_intensity", True), ("vignette_intensity", 0.3),
        ("override_color_saturation", True), ("color_saturation", unreal.Vector4(0.88, 0.88, 0.88, 1.0)),
        ("override_bloom_intensity", True), ("bloom_intensity", 0.5),
        ("override_motion_blur_amount", True), ("motion_blur_amount", 0.0),
    ])
    ppv.set_editor_property("settings", s)


def point_light(loc_cm, cd, radius_cm, label, shadows=True, kelvin=None):
    p = spawn(unreal.PointLight, loc_cm, None, label, "Lights/Lanterns")
    lc = p.get_component_by_class(unreal.PointLightComponent)
    set_props(lc, [("mobility", unreal.ComponentMobility.MOVABLE), ("intensity_units", unreal.LightUnits.CANDELAS),
                   ("intensity", cd), ("attenuation_radius", radius_cm), ("use_temperature", True),
                   ("temperature", kelvin or LANTERN_KELVIN), ("source_radius", 4.0), ("cast_shadows", shadows),
                   ("volumetric_scattering_intensity", 1.5)])
    return p


def lantern(mats, x, y, z, cd, radius_cm, label, shadows=True, chain_to=None):
    """Storm lantern (game m, centre of the glass): emissive glass, iron caps, optional chain up to y=chain_to."""
    for part, (y0, y1, w, mat) in {"Glass": (y - 0.14, y + 0.14, 0.18, "lantern"), "Cap": (y + 0.14, y + 0.19, 0.24, "iron"),
                                   "Base": (y - 0.18, y - 0.14, 0.22, "iron")}.items():
        b = {"min": {"x": x - w / 2, "y": y0, "z": z - w / 2}, "max": {"x": x + w / 2, "y": y1, "z": z + w / 2}}
        c, s = U.box_to_ue(b)
        shape("Cube", c, s, mats[mat], "%s_%s" % (label, part), "Lights/Lanterns", cast_shadow=False)
    if chain_to:
        ln = chain_to - (y + 0.19)
        shape("Cylinder", U.loc(x, y + 0.19 + ln / 2, z), (2, 2, ln * 100), mats["iron"], label + "_Chain", "Lights/Lanterns",
              cast_shadow=False)
    return point_light(U.loc(x, y, z), cd, radius_cm, label + "_Light", shadows)


def build_lanterns(d, mats):
    """Warm lanterns inside the barn (decisions: the barn reads by lantern light at dusk), one by the farmhouse door."""
    B = d["layout"]["barn"]
    eave = B["eave"]
    n = 0
    for z in (-4.0, 0.0, 4.0):        # tie beams over the post pairs, each with a lantern over the aisle
        gbox(B["x0"] + 0.25, eave - 0.3, z - 0.12, B["x1"] - 0.25, eave - 0.05, z + 0.12, mats["woodDark"], "Barn_TieBeam%+d" % z, "Barn")
        lantern(mats, 0.0, 3.4, z, LANTERN_CD, 1400.0, "Lantern_Aisle%+d" % z, shadows=True, chain_to=eave - 0.3)
        n += 1
    for x in (-5.82, 5.82):           # on the posts nearest each door, facing the aisle
        for z in (-8.0, 8.0):
            lantern(mats, x, 2.0, z, POST_LANTERN_CD, 900.0, "Lantern_Post%+d%+d" % (x, z), shadows=False)
            n += 1
    fh = d["layout"]["farmhouse"]
    lantern(mats, fh["x1"] + 0.2, 2.3, 1.5, 15.0, 900.0, "Lantern_Farmhouse", shadows=True)
    log("lanterns: %d (+1 farmhouse)" % n)


def cine_cam(label, pos, bearing, pitch, fov_v_deg=None, focal_mm=None):
    """CineCamera at game-metre pos, looking along a compass bearing; 36 x 20.25 mm back (16:9)."""
    cam = spawn(unreal.CineCameraActor, U.loc(pos[0], pos[1], pos[2]), rot(pitch=pitch, yaw=U.bearing_to_yaw(bearing)), label, "Cameras")
    cc = cam.get_cine_camera_component()
    fb = cc.get_editor_property("filmback")
    set_props(fb, [("sensor_width", 36.0), ("sensor_height", 20.25)])
    cc.set_editor_property("filmback", fb)
    lens = cc.get_editor_property("lens_settings")
    set_props(lens, [("min_focal_length", 8.0)])
    cc.set_editor_property("lens_settings", lens)
    focal = focal_mm or (20.25 / 2) / math.tan(math.radians(fov_v_deg / 2))
    set_props(cc, [("current_focal_length", focal)])
    fs = cc.get_editor_property("focus_settings")
    set_props(fs, [("focus_method", unreal.CameraFocusMethod.DISABLE)])
    cc.set_editor_property("focus_settings", fs)
    return cam


def look_at(src, dst):
    """(bearing, pitch) from game point src to dst (x east, y up, z south)."""
    dx, dy, dn = dst[0] - src[0], dst[1] - src[1], -(dst[2] - src[2])
    return math.degrees(math.atan2(dx, dn)) % 360.0, math.degrees(math.atan2(dy, math.hypot(dx, dn)))


# Stills for the trial (LS_Stills): label, eye (game m), target (game m), vertical FOV or focal mm.
STILLS = [
    ("Still_Yard", (-27.0, 3.0, 22.0), (0.0, 2.5, 0.0), 60.0, None),
    ("Still_Aerial", (-48.0, 32.0, 46.0), (2.0, 0.0, -6.0), 55.0, None),
    ("Still_BarnInterior", (0.6, 1.64, 8.4), (0.0, 1.3, -10.0), 70.0, None),
    ("Still_DoorNorth", (0.6, 1.7, -18.0), (0.0, 1.6, 0.0), 60.0, None),
    ("Still_Mountain", (4.0, 1.64, 21.5), None, None, 35.0),
]


def build_markers(d):
    sp = d["spawn"]
    ue_yaw = U.bearing_to_yaw(sp["bearing"])
    p = sp["pos"]
    # PlayerStart: location is the capsule centre (half-height 92 cm) standing on the spawn point.
    spawn(unreal.PlayerStart, (p["x"] * 100, p["z"] * 100, p["y"] * 100 + 92), rot(yaw=ue_yaw), "PlayerStart_Spawn", "Gameplay")
    # Opening-shot camera: Lorenzo's eye at the spawn, three.js FOV 70 deg vertical -> 14.46 mm on a 36 x 20.25 mm back.
    # Not auto-activated: the player's first-person camera owns the view; LS_OpeningDolly cuts to this camera at start.
    cam = cine_cam("OV_OpeningCam", (p["x"], p["y"] + sp["eyeHeight"], p["z"]), sp["bearing"], -1.72, fov_v_deg=sp["fovDeg"])
    stills = [cam]
    cave = d["landmarks"]["caveMouth"]
    for label, eye, tgt, fov, focal in STILLS:
        if tgt is None:              # the mountain still looks at the cave mouth
            tp = U.bearing_point(cave["bearing"], cave["distanceM"], cave["riseM"])
            tgt = (tp["x"], tp["y"], tp["z"])
        b, pt = look_at(eye, tgt)
        stills.append(cine_cam(label, eye, b, pt, fov_v_deg=fov, focal_mm=focal))
    for e in d["examinables"]:
        tp = spawn(unreal.TargetPoint, U.loc_v(e["pos"]), None, "Ex_%s" % e["id"], "Examinables")
        tp.set_editor_property("tags", list(tp.get_editor_property("tags")) + [unreal.Name("examinable:" + e["id"])])
    return cam, stills


def check_landmark(d):
    exp = d["checks"]["landmark"]["ueCm"]
    a = STATS.get("shrine")
    if not a:
        return {"ok": False, "why": "shrine not spawned"}
    l = a.get_actor_location()
    ok = abs(l.x - exp["x"]) < 1.0 and abs(l.y - exp["y"]) < 1.0
    sun = STATS["sun"].get_actor_rotation()
    fwd = STATS["sun"].get_actor_forward_vector()
    sun_ok = abs(sun.yaw - d["checks"]["sunLightUE"]["yaw"]) < 0.01 and abs(sun.pitch - d["checks"]["sunLightUE"]["pitch"]) < 0.01
    log("landmark shrine: expected (%.0f, %.0f) cm, actor (%.1f, %.1f, %.1f) -> %s" % (exp["x"], exp["y"], l.x, l.y, l.z, "OK" if ok else "MISMATCH"))
    log("sun: pitch %.2f yaw %.2f forward (%.3f, %.3f, %.3f) -> %s" % (sun.pitch, sun.yaw, fwd.x, fwd.y, fwd.z, "OK" if sun_ok else "MISMATCH"))
    return {"ok": ok and sun_ok, "shrineCm": [round(l.x, 1), round(l.y, 1), round(l.z, 1)], "sunPitchYaw": [round(sun.pitch, 2), round(sun.yaw, 2)]}


def main():
    t0 = time.time()
    result = {"ok": False, "map": MAP, "data": DATA}
    try:
        for line in U.self_test():
            log("units: " + line)
        with open(DATA, encoding="utf-8") as fh:
            d = json.load(fh)
        log("data: %s (%s, %d boxes)" % (DATA, d["source"]["sha256"], len(d["boxes"])))
        load_look()
        open_or_create_level(MAP)
        clear_generated()
        import ov_materials
        mats, sky_mi, result["materials"] = ov_materials.ensure_materials(SKY_INTENSITY)
        build_ground(d, mats)
        build_barn(d, mats)
        build_yard(d, mats)
        build_fences(d, mats)
        build_trees(d, mats)
        build_trail(d, mats)
        build_mountain(d, mats)
        build_lighting(d, sky_mi)
        build_lanterns(d, mats)
        cam, stills = build_markers(d)
        result["landmark"] = check_landmark(d)
        try:
            import make_opening_dolly
            result["sequence"] = make_opening_dolly.main(cam)
        except Exception as e:
            warn("opening dolly not built: %s" % e)
            result["sequence"] = None
        try:
            import make_stills
            result["stills"] = make_stills.main(stills)
        except Exception as e:
            warn("stills sequence not built: %s | %s" % (e, traceback.format_exc()))
            result["stills"] = None
        save_all()
        result.update(ok=bool(result["landmark"]["ok"]), actors=STATS["actors"], seconds=round(time.time() - t0, 1),
                      engine=unreal.SystemLibrary.get_engine_version(), source=d["source"]["sha256"])
        log("built %s: %d actors in %.1f s" % (MAP, STATS["actors"], time.time() - t0))
    except Exception as e:
        result["error"] = "%s\n%s" % (e, traceback.format_exc())
        unreal.log_error("[OV] build failed: " + result["error"])
    finally:
        os.makedirs(os.path.dirname(RESULT), exist_ok=True)
        with open(RESULT, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=1)
    return result


# Runs on -run=pythonscript / Execute Python Script; does nothing when imported as a module.
if __name__ != "build_barn_level":
    main()
