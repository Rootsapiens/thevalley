"""First-pass blockout furniture for residential rooms and the village cafe.

Call decorate(town, mats) after build_village.build_town(). Uses only B.shape helpers and
the generated OV palette. Re-runnable: it removes only actors tagged OV_ROOM_AUTO, then
rebuilds replacement shells (for currently solid target buildings) and their furniture.
All measurements are read from village-town.json; coordinates are game metres.
"""
import os
import sys

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass

import build_barn_level as B
import ov_units as U

ROOM_TAG = "OV_ROOM_AUTO"
WALL_T = 0.32
ROOM_H = 2.65


def _tag(actor):
    tags = list(actor.get_editor_property("tags"))
    if unreal.Name(ROOM_TAG) not in tags:
        tags.append(unreal.Name(ROOM_TAG))
        actor.set_editor_property("tags", tags)
    return actor


def _box(mats, label, folder, x0, y0, z0, x1, y1, z1, mat):
    """Spawn a box from game-space bounds through the project's canonical axis conversion."""
    bounds = {
        "min": {"x": min(x0, x1), "y": min(y0, y1), "z": min(z0, z1)},
        "max": {"x": max(x0, x1), "y": max(y0, y1), "z": max(z0, z1)},
    }
    centre, size = U.box_to_ue(bounds)
    return _tag(B.shape("Cube", centre, size, mats[mat], label, folder))


def _cylinder(mats, label, folder, x, y, z, sx, sy, sz, mat):
    return _tag(B.shape("Cylinder", U.loc(x, y, z), U.size(sx, sy, sz), mats[mat], label, folder))


def _wall_piece(mats, bid, face, x0, z0, x1, z1, y0, y1):
    if x1 - x0 <= 0.02 or z1 - z0 <= 0.02 or y1 - y0 <= 0.02:
        return
    _box(mats, "RoomShell_%s_%s" % (bid, face), "Town/Rooms/%s/Shell" % bid,
         x0, y0, z0, x1, y1, z1, "plaster")


def _split_wall(mats, b, face, y0, y1, door=None):
    """Build one perimeter wall with an optional door opening, plus lintel and locked leaf."""
    bid = b["id"]
    t = WALL_T
    if face in ("n", "s"):
        z = b["z0"] if face == "n" else b["z1"] - t
        za, zb = z, z + t
        lo, hi = b["x0"], b["x1"]
    else:
        x = b["x0"] if face == "w" else b["x1"] - t
        xa, xb = x, x + t
        lo, hi = b["z0"], b["z1"]

    if door is None or door["face"] != face:
        if face in ("n", "s"):
            _wall_piece(mats, bid, face, lo, za, hi, zb, y0, y1)
        else:
            _wall_piece(mats, bid, face, xa, lo, xb, hi, y0, y1)
        return

    d0, d1 = door["at"] - door["w"] / 2.0, door["at"] + door["w"] / 2.0
    if face in ("n", "s"):
        _wall_piece(mats, bid, face + "L", lo, za, d0, zb, y0, y1)
        _wall_piece(mats, bid, face + "R", d1, za, hi, zb, y0, y1)
        if y0 + door["h"] < y1:
            _wall_piece(mats, bid, face + "Lintel", d0, za, d1, zb, y0 + door["h"], y1)
        leaf_z = z + t / 2
        if door.get("use") != "open":
            _box(mats, "RoomDoor_%s" % bid, "Town/Rooms/%s/Shell" % bid,
                 d0, y0, leaf_z - 0.045, d1, y0 + door["h"], leaf_z + 0.045, "woodDark")
    else:
        _wall_piece(mats, bid, face + "L", xa, lo, xb, d0, y0, y1)
        _wall_piece(mats, bid, face + "R", xa, d1, xb, hi, y0, y1)
        if y0 + door["h"] < y1:
            _wall_piece(mats, bid, face + "Lintel", xa, d0, xb, d1, y0 + door["h"], y1)
        leaf_x = x + t / 2
        if door.get("use") != "open":
            _box(mats, "RoomDoor_%s" % bid, "Town/Rooms/%s/Shell" % bid,
                 leaf_x - 0.045, y0, d0, leaf_x + 0.045, y0 + door["h"], d1, "woodDark")


def _replace_solid_shell(town, building, mats):
    """Replace a single opaque town block with simple four-wall room geometry."""
    bid = building["id"]
    solids = [(i, s) for i, s in enumerate(town["solids"])
              if s.get("group") == "building" and s.get("id") == bid]
    if not solids:
        raise RuntimeError("no town building solids found for %s" % bid)
    # Non-hollow buildings in the exporter have one block. Remove it if still present;
    # shell labels are separate and are cleaned by ROOM_TAG on each invocation.
    for i, _ in solids:
        label = "Town_%s_%03d" % (bid, i)
        for actor in B.EAS.get_all_level_actors():
            if actor.get_actor_label() == label and not actor.actor_has_tag(ROOM_TAG):
                B.EAS.destroy_actor(actor)

    floor, top = building["floor"], building["floor"] + ROOM_H
    _box(mats, "RoomFloor_%s" % bid, "Town/Rooms/%s/Shell" % bid,
         building["x0"] + WALL_T, floor - 0.12, building["z0"] + WALL_T,
         building["x1"] - WALL_T, floor, building["z1"] - WALL_T, "woodDark")
    door = (building.get("doors") or [None])[0]
    for face in ("n", "s", "w", "e"):
        _split_wall(mats, building, face, floor, top, door)
    _box(mats, "RoomCeiling_%s" % bid, "Town/Rooms/%s/Shell" % bid,
         building["x0"], top, building["z0"], building["x1"], top + 0.12,
         building["z1"], "woodDark")


def _furniture(mats, bid, name, x, z, floor, w, d, top, mat="wood"):
    """Low table or bed platform, keeping at least a metre of circulation at the entrance."""
    _box(mats, "%s_%s_Top" % (bid, name), "Town/Rooms/%s/Furniture" % bid,
         x - w / 2, floor + top - 0.12, z - d / 2,
         x + w / 2, floor + top, z + d / 2, mat)
    leg = min(0.12, w / 5, d / 5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            _box(mats, "%s_%s_Leg_%s_%s" % (bid, name, sx, sz), "Town/Rooms/%s/Furniture" % bid,
                 x + sx * (w / 2 - leg / 2) - leg / 2, floor, z + sz * (d / 2 - leg / 2) - leg / 2,
                 x + sx * (w / 2 - leg / 2) + leg / 2, floor + top - 0.12,
                 z + sz * (d / 2 - leg / 2) + leg / 2, mat)


def _chair(mats, bid, name, x, z, floor, yaw=0.0):
    # Compact chair blockout: seat and back, with a small footprint for traversal.
    _box(mats, "%s_%s_Seat" % (bid, name), "Town/Rooms/%s/Furniture" % bid,
         x - 0.23, floor + 0.44, z - 0.23, x + 0.23, floor + 0.53, z + 0.23, "wood")
    _box(mats, "%s_%s_Back" % (bid, name), "Town/Rooms/%s/Furniture" % bid,
         x - 0.23, floor + 0.53, z - 0.28, x + 0.23, floor + 0.92, z - 0.18, "woodDark")
    for sx in (-1, 1):
        for sz in (-1, 1):
            _box(mats, "%s_%s_Leg_%s_%s" % (bid, name, sx, sz), "Town/Rooms/%s/Furniture" % bid,
                 x + sx * 0.16 - 0.035, floor, z + sz * 0.16 - 0.035,
                 x + sx * 0.16 + 0.035, floor + 0.44, z + sz * 0.16 + 0.035, "woodDark")


def _decorate_room(b, mats):
    bid, floor = b["id"], b["floor"]
    cx, cz = (b["x0"] + b["x1"]) / 2, (b["z0"] + b["z1"]) / 2
    folder = "Town/Rooms/%s/Props" % bid
    if bid == "cafe":
        # Preserve the north entrance at x=7; keep a clear entry aisle through the middle.
        _furniture(mats, bid, "Bar", 13.4, b["z1"] - 1.15, floor, 4.4, 0.8, 1.0)
        for i, x in enumerate((11.9, 13.2, 14.5)):
            _cylinder(mats, "cafe_Barstool_%02d" % i, folder, x, floor + 0.38,
                      b["z1"] - 2.1, 0.24, 0.24, 0.76, "woodDark")
        for i, (x, z) in enumerate(((4.0, 63.4), (4.2, 67.2), (17.0, 63.4), (17.0, 67.2))):
            _cylinder(mats, "cafe_Table_%02d" % i, folder, x, floor + 0.72, z,
                      0.68, 0.68, 0.10, "wood")
            _cylinder(mats, "cafe_TableBase_%02d" % i, folder, x, floor + 0.36, z,
                      0.12, 0.12, 0.72, "woodDark")
            _chair(mats, bid, "Chair_%02dA" % i, x - 0.78, z, floor)
            _chair(mats, bid, "Chair_%02dB" % i, x + 0.78, z, floor)
        _cylinder(mats, "cafe_WineBarrel", folder, 1.5, floor + 0.43,
                  b["z1"] - 1.0, 0.55, 0.55, 0.86, "woodDark")
        return

    if bid == "maryam":
        # Unnamed resident's kitchen: retain an uncluttered walk line from the south door.
        _furniture(mats, bid, "KitchenTable", 74.4, 9.8, floor, 2.2, 0.95, 0.94)
        _chair(mats, bid, "KitchenChair_W", 72.85, 9.8, floor)
        _chair(mats, bid, "KitchenChair_E", 75.95, 9.8, floor)
        _box(mats, "maryam_Cupboard", "Town/Rooms/maryam/Furniture",
             71.25, floor, 8.2, 71.85, floor + 1.75, 9.5, "woodDark")
        _cylinder(mats, "maryam_Stove", "Town/Rooms/maryam/Props",
                  78.2, floor + 0.48, 7.2, 0.62, 0.62, 0.96, "iron")
        return

    # Small homes share a modest table and a bed/cot; keep role-specific furnishings generic.
    door = (b.get("doors") or [None])[0]
    table_z = cz + (0.45 if door and door["face"] == "n" else -0.25)
    _furniture(mats, bid, "HouseTable", cx - 0.15, table_z, floor, 1.35, 0.8, 0.78)
    _chair(mats, bid, "HouseChair", cx + 0.95, table_z, floor)
    _furniture(mats, bid, "Cot", cx + 1.35, cz + 1.55, floor, 1.8, 0.85, 0.42, "woodDark")
    _box(mats, "%s_Cupboard" % bid, "Town/Rooms/%s/Furniture" % bid,
         b["x0"] + 0.55, floor, b["z1"] - 1.0, b["x0"] + 1.12,
         floor + 1.55, b["z1"] - 0.5, "woodDark")
    if bid == "priest":
        _box(mats, "priest_Bookshelf", "Town/Rooms/priest/Furniture",
             b["x1"] - 0.75, floor, b["z0"] + 0.45,
             b["x1"] - 0.25, floor + 1.85, b["z0"] + 1.15, "wood")
        for i, y in enumerate((floor + 0.6, floor + 1.05, floor + 1.5)):
            _box(mats, "priest_BookRow_%02d" % i, "Town/Rooms/priest/Props",
                 b["x1"] - 0.69, y, b["z0"] + 0.5,
                 b["x1"] - 0.31, y + 0.12, b["z0"] + 1.1, "woodDark")


def decorate(town, mats):
    """Decorate all house shells (including priest and Maryam) plus the cafe."""
    actors_before = B.STATS.get("actors", 0)
    removed = 0
    for actor in list(B.EAS.get_all_level_actors()):
        if actor.actor_has_tag(ROOM_TAG):
            B.EAS.destroy_actor(actor)
            removed += 1

    targets = [b for b in town["buildings"] if b.get("kind") in ("house", "cafe")]
    for b in targets:
        # Maryam is already a hollow shell in the source data. All other room targets
        # are currently exported as opaque blocks, so make their shell traversable here.
        if not b.get("hollow"):
            _replace_solid_shell(town, b, mats)
        _decorate_room(b, mats)

    result = {"rooms": len(targets), "addedActors": B.STATS.get("actors", 0) - actors_before,
              "removedPreviousActors": removed}
    B.log("room blockout: %d rooms decorated (%d previous actors replaced)" % (len(targets), removed))
    return result


if __name__ == "__main__":
    import json
    import ov_materials
    import build_village

    with open(build_village.TOWN, encoding="utf-8") as src:
        _town = json.load(src)
    _mats, _, _ = ov_materials.ensure_materials(B.SKY_INTENSITY)
    B.open_or_create_level(build_village.MAP)
    decorate(_town, _mats)
    B.save_all()
