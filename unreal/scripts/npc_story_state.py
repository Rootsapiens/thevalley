"""Pure, validated story-state mapping for the Unreal NPC staging tool.

This module intentionally imports no Unreal API. Story event strings and stage rules mirror the
approved ordering in studio/npc/README.md and src/npcData.ts. Unknown scene locations are supplied
by named level anchors; the tool hides an NPC instead of inventing a position when an anchor is absent.
"""
from __future__ import annotations

BINDING_ORDER = (
    "Cafe and raven activity",
    "Root attack and gang turns",
    "Omar escapes, loses memory",
    "Found near the mountain (Day 1)",
    "Taken to post [6] in handcuffs",
    "Moreno assigns Elia the cover mission",
    "Elia appears on the cafe balcony (Day 2)",
)

EXPECTED_IDS = (
    "npc_maryam", "npc_omar", "npc_elia", "npc_moreno", "npc_officer_1", "npc_officer_2",
    "npc_priest", "npc_farmer", "npc_farmers_wife",
    "npc_square_villager_1", "npc_square_villager_2", "npc_square_villager_3",
    "npc_square_villager_4", "npc_square_villager_5", "npc_square_villager_6",
)

CHAPTER_DAY_IDS = {
    (1, 1): EXPECTED_IDS,
    (1, 2): ("npc_maryam", "npc_omar", "npc_elia", "npc_moreno"),
    (3, 3): ("npc_priest",),
    (4, 8): ("npc_maryam",),
}

# Approved location from studio/npc/omar.md; converted by ov_units.py at application time.
OMAR_TRANSPORT_GAME = (-7.2, 0.0, 44.2)
OMAR_TRANSPORT_YAW = 0.12

# Stable level anchor labels for positions intentionally left unspecified in approved materials.
ANCHORS = {
    "omar_cafe": "OV_StoryAnchor_OmarCafe",
    "omar_mountain": "OV_StoryAnchor_OmarMountain",
}


def _valid_prefix(events: list[str], order: tuple[str, ...]) -> bool:
    return len(events) <= len(order) and all(event == order[i] for i, event in enumerate(events))


def validate_request(data: dict, request: dict) -> tuple[list[dict], list[str]]:
    """Return one actor plan per exported NPC plus warnings, or raise ValueError on bad story state."""
    if tuple(data.get("order", ())) != BINDING_ORDER:
        raise ValueError("NPC export event order does not match the approved binding order")
    npcs = data.get("npcs")
    if not isinstance(npcs, list):
        raise ValueError("NPC export has no npc list")
    ids = [npc.get("id") for npc in npcs]
    if len(ids) != len(EXPECTED_IDS) or set(ids) != set(EXPECTED_IDS) or len(set(ids)) != len(ids):
        raise ValueError("NPC export must contain each of the 15 stable NPC IDs exactly once")

    chapter = request.get("chapter", 1)
    day = request.get("day", 1)
    events = request.get("events", [])
    prologue = request.get("prologue", False)
    medical = request.get("medicalCheckComplete", False)
    transport = request.get("transportActive", False)
    joseph_late = request.get("josephLate", False)
    maryam_confirmed = request.get("maryamConfirmedMissing", False)
    if not isinstance(chapter, int) or chapter < 1 or not isinstance(day, int) or day < 1:
        raise ValueError("chapter and day must be positive integers")
    if not isinstance(events, list) or not all(isinstance(event, str) for event in events):
        raise ValueError("events must be an array of approved event strings")
    if not _valid_prefix(events, BINDING_ORDER):
        raise ValueError("events must be an exact prefix of the approved Omar/Elia order")
    for key, value in (("prologue", prologue), ("medicalCheckComplete", medical),
                       ("transportActive", transport), ("josephLate", joseph_late),
                       ("maryamConfirmedMissing", maryam_confirmed)):
        if not isinstance(value, bool):
            raise ValueError(key + " must be true or false")
    if prologue and (chapter != 1 or day != 1 or events):
        raise ValueError("prologue staging is Chapter 1 Day 1 before the ordered Omar events")
    if medical and len(events) < 5:
        raise ValueError("Omar cannot complete the guarded medical check before transport to post [6]")
    if transport and (chapter != 1 or day != 1 or len(events) != 4):
        raise ValueError("transport staging requires Day 1 after Omar is found and before arrival at post [6]")
    if maryam_confirmed and not joseph_late:
        raise ValueError("Maryam's confirmation cannot precede Joseph being late")
    if len(events) == 7 and day < 2:
        raise ValueError("Elia's balcony appearance is a Day 2 event")
    if day >= 2 and len(events) >= 6 and not medical:
        raise ValueError("Elia's Day 2 cover requires Omar's guarded medical check to be complete")

    by_id = {npc["id"]: npc for npc in npcs}
    allowed = set(CHAPTER_DAY_IDS.get((chapter, day), ()))
    warnings: list[str] = []
    plans: list[dict] = []
    for npc_id in EXPECTED_IDS:
        npc = by_id[npc_id]
        visible = npc_id in allowed and day >= npc.get("spawnDay", 1)
        stage = "chapter-day"
        cuffed = bool(npc.get("cuffed", False))
        talkable = True
        location = None
        anchor = None
        reason = None

        if prologue:
            visible = npc_id == "npc_farmer"
            stage = "prologue-search" if visible else "offstage-prologue"
            talkable = False
        elif npc_id == "npc_farmer" and visible:
            stage = "post-prologue"
        elif npc_id == "npc_maryam" and visible:
            if chapter == 1 and joseph_late and maryam_confirmed:
                stage = "maryam-square"
                location = (43.5, 0.0, 43.0)  # approved endpoint in studio/npc/maryam.md
            else:
                stage = "maryam-home"
        elif npc_id == "npc_omar":
            completed = len(events)
            # The base actor record's cuffed bit describes the eventual police-post pose only.
            # Omar is not cuffed at the café, at discovery, or before active transport begins.
            cuffed = False
            if chapter == 1 and day == 1:
                if completed <= 1:
                    stage = "cafe-before-attack"
                    anchor = ANCHORS["omar_cafe"]
                elif completed == 2:
                    stage = "root-attack"
                    visible = False
                    reason = "no authored Omar transform pose for the root-attack interval"
                elif completed == 3:
                    stage = "escaped-memory-loss"
                    visible = False
                    reason = "Omar is between escape and the scripted mountain discovery"
                elif completed == 4:
                    if transport:
                        stage = "police-transport"
                        location = OMAR_TRANSPORT_GAME
                        cuffed = True
                    else:
                        stage = "mountain-found"
                        anchor = ANCHORS["omar_mountain"]
                else:
                    stage = "police-post"
                    cuffed = not medical
            elif chapter == 1 and day >= 2 and completed >= 5:
                stage = "police-post"
                cuffed = not medical
            else:
                visible = False
                stage = "not-yet-transported"
                reason = "Omar stays off the police stage until the approved transport event"
            if visible and anchor:
                # The position is intentionally unresolved until scene geometry supplies the anchor.
                pass
            if not visible:
                cuffed = False
        elif npc_id == "npc_elia":
            assigned = len(events) >= 6
            appeared = chapter == 1 and day >= 2 and assigned
            visible = visible and appeared
            stage = "cafe-balcony" if visible else "cover-not-on-stage"
            if visible and not npc.get("floorKnown", False):
                visible = False
                reason = "Elia's balcony floor is not confirmed in the current NPC export"
        elif npc_id == "npc_moreno" and visible and len(events) < 5:
            stage = "police-post-before-omar"
        elif npc_id.startswith("npc_square_villager_") and not visible:
            stage = "offstage-day"

        if anchor and visible:
            # Editor integration resolves this label; absent anchors keep the NPC hidden safely.
            pass
        can_talk = bool(visible and npc_id != "npc_omar")
        if npc_id == "npc_omar":
            can_talk = bool(visible and len(events) >= 5)
        plans.append({
            "id": npc_id,
            "visible": bool(visible),
            "stage": stage,
            "cuffed": bool(cuffed),
            "talkable": bool(talkable and can_talk),
            "locationGame": list(location) if location else None,
            "anchorLabel": anchor if visible else None,
            "reason": reason,
        })

    return plans, warnings


def resolve_anchor_visibility(plans: list[dict], anchor_labels: set[str]) -> tuple[list[dict], list[str]]:
    """Hide characters whose canonically unspecified location lacks a level-provided anchor."""
    result = []
    warnings = []
    for original in plans:
        plan = dict(original)
        anchor = plan.get("anchorLabel")
        if plan["visible"] and anchor and anchor not in anchor_labels:
            plan["visible"] = False
            plan["talkable"] = False
            plan["reason"] = "missing scene anchor: " + anchor
            warnings.append(plan["id"] + " hidden: add level actor " + anchor)
        result.append(plan)
    return result, warnings


def apply_request(data: dict, request: dict, anchor_labels: set[str]) -> dict:
    """Validated state plan after resolving scene-owned anchors. Pure and safe for offline checks."""
    plans, warnings = validate_request(data, request)
    plans, missing = resolve_anchor_visibility(plans, anchor_labels)
    warnings.extend(missing)
    visible = [plan["id"] for plan in plans if plan["visible"]]
    by_id = {plan["id"]: plan for plan in plans}
    if "npc_elia" in visible:
        assert len(request.get("events", [])) >= 6 and request.get("day", 1) >= 2
    if by_id["npc_omar"]["cuffed"] and by_id["npc_omar"]["visible"]:
        assert (len(request.get("events", [])) >= 5 or
                by_id["npc_omar"]["stage"] == "police-transport")
    return {"plans": plans, "warnings": warnings, "visible": visible,
            "cuffed": by_id["npc_omar"]["cuffed"],
            "eventCount": len(request.get("events", []))}

