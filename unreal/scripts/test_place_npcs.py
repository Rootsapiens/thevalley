"""Pure test of the NPC placement maths (no `unreal` import). Run:  python unreal/scripts/test_place_npcs.py
Checks: ov_units landmark (shrine), the JSON from scripts/export-npcs.ts, the farmer's conversion, and that NPCs with
floorKnown false are placed at UE Z = 0 with the floor_to_confirm tag.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ov_units as U  # noqa: E402
import place_npcs as P  # noqa: E402  (imports without the engine: P.unreal is None)


def main():
    out = []
    # 1. Landmark from README section 4: shrine (22.55, -37.3) m -> (2255, -3730) cm.
    assert U._close(U.loc(22.55, 0.0, -37.3), (2255.0, -3730.0, 0.0))
    out.append("shrine (22.55, 0, -37.3) m -> (2255, -3730, 0) cm")
    # 2. JSON shape and the JS-side sample conversion agree with Python.
    with open(os.path.join(HERE, "..", "data", "village-npcs.json"), encoding="utf-8") as fh:
        d = json.load(fh)
    out += P.check_data(d)
    by_id = {n["id"]: n for n in d["npcs"]}
    # 3. Farmer by the trough faces the mountain at bearing 45 degrees (NE): UE yaw -45.
    f = P.plan_npc(by_id["npc_farmer"])
    assert U._close(f["feet"], (-1250.0, 850.0, 0.0)) and U._close(f["location"], (-1250.0, 850.0, 90.0)), f
    assert abs(f["yaw"] + 45.0) < 1e-9, f["yaw"]
    assert f["label"] == "npc_farmer" and "floor_to_confirm" not in f["tags"]
    assert {"OV_NPC", "spawnDay:1", "cuffed:false", "floorKnown:true"} <= set(f["tags"])
    out.append("npc_farmer -> feet (-1250, 850, 0) cm, faces mountain NE (yaw -45), tags OK")
    # 4. Unknown floors: Z = 0 (no guessed height) and tagged; Omar is cuffed.
    tbc = [n for n in d["npcs"] if not n["floorKnown"]]
    for n in tbc:
        p = P.plan_npc(n)
        assert p["feet"][2] == 0.0 and "floor_to_confirm" in p["tags"], (n["id"], p)
    assert "cuffed:true" in P.plan_npc(by_id["npc_omar"])["tags"]
    out.append("%d floor_to_confirm NPCs at Z 0: %s" % (len(tbc), ", ".join(n["id"] for n in tbc)))
    # 5. Known non-zero floor keeps its height: Maryam y -3.88 m -> Z -388 cm.
    assert U._close(P.plan_npc(by_id["npc_maryam"])["feet"], (7400.0, 1200.0, -388.0))
    return out


if __name__ == "__main__":
    for line in main():
        print("OK  " + line)
    print("test_place_npcs passed")
