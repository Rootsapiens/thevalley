"""Build an inspectable, non-auto-playing prologue search sequence in BarnSlice.

The ordinary BarnSlice remains the post-prologue state: npc_farmer stands talkable at the trough.
Open LS_FarmerPrologueSearch in Sequencer to inspect the earlier search beat. It moves the same
stable-ID Farmer along a short pasture route, pauses with the imported Idle take, then turns NE.
"""
import json
import os
import sys
import traceback

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass

MAP = "/Game/OmegaValley/Maps/BarnSlice"
SEQ_PATH = "/Game/OmegaValley/Cinematics/LS_FarmerPrologueSearch"
FARMER_ID = "npc_farmer"
FARMER_TAG = "npc:npc_farmer"
ANIM_DIR = "/Game/OmegaValley/Characters/Farmer/Animations"
FPS = 30
WALK_END = 75       # 2.5 s
PAUSE_END = 135     # 4.5 s
END = 210           # 7 s
RESULT = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()),
                      "ov_farmer_prologue_result.json")


def _binding_id(seq, binding):
    for make_id in (
        lambda: seq.get_portable_binding_id(seq, binding),
        lambda: seq.make_binding_id(binding, unreal.MovieSceneObjectBindingSpace.LOCAL),
        lambda: seq.get_binding_id(binding),
    ):
        try:
            return make_id()
        except Exception:
            pass
    raise RuntimeError("Could not create a local Sequencer binding id")


def _transform_section(track, values, frames):
    section = track.add_section()
    section.set_range(0, frames)
    channels = list(section.get_all_channels())
    for channel_index, pairs in enumerate(values):
        channel = channels[channel_index]
        for frame, value in pairs:
            channel.add_key(unreal.FrameNumber(frame), value)
    return section


def _key_tracks(binding, actor, start, end, start_yaw, end_yaw):
    track = binding.add_track(unreal.MovieScene3DTransformTrack)
    # Three metres of slow searching between the trough and the pasture edge, then a held pause.
    values = [
        [(0, start.x), (WALK_END, end.x), (END, end.x)],
        [(0, start.y), (WALK_END, end.y), (END, end.y)],
        [(0, start.z), (WALK_END, end.z), (END, end.z)],
        [(0, 0.0), (END, 0.0)],
        [(0, 0.0), (END, 0.0)],
        [(0, start_yaw), (WALK_END, start_yaw), (PAUSE_END, end_yaw), (END, end_yaw)],
        [(0, 1.0), (END, 1.0)], [(0, 1.0), (END, 1.0)], [(0, 1.0), (END, 1.0)],
    ]
    _transform_section(track, values, END)
    return track


def _anim_section(track, anim, start, end):
    section = track.add_section()
    section.set_range(start, end)
    params = section.get_editor_property("params")
    params.set_editor_property("animation", anim)
    section.set_editor_property("params", params)
    return section


def main():
    eal = unreal.EditorAssetLibrary
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not eal.does_asset_exist(MAP):
        raise RuntimeError("BarnSlice missing; run run_npcs.ps1 first")
    import build_barn_level as B
    B.open_or_create_level(MAP)

    farmer = next((a for a in eas.get_all_level_actors() if a.actor_has_tag(FARMER_TAG)), None)
    if farmer is None:
        raise RuntimeError("npc_farmer not in BarnSlice; run run_npcs.ps1 first")
    if not farmer.get_actor_label() == FARMER_ID:
        raise RuntimeError("Farmer actor label must remain the stable id npc_farmer")
    lantern = next((a for a in eas.get_all_level_actors() if a.actor_has_tag("npc_prop:farmer_lantern")), None)
    if lantern is None:
        raise RuntimeError("Farmer lantern prop missing")

    walk_path = ANIM_DIR + "/Worker_Male_Anim_CharacterArmature_Walk"
    idle_path = ANIM_DIR + "/Worker_Male_Anim_CharacterArmature_Idle"
    walk = eal.load_asset(walk_path)
    idle = eal.load_asset(idle_path)
    if not walk or not idle:
        raise RuntimeError("Worker_Male Idle/Walk clips missing; run run_player_characters.ps1 first")

    old_cam = next((a for a in eas.get_all_level_actors() if a.get_actor_label() == "OV_FarmerPrologueCam"), None)
    if old_cam:
        eas.destroy_actor(old_cam)
    cam = eas.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(-2050, 250, 280))
    cam.set_actor_label("OV_FarmerPrologueCam")
    cam.set_folder_path("OV/Cinematics/FarmerPrologue")
    target = unreal.Vector(-1400, 700, 100)
    cam.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(cam.get_actor_location(), target), False)
    cam.camera_component.set_editor_property("field_of_view", 46.0)
    cam.set_editor_property("tags", [unreal.Name("OV_FARMER_PROLOGUE_SEQUENCE")])

    if eal.does_asset_exist(SEQ_PATH):
        eal.delete_asset(SEQ_PATH)
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "LS_FarmerPrologueSearch", "/Game/OmegaValley/Cinematics", unreal.LevelSequence,
        unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(END)

    # On screen: begin at the trough, walk a few metres toward the pasture, pause, then look NE.
    transform_binding = sequence.add_possessable(farmer)
    start = farmer.get_actor_location()
    end = unreal.Vector(start.x - 140.0, start.y - 250.0, start.z)
    start_yaw = farmer.get_actor_rotation().yaw
    _key_tracks(transform_binding, farmer, start, end, start_yaw, -45.0)

    anim_binding = sequence.add_possessable(farmer.skeletal_mesh_component)
    anim_track = anim_binding.add_track(unreal.MovieSceneSkeletalAnimationTrack)
    _anim_section(anim_track, walk, 0, WALK_END)
    _anim_section(anim_track, idle, WALK_END, END)

    camera_binding = sequence.add_possessable(cam)
    try:
        cut_track = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    except Exception:
        cut_track = sequence.add_master_track(unreal.MovieSceneCameraCutTrack)
    cut = cut_track.add_section()
    cut.set_range(0, END)
    cut.set_camera_binding_id(_binding_id(sequence, camera_binding))

    # Keep this sequence inspectable but never autoplay it: BarnSlice remains the post-prologue state.
    for actor in eas.get_all_level_actors():
        if actor.get_actor_label() == "LS_FarmerPrologueSearch_Player":
            eas.destroy_actor(actor)
    seq_actor = eas.spawn_actor_from_class(unreal.LevelSequenceActor, unreal.Vector(0, 0, 0))
    seq_actor.set_actor_label("LS_FarmerPrologueSearch_Player")
    seq_actor.set_folder_path("OV/Cinematics/FarmerPrologue")
    seq_actor.set_editor_property("tags", [unreal.Name("OV_FARMER_PROLOGUE_SEQUENCE")])
    try:
        seq_actor.set_sequence(sequence)
    except Exception:
        seq_actor.set_editor_property("level_sequence_asset", sequence)
    settings = seq_actor.get_editor_property("playback_settings")
    settings.set_editor_property("auto_play", False)
    seq_actor.set_editor_property("playback_settings", settings)

    eal.save_loaded_asset(sequence)
    B.save_all()
    result = {"ok": True, "map": MAP, "sequence": SEQ_PATH, "farmerId": FARMER_ID,
              "walk": walk_path, "idle": idle_path, "lantern": lantern.get_actor_label(),
              "durationSeconds": END / FPS, "autoPlay": False}
    with open(RESULT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1)
    unreal.log("[OV FARMER] prologue sequence ready: %s (%.1f s, walk/pause/NE look; not auto-played)" %
               (SEQ_PATH, END / FPS))
    return result


try:
    main()
except Exception as exc:
    with open(RESULT, "w", encoding="utf-8") as f:
        json.dump({"ok": False, "error": str(exc) + "\n" + traceback.format_exc()}, f, indent=1)
    unreal.log_error("[OV FARMER] " + str(exc))
    raise
