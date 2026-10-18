"""Game space -> Unreal space conversion for Omega Valley. Pure Python (no `unreal` import), so it can be tested anywhere.

Game (src/village.ts, Three.js): metres, right-handed, x east, y up, z south. Yaw 0 looks north (-z), positive turns left.
Unreal: centimetres, left-handed, Z up. We map UE X = east, UE Y = south, UE Z = up. Swapping y and z is a reflection,
which turns the right-handed game frame into UE's left-handed one, so nothing is mirrored.
Compass bearing b (0 north, 90 east) -> UE yaw = b - 90 (UE yaw 0 faces +X = east, +90 faces +Y = south).

Self-test:  python unreal/scripts/ov_units.py [unreal/data/village-barn.json]
"""
import json
import math
import os
import sys

M_TO_CM = 100.0


def loc(x, y, z):
    """Game point (m, y up) -> UE location tuple (cm, Z up)."""
    return (x * M_TO_CM, z * M_TO_CM, y * M_TO_CM)


def loc_v(p):
    """Same as loc() for a {'x','y','z'} dict."""
    return loc(p["x"], p["y"], p["z"])


def size(sx, sy, sz):
    """Game extents (m) along x, y(up), z -> UE extents (cm) along X, Y, Z."""
    return (sx * M_TO_CM, sz * M_TO_CM, sy * M_TO_CM)


def box_to_ue(b):
    """Game AABB {'min','max'} -> (centre_cm, size_cm) in UE space."""
    mn, mx = b["min"], b["max"]
    c = loc((mn["x"] + mx["x"]) / 2, (mn["y"] + mx["y"]) / 2, (mn["z"] + mx["z"]) / 2)
    s = size(mx["x"] - mn["x"], mx["y"] - mn["y"], mx["z"] - mn["z"])
    return c, s


def wrap180(a):
    return (a + 180.0) % 360.0 - 180.0


def bearing_to_yaw(bearing_deg):
    """Compass bearing -> UE yaw (deg)."""
    return wrap180(bearing_deg - 90.0)


def game_yaw_to_bearing(yaw_rad):
    """Game camera yaw (rad, 0 north, + left) -> compass bearing (deg)."""
    return (-math.degrees(yaw_rad)) % 360.0


def sun_rotation(bearing_deg, elevation_deg):
    """(pitch, yaw, roll) for a UE DirectionalLight whose sun sits at bearing/elevation.
    The light's forward vector is the travel direction: away from the sun, downward."""
    return (-elevation_deg, bearing_to_yaw(bearing_deg + 180.0), 0.0)


def forward(pitch_deg, yaw_deg):
    """UE forward vector for a rotator (X east, Y south, Z up)."""
    p, y = math.radians(pitch_deg), math.radians(yaw_deg)
    return (math.cos(p) * math.cos(y), math.cos(p) * math.sin(y), math.sin(p))


def bearing_point(bearing_deg, dist_m, rise_m=0.0):
    """Game point at a compass bearing and distance from the origin (m)."""
    b = math.radians(bearing_deg)
    return {"x": math.sin(b) * dist_m, "y": rise_m, "z": -math.cos(b) * dist_m}


def _close(a, b, tol=1e-6):
    return all(abs(p - q) <= tol for p, q in zip(a, b))


def self_test(data=None):
    """Raises AssertionError on failure. Returns a list of human-readable check lines."""
    out = []
    # 1. Landmark: the roadside shrine (village.ts SHRINE = x 22.55, z -37.3) -> 22.55 m east, 37.3 m north.
    shrine = {"x": 22.55, "y": 0.0, "z": -37.3}
    ue = loc_v(shrine)
    assert _close(ue, (2255.0, -3730.0, 0.0)), ue
    out.append("shrine (22.55, 0, -37.3) m -> (%.0f, %.0f, %.0f) cm" % ue)
    # North is -Y in UE, east +X: the shrine is NE of the barn, so X > 0 and Y < 0.
    assert ue[0] > 0 and ue[1] < 0
    # 2. Up is up: a point 5.2 m high (barn eave) -> Z 520 cm.
    assert _close(loc(0, 5.2, 0), (0, 0, 520.0))
    # 3. Bearings: 90 (east) -> yaw 0, 0 (north) -> yaw -90 -> forward (0, -1, 0).
    assert _close(forward(0, bearing_to_yaw(0)), (0, -1, 0)) and _close(forward(0, bearing_to_yaw(90)), (1, 0, 0))
    # 4. Sun per decisions-noor.md: at bearing 240, 4 deg up -> light travels to bearing 60 (ENE), downward.
    pitch, yaw, _ = sun_rotation(240, 4)
    f = forward(pitch, yaw)
    assert abs(pitch + 4) < 1e-9 and abs(yaw + 30) < 1e-9, (pitch, yaw)
    assert f[0] > 0 and f[1] < 0 and f[2] < 0          # east, north, down
    out.append("sun 240/4 -> DirectionalLight pitch %.0f yaw %.0f (shadows ENE)" % (pitch, yaw))
    # 5. Mountain bearing 45 is NE: +X, -Y.
    m = loc_v(bearing_point(45, 1000))
    assert m[0] > 0 and m[1] < 0 and abs(m[0] + m[1]) < 1e-6
    # 6. Spawn yaw -22 deg -> bearing 22 -> UE yaw -68.
    assert abs(bearing_to_yaw(game_yaw_to_bearing(math.radians(-22))) + 68) < 1e-9
    if data:
        c = data["checks"]
        assert _close(loc_v(c["landmark"]["game"]), (c["landmark"]["ueCm"]["x"], c["landmark"]["ueCm"]["y"], c["landmark"]["ueCm"]["z"]))
        assert _close(sun_rotation(data["lighting"]["sun"]["bearing"], data["lighting"]["sun"]["elevation"])[:2],
                      (c["sunLightUE"]["pitch"], c["sunLightUE"]["yaw"]))
        assert abs(bearing_to_yaw(game_yaw_to_bearing(data["spawn"]["yaw"])) - c["spawnYawUE"]) < 1e-3
        out.append("JSON checks (JS conversion) agree with Python: landmark, sun, spawn yaw")
    return out


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "data", "village-barn.json")
    d = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
    for line in self_test(d):
        print("OK  " + line)
    print("ov_units self-test passed")
