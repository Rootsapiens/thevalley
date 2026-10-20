"""Offline story-state checks. Run: python unreal/scripts/test_npc_story_state.py"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from npc_story_state import BINDING_ORDER, apply_request  # noqa: E402


with open(os.path.join(HERE, "..", "data", "village-npcs.json"), encoding="utf-8") as _fh:
    DATA = json.load(_fh)


def state(count=0, **overrides):
    result = {"chapter": 1, "day": 1, "events": list(BINDING_ORDER[:count])}
    result.update(overrides)
    return result


def plan(result, npc_id):
    return next(item for item in result["plans"] if item["id"] == npc_id)


class StoryStateTests(unittest.TestCase):
    def test_prologue_only_shows_non_talkable_farmer(self):
        result = apply_request(DATA, state(prologue=True), set())
        self.assertEqual(result["visible"], ["npc_farmer"])
        self.assertFalse(plan(result, "npc_farmer")["talkable"])

    def test_cafe_omar_needs_scene_anchor(self):
        result = apply_request(DATA, state(), set())
        self.assertFalse(plan(result, "npc_omar")["visible"])
        self.assertIn("OV_StoryAnchor_OmarCafe", result["warnings"][0])
        result = apply_request(DATA, state(), {"OV_StoryAnchor_OmarCafe"})
        self.assertTrue(plan(result, "npc_omar")["visible"])
        self.assertEqual(plan(result, "npc_omar")["stage"], "cafe-before-attack")

    def test_attack_and_escape_do_not_show_omar_at_post(self):
        for count, expected in ((2, "root-attack"), (3, "escaped-memory-loss")):
            result = apply_request(DATA, state(count), set())
            self.assertFalse(plan(result, "npc_omar")["visible"])
            self.assertEqual(plan(result, "npc_omar")["stage"], expected)

    def test_found_stage_uses_anchor_and_transport_can_be_explicit(self):
        found = apply_request(DATA, state(4), {"OV_StoryAnchor_OmarMountain"})
        self.assertTrue(plan(found, "npc_omar")["visible"])
        self.assertEqual(plan(found, "npc_omar")["anchorLabel"], "OV_StoryAnchor_OmarMountain")
        transit = apply_request(DATA, state(4, transportActive=True), set())
        self.assertTrue(plan(transit, "npc_omar")["visible"])
        self.assertEqual(plan(transit, "npc_omar")["stage"], "police-transport")
        self.assertEqual(plan(transit, "npc_omar")["locationGame"], [-7.2, 0.0, 44.2])
        self.assertTrue(plan(transit, "npc_omar")["cuffed"])

    def test_post_transport_cuffs_change_only_after_guarded_medical(self):
        cuffed = apply_request(DATA, state(5), set())
        self.assertTrue(plan(cuffed, "npc_omar")["visible"])
        self.assertTrue(plan(cuffed, "npc_omar")["cuffed"])
        treated = apply_request(DATA, state(5, medicalCheckComplete=True), set())
        self.assertFalse(plan(treated, "npc_omar")["cuffed"])
        self.assertTrue(plan(treated, "npc_omar")["talkable"])

    def test_elia_requires_day_two_assignment_and_medical_check(self):
        pre_assignment = apply_request(DATA, state(5, chapter=1, day=2), set())
        self.assertFalse(plan(pre_assignment, "npc_elia")["visible"])
        assigned = apply_request(DATA, state(6, chapter=1, day=2, medicalCheckComplete=True), set())
        self.assertTrue(plan(assigned, "npc_elia")["visible"])
        self.assertTrue(plan(assigned, "npc_omar")["visible"])
        self.assertFalse(plan(assigned, "npc_omar")["cuffed"])
        self.assertEqual(plan(assigned, "npc_elia")["stage"], "cafe-balcony")

    def test_maryam_moves_only_after_late_and_confirmation(self):
        home = apply_request(DATA, state(josephLate=True), set())
        self.assertEqual(plan(home, "npc_maryam")["stage"], "maryam-home")
        moved = apply_request(DATA, state(josephLate=True, maryamConfirmedMissing=True), set())
        self.assertEqual(plan(moved, "npc_maryam")["stage"], "maryam-square")
        self.assertEqual(plan(moved, "npc_maryam")["locationGame"], [43.5, 0.0, 43.0])

    def test_invalid_order_and_early_medical_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "exact prefix"):
            apply_request(DATA, {"chapter": 1, "day": 1, "events": [BINDING_ORDER[1]]}, set())
        with self.assertRaisesRegex(ValueError, "before transport"):
            apply_request(DATA, state(4, medicalCheckComplete=True), set())


if __name__ == "__main__":
    unittest.main(verbosity=2)
