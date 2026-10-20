"""Apply a validated story snapshot to placed NPC actors in the loaded Unreal level.

Request JSON fields: chapter, day, events (approved ORDER prefix), prologue,
medicalCheckComplete, transportActive, josephLate, maryamConfirmedMissing.
Run through run_npc_story_state.ps1. Unresolved café/mountain positions require level actors named
OV_StoryAnchor_OmarCafe and OV_StoryAnchor_OmarMountain; missing anchors keep Omar hidden.
"""
import json
import os
import sys
import traceback

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ov_units as U  # noqa: E402
from npc_story_state import apply_request  # noqa: E402


def _actor_tags(actor):
    return [str(tag) for tag in actor.get_editor_property("tags")]


def _set_stage_tags(actor, plan, event_count):
    tags = [tag for tag in _actor_tags(actor)
            if not tag.startswith("storyStage:") and not tag.startswith("storyEvents:")
            and not tag.startswith("storyTalkable:") and not tag.startswith("storyCuffed:")]
    tags.extend(("storyStage:" + plan["stage"], "storyEvents:%d" % event_count,
                 "storyTalkable:" + ("true" if plan["talkable"] else "false"),
                 "storyCuffed:" + ("true" if plan["cuffed"] else "false")))
    actor.set_editor_property("tags", [unreal.Name(tag) for tag in tags])


def _set_hidden(actor, hidden):
    actor.set_actor_hidden_in_game(hidden)
    try:
        actor.set_is_temporarily_hidden_in_editor(hidden)
    except Exception as exc:
        unreal.log_warning("[OV NPC Story] editor-only hide state unavailable for %s: %s" %
                           (actor.get_actor_label(), exc))


def _move(actor, plan, actors_by_label):
    anchor_label = plan.get("anchorLabel")
    if anchor_label:
        anchor = actors_by_label.get(anchor_label)
        if anchor is None:
            return False
        actor.set_actor_location(anchor.get_actor_location(), False, False)
        actor.set_actor_rotation(anchor.get_actor_rotation(), False)
        return True
    game = plan.get("locationGame")
    if game is None:
        return True
    x, y, z = U.loc(*game)
    # Skeletal characters have a feet pivot; the existing basic-shape placeholder is centred.
    is_skeletal = isinstance(actor, unreal.SkeletalMeshActor)
    target_z = z if is_skeletal else z + 90.0
    actor.set_actor_location(unreal.Vector(x, y, target_z), False, False)
    return True


def main():
    project = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
    repo = os.environ.get("OV_REPO") or os.path.normpath(os.path.join(project, "..", "..", ".."))
    data_path = os.environ.get("OV_NPC_DATA") or os.path.join(repo, "unreal", "data", "village-npcs.json")
    request_path = os.environ.get("OV_NPC_STORY_REQUEST")
    if not request_path or not os.path.isfile(request_path):
        raise ValueError("Set OV_NPC_STORY_REQUEST to a JSON snapshot file")
    with open(data_path, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(request_path, encoding="utf-8") as fh:
        request = json.load(fh)

    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = eas.get_all_level_actors()
    by_id = {}
    anchors = {}
    for actor in actors:
        label = actor.get_actor_label()
        if label.startswith("OV_StoryAnchor_"):
            anchors[label] = actor
        tags = _actor_tags(actor)
        npc_id = next((tag[4:] for tag in tags if tag.startswith("npc:") and tag in
                       ["npc:" + value for value in data["checks"].get("npcIds", [])]), None)
        # The stable id is authoritative even when the optional data check list is absent.
        if npc_id is None:
            npc_id = next((tag[4:] for tag in tags if tag.startswith("npc:npc_")), None)
        if npc_id:
            if npc_id in by_id:
                raise ValueError("Duplicate placed actors for " + npc_id)
            by_id[npc_id] = actor

    result = apply_request(data, request, set(anchors))
    plan_ids = {plan["id"] for plan in result["plans"]}
    if set(by_id) != plan_ids:
        missing = sorted(plan_ids - set(by_id))
        extra = sorted(set(by_id) - plan_ids)
        raise ValueError("Placed NPC actor IDs mismatch; missing=%s extra=%s; run run_npcs.ps1 first" %
                         (missing, extra))

    applied = []
    for plan in result["plans"]:
        actor = by_id[plan["id"]]
        if plan["visible"] and not _move(actor, plan, anchors):
            raise RuntimeError("Failed to resolve location for " + plan["id"])
        _set_hidden(actor, not plan["visible"])
        _set_stage_tags(actor, plan, result["eventCount"])
        applied.append({"id": plan["id"], "visible": plan["visible"], "stage": plan["stage"],
                        "cuffed": plan["cuffed"], "talkable": plan["talkable"],
                        "anchor": plan["anchorLabel"], "reason": plan["reason"]})

    # Keep the Farmer's separate lantern in sync with his event visibility.
    farmer_visible = next(p["visible"] for p in result["plans"] if p["id"] == "npc_farmer")
    for actor in actors:
        if "npc_prop:farmer_lantern" in _actor_tags(actor):
            _set_hidden(actor, not farmer_visible)

    saved = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())
    os.makedirs(saved, exist_ok=True)
    output = os.path.join(saved, "ov_npc_story_state_result.json")
    payload = {"ok": True, "map": unreal.EditorLevelLibrary.get_editor_world().get_path_name(),
               "request": request, "visible": result["visible"], "cuffed": result["cuffed"],
               "warnings": result["warnings"], "applied": applied}
    if not unreal.EditorLoadingAndSavingUtils.save_current_level():
        raise RuntimeError("Unreal did not save the current level")
    with open(output, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1)
    unreal.log("[OV NPC Story] applied %d NPC states; visible=%s; warnings=%d" %
               (len(applied), ",".join(result["visible"]), len(result["warnings"])))
    return payload


try:
    main()
except Exception as exc:
    project = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
    saved = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())
    os.makedirs(saved, exist_ok=True)
    with open(os.path.join(saved, "ov_npc_story_state_result.json"), "w", encoding="utf-8") as fh:
        json.dump({"ok": False, "error": str(exc), "traceback": traceback.format_exc()}, fh, indent=1)
    unreal.log_error("[OV NPC Story] " + str(exc))
    raise

