"""First-pass interior dressing for enterable public/service village buildings.

Run after build_village.py so /Game/OmegaValley/Maps/Village exists. This module
only reads the exported village-town.json and uses build_barn_level's tagged
shape helpers. Re-running it replaces only actors tagged OV_ROOM_TAREQ.

The old school is the police post in the story. This pass replaces its opaque
block and those of the barns/shed with collision-bearing shells. The shed gets
a centered south doorway in Unreal only because its source building has no
door entry; the village JSON stays untouched.
"""
import json
import os
import sys

import unreal

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = None
SCRIPTS = HERE or os.path.join(unreal.Paths.project_dir(), "..", "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)

import build_barn_level as B  # noqa: E402
import ov_paths  # noqa: E402
import ov_units as U  # noqa: E402

MAP = "/Game/OmegaValley/Maps/Village"
TAG = "OV_ROOM_TAREQ"
TARGETS = ("church", "tower", "school", "barn-w", "barn-e", "shed")
SHELL_TARGETS = ("school", "barn-w", "barn-e", "shed")
WALL_T = 0.45


def _remove_previous():
    removed = 0
    for actor in B.EAS.get_all_level_actors():
        if actor.actor_has_tag(TAG):
            B.EAS.destroy_actor(actor)
            removed += 1
    return removed


def _shape(kind, xyz_m, size_m, mat, label, folder, rotation=None, collision=False):
    """Place a metre-sized shape in game axes; decorative pieces do not block navigation."""
    actor = B.shape(kind, U.loc(*xyz_m), U.size(*size_m), mat, label, folder, rotation=rotation)
    tags = list(actor.get_editor_property("tags"))
    if unreal.Name(TAG) not in tags:
        tags.append(unreal.Name(TAG))
        actor.set_editor_property("tags", tags)
    if not collision:
        actor.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    return actor


def _box(x0, y0, z0, x1, y1, z1, mat, label, folder, collision=True):
    """Axis-aligned box from game-space bounds in metres."""
    if x1 - x0 <= 0 or y1 - y0 <= 0 or z1 - z0 <= 0:
        return None
    return _shape("Cube", ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                  (x1 - x0, y1 - y0, z1 - z0), mat, label, folder, collision=collision)


def _door_for(b):
    doors = b.get("doors") or []
    if doors:
        return doors[0]
    if b["id"] == "shed":
        # The source shed is adjacent to Maryam's house and has no authored door.
        # A south-center opening faces the yard and remains local to this Unreal pass.
        return {"face": "s", "at": (b["x0"] + b["x1"]) / 2, "w": 1.25, "h": 1.95, "id": "unreal-shed-south"}
    return None


def _wall(b, face, y0, y1, door, mat, label, folder):
    """Build a wall band, cutting a full-height-to-floor door aperture if it lies on this face."""
    x0, x1, z0, z1 = b["x0"], b["x1"], b["z0"], b["z1"]
    if face in ("n", "s"):
        wz0, wz1 = (z0, z0 + WALL_T) if face == "n" else (z1 - WALL_T, z1)
        along0, along1 = x0, x1
        if not door or door["face"] != face:
            return _box(along0, y0, wz0, along1, y1, wz1, mat, label, folder)
        lo = max(along0, door["at"] - door["w"] / 2)
        hi = min(along1, door["at"] + door["w"] / 2)
        _box(along0, y0, wz0, lo, y1, wz1, mat, label + "_A", folder)
        _box(hi, y0, wz0, along1, y1, wz1, mat, label + "_B", folder)
        header = min(y1, b["floor"] + door["h"])
        _box(lo, header, wz0, hi, y1, wz1, mat, label + "_Header", folder)
    else:
        wx0, wx1 = (x0, x0 + WALL_T) if face == "w" else (x1 - WALL_T, x1)
        along0, along1 = z0, z1
        if not door or door["face"] != face:
            return _box(wx0, y0, along0, wx1, y1, along1, mat, label, folder)
        lo = max(along0, door["at"] - door["w"] / 2)
        hi = min(along1, door["at"] + door["w"] / 2)
        _box(wx0, y0, along0, wx1, y1, lo, mat, label + "_A", folder)
        _box(wx0, y0, hi, wx1, y1, along1, mat, label + "_B", folder)
        header = min(y1, b["floor"] + door["h"])
        _box(wx0, header, lo, wx1, y1, hi, mat, label + "_Header", folder)


def _replace_solid_shells(town, mats):
    """Remove original opaque box actors, then create walkable shells with safe door gaps."""
    targets = {b["id"]: b for b in town["buildings"] if b["id"] in SHELL_TARGETS}
    target_labels = set()
    for i, solid in enumerate(town["solids"]):
        if solid.get("group") == "building" and solid.get("id") in SHELL_TARGETS:
            target_labels.add("Town_%s_%03d" % (solid["id"], i))
    for actor in B.EAS.get_all_level_actors():
        if actor.get_actor_label() in target_labels:
            B.EAS.destroy_actor(actor)

    for building_id in SHELL_TARGETS:
        b = targets[building_id]
        door = _door_for(b)
        floor, base = b["floor"], b["base"]
        top = floor + b["eave"] + 0.5
        folder = "Town/Interiors/%s" % building_id
        wall_mat = mats["stone"] if building_id == "school" else mats["wood"]
        # Leave a clear opening at the authored door. Walls retain the original world bounds.
        for face in ("n", "e", "s", "w"):
            _wall(b, face, base, top, door, wall_mat, "%s_Wall_%s" % (building_id, face.upper()), folder)
        # Preserve doors marked locked by the village spec as a visible blocking leaf.
        # Door gaps remain clear only for authored open doors and the new shed opening.
        if door and door.get("use") not in (None, "open"):
            half = WALL_T / 2
            lo, hi = door["at"] - door["w"] / 2, door["at"] + door["w"] / 2
            if door["face"] in ("n", "s"):
                z = b["z0"] + half if door["face"] == "n" else b["z1"] - half
                _box(lo, floor, z - 0.06, hi, floor + door["h"], z + 0.06,
                     mats["woodDark"], "%s_LockedDoor" % building_id, folder)
            else:
                x = b["x0"] + half if door["face"] == "w" else b["x1"] - half
                _box(x - 0.06, floor, lo, x + 0.06, floor + door["h"], hi,
                     mats["woodDark"], "%s_LockedDoor" % building_id, folder)
        # Interior slab reaches exactly to the floor datum used by NPC/player placement.
        _box(b["x0"] + WALL_T, base, b["z0"] + WALL_T,
             b["x1"] - WALL_T, floor, b["z1"] - WALL_T,
             mats["stone"] if building_id == "school" else mats["woodDark"],
             "%s_InteriorFloor" % building_id, folder)
        # Low ceiling keeps rooms enclosed; the school ceiling matches townSolids' 2.7 m datum.
        ceiling_y = floor + (2.7 if building_id == "school" else max(2.15, b["eave"] - 0.25))
        _box(b["x0"], ceiling_y, b["z0"], b["x1"], ceiling_y + 0.22, b["z1"],
             wall_mat, "%s_InteriorCeiling" % building_id, folder)


def _school_police_post(b, mats):
    """Simple blockout aligned with src/interiors.ts's old-school police post."""
    f, z = b["floor"], b["z0"]
    folder = "Town/Interiors/school"
    # Moreno's desk/chair, evidence storage, stove and waiting bench. The east door at z=47.5 stays clear.
    _box(-17.15, f, 44.62, -16.05, f + 0.78, 45.32, mats["wood"], "Post_Desk", folder)
    for i, (x, zz) in enumerate(((-17.1, 44.7), (-16.2, 44.7), (-17.1, 45.25), (-16.2, 45.25))):
        _box(x, f, zz, x + 0.12, f + 0.74, zz + 0.12, mats["woodDark"], "Post_DeskLeg_%d" % i, folder)
    _box(-17.95, f, 44.66, -17.35, f + 0.45, 45.31, mats["woodDark"], "Post_ChairSeat", folder)
    _box(-17.93, f + 0.45, 45.18, -17.81, f + 1.05, 45.30, mats["wood"], "Post_ChairBack", folder)
    _box(-15.7, f, z + 0.55, -14.35, f + 2.0, z + 1.15, mats["woodDark"], "Post_FileShelf", folder)
    _box(-13.15, f, z + 0.55, -12.2, f + 0.62, z + 1.3, mats["wood"], "Post_EvidenceChest", folder)
    _box(-18.95, f, z + 0.55, -18.25, f + 0.82, z + 1.25, mats["iron"], "Post_Stove", folder)
    _box(-19.0, f, 49.25, -18.35, f + 1.15, 49.95, mats["woodDark"], "Post_Cupboard", folder)
    _box(-15.65, f, 53.35, -14.25, f + 0.48, 54.05, mats["wood"], "Post_WaitingBench", folder)


def _barn_room(b, mats, suffix):
    f, folder = b["floor"], "Town/Interiors/%s" % b["id"]
    # Hay and feed stay along the north edge; the central aisle from the door remains open.
    x0, x1, z0, z1 = b["x0"], b["x1"], b["z0"], b["z1"]
    for i in range(3):
        xx = x0 + 1.6 + i * 1.45
        _box(xx, f, z0 + 0.75, xx + 1.1, f + 0.85, z0 + 1.7, mats["straw"], "%s_HayBale_%d" % (suffix, i), folder)
    _box(x0 + 0.65, f, z1 - 1.0, x0 + 2.1, f + 0.8, z1 - 0.55, mats["woodDark"], "%s_FeedingTrough" % suffix, folder)
    _box(x1 - 1.25, f, z0 + 2.4, x1 - 0.55, f + 0.9, z0 + 3.1, mats["sacks"], "%s_FeedSacks" % suffix, folder)


def _shed_room(b, mats):
    f, folder = b["floor"], "Town/Interiors/shed"
    # Narrow wall-side storage keeps a straight path from the new south opening.
    _box(b["x0"] + 0.62, f, b["z0"] + 0.65, b["x1"] - 0.62, f + 1.25, b["z0"] + 1.0,
         mats["woodDark"], "Shed_ToolBench", folder)
    _box(b["x0"] + 0.62, f + 1.25, b["z0"] + 0.65, b["x1"] - 0.62, f + 1.95, b["z0"] + 0.95,
         mats["wood"], "Shed_WallShelf", folder)
    _box(b["x0"] + 0.62, f, b["z0"] + 1.25, b["x1"] - 0.62, f + 0.65, b["z0"] + 1.9,
         mats["sacks"], "Shed_StorageCrate", folder)
    # The town builder has no lean-roof mesh pass; cap this small shell with a shallow sloped roof.
    _shape("Cube", ((b["x0"] + b["x1"]) / 2, f + b["eave"] + 0.16, (b["z0"] + b["z1"]) / 2),
           (b["x1"] - b["x0"] + 0.5, 0.24, b["z1"] - b["z0"] + 0.5), mats["roof"],
           "Shed_LeanRoof", folder, rotation=B.rot(pitch=6.0), collision=True)


def _church(b, mats):
    floor = b["floor"]
    cx = (b["x0"] + b["x1"]) / 2.0
    cz = (b["z0"] + b["z1"]) / 2.0
    folder = "Town/Interiors/church"

    # A compact lectern sits along the west wall, outside the entrance-to-aisle route.
    x, z = b["x0"] + 1.25, cz
    _shape("Cube", (x, floor + 0.44, z), (0.16, 0.88, 0.16), mats["woodDark"], "Church_Lectern_Pedestal", folder, collision=True)
    _shape("Cube", (x, floor + 0.91, z), (0.72, 0.12, 0.55), mats["wood"], "Church_Lectern_Top", folder, rotation=B.rot(roll=-8), collision=True)
    _shape("Cube", (x, floor + 1.01, z - 0.07), (0.34, 0.035, 0.25), mats["sacks"], "Church_Lectern_Book", folder, rotation=B.rot(roll=-8))

    # Simple wall cross at the east end, kept just inside the end wall.
    wall_x = b["x1"] - 0.58
    _shape("Cube", (wall_x, floor + 2.75, cz), (0.09, 1.55, 0.16), mats["woodDark"], "Church_Cross_Vertical", folder)
    _shape("Cube", (wall_x - 0.025, floor + 3.12, cz), (0.10, 0.18, 0.95), mats["woodDark"], "Church_Cross_Beam", folder)

    # Low-profile candle sconces on the north and south walls. Keep the south entry clear.
    for side, z_wall in (("North", b["z0"] + 0.58), ("South", b["z1"] - 0.58)):
        for i, x_wall in enumerate((b["x0"] + 2.0, b["x1"] - 2.0)):
            xx = x_wall
            zz = z_wall
            _shape("Cube", (xx, floor + 2.05, zz), (0.32, 0.10, 0.12), mats["iron"], "Church_%s_Sconce%d_Base" % (side, i), folder)
            # The short arm extends from the wall into the room.
            arm_z = zz + (0.14 if side == "North" else -0.14)
            _shape("Cube", (xx, floor + 1.98, arm_z), (0.07, 0.07, 0.32), mats["iron"], "Church_%s_Sconce%d_Arm" % (side, i), folder)
            _shape("Cylinder", (xx, floor + 2.18, arm_z), (0.10, 0.10, 0.30), mats["candle"], "Church_%s_Sconce%d_Candle" % (side, i), folder)


def _tower(b, mats):
    floor = b["floor"]
    cx = (b["x0"] + b["x1"]) / 2.0
    z = b["z0"] + 0.88
    folder = "Town/Interiors/tower"
    # Visual ladder aligned with the existing tower ladder collision volume. No extra collision is added.
    for side, x in (("L", cx - 0.43), ("R", cx + 0.43)):
        _shape("Cube", (x, floor + 1.65, z), (0.12, 3.3, 0.12), mats["woodDark"], "Tower_Ladder_Rail_" + side, folder)
    for i in range(9):
        y = floor + 0.28 + i * 0.36
        _shape("Cube", (cx, y, z - 0.04), (0.86, 0.09, 0.10), mats["wood"], "Tower_Ladder_Rung_%02d" % i, folder)
    # A small hanging lantern rests high enough to clear the entry and ladder.
    _shape("Cube", (b["x1"] - 0.78, floor + 2.35, b["z1"] - 0.88), (0.32, 0.42, 0.32), mats["woodDark"], "Tower_Lantern_Frame", folder)
    _shape("Cube", (b["x1"] - 0.78, floor + 2.35, b["z1"] - 0.88), (0.20, 0.28, 0.20), mats["lantern"], "Tower_Lantern_Glow", folder)


def decorate(town, mats):
    """Dress public/service rooms in the currently open Village map."""
    buildings = {b["id"]: b for b in town["buildings"] if b["id"] in TARGETS}
    missing = sorted(set(TARGETS) - set(buildings))
    if missing:
        raise RuntimeError("village-town.json is missing target buildings: %s" % ", ".join(missing))
    if not B.EAL.does_asset_exist(MAP):
        raise RuntimeError("Build the village map first: %s" % MAP)
    removed = _remove_previous()
    _replace_solid_shells(town, mats)
    dressed = []
    for building_id in TARGETS:
        b = buildings[building_id]
        if building_id == "church":
            _church(b, mats)
        elif building_id == "tower":
            _tower(b, mats)
        elif building_id == "school":
            _school_police_post(b, mats)
        elif building_id in ("barn-w", "barn-e"):
            _barn_room(b, mats, building_id.replace("-", "_").title())
        elif building_id == "shed":
            _shed_room(b, mats)
        dressed.append(building_id)

    result = {"ok": True, "map": MAP, "replacedActors": removed, "dressed": dressed,
              "addedShedDoor": True, "policePostBuilding": "school"}
    B.log("room dressing: %s" % ", ".join(dressed))
    return result


def main():
    town_path = ov_paths.data_file(B.PROJECT_DIR, "village-town.json")
    with open(town_path, encoding="utf-8") as fh:
        town = json.load(fh)
    B.open_or_create_level(MAP)
    B.load_look()
    import ov_materials
    mats, _, _ = ov_materials.ensure_materials(B.SKY_INTENSITY)
    result = decorate(town, mats)
    B.save_all()
    return result


if __name__ == "__main__":
    main()
