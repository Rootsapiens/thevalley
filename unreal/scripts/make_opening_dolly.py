"""Sequencer stub: /Game/OmegaValley/Cinematics/LS_OpeningDolly, the Chapter 1 opening dolly (8 s at 30 fps).

The camera starts at Lorenzo's eye on the spawn point, framed like the web build's opening shot (barn on the left,
sunlit mountain over the pasture on the right), and dollies 3 m toward the barn's north corner while panning 6 deg
right toward the cave mouth (bearing 45). Called by build_barn_level.py with the OV_OpeningCam actor; can also run
alone in an open BarnSlice level (Tools > Execute Python Script).
Render it with Movie Render Queue (Window > Cinematics > Movie Render Queue) for the trial's cinematic deliverable.
"""
import os
import sys

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass
import ov_units as U  # noqa: E402

SEQ_DIR = "/Game/OmegaValley/Cinematics"
SEQ_NAME = "LS_OpeningDolly"
FPS, SECONDS = 30, 8
DOLLY_M, PAN_DEG, RISE_M = 3.0, 6.0, 0.15


def _binding_id(seq, binding):
    for f in (lambda: seq.get_portable_binding_id(seq, binding),          # 5.1+
              lambda: seq.make_binding_id(binding, unreal.MovieSceneObjectBindingSpace.LOCAL),
              lambda: seq.get_binding_id(binding)):                        # 5.0
        try:
            return f()
        except Exception:
            continue
    raise RuntimeError("no binding-id API found in this engine version")


def _channels(section):
    try:
        return list(section.get_all_channels())
    except Exception:
        return list(section.get_channels_by_type(unreal.MovieSceneScriptingDoubleChannel))


def main(cam=None):
    eal = unreal.EditorAssetLibrary
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if cam is None:
        cam = next((a for a in eas.get_all_level_actors() if a.get_actor_label() == "OV_OpeningCam"), None)
        if cam is None:
            raise RuntimeError("OV_OpeningCam not in the level: run build_barn_level.py first")
    path = "%s/%s" % (SEQ_DIR, SEQ_NAME)
    if eal.does_asset_exist(path):
        eal.delete_asset(path)          # a stub: regenerated from code every build
    seq = unreal.AssetToolsHelpers.get_asset_tools().create_asset(SEQ_NAME, SEQ_DIR, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    frames = FPS * SECONDS
    seq.set_display_rate(unreal.FrameRate(FPS, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(frames)

    binding = seq.add_possessable(cam)
    track = binding.add_track(unreal.MovieScene3DTransformTrack)
    sec = track.add_section()
    sec.set_range(0, frames)

    l0, r0 = cam.get_actor_location(), cam.get_actor_rotation()
    f = U.forward(0.0, r0.yaw)
    l1 = (l0.x + f[0] * DOLLY_M * 100, l0.y + f[1] * DOLLY_M * 100, l0.z + RISE_M * 100)
    start = (l0.x, l0.y, l0.z, r0.roll, r0.pitch, r0.yaw, 1.0, 1.0, 1.0)
    end = (l1[0], l1[1], l1[2], r0.roll, r0.pitch + 1.0, r0.yaw + PAN_DEG, 1.0, 1.0, 1.0)
    chans = _channels(sec)           # location X Y Z, rotation roll pitch yaw, scale X Y Z
    for ch, a, b in zip(chans[:9], start, end):
        ch.add_key(unreal.FrameNumber(0), a)
        k = ch.add_key(unreal.FrameNumber(frames), b)
        try:   # ease out at the end: cubic (auto) tangents
            k.set_interpolation_mode(unreal.RichCurveInterpMode.RCIM_CUBIC)
        except Exception:
            pass

    try:
        cut = seq.add_track(unreal.MovieSceneCameraCutTrack)        # 5.2+
    except Exception:
        cut = seq.add_master_track(unreal.MovieSceneCameraCutTrack)
    cs = cut.add_section()
    cs.set_range(0, frames)
    cs.set_camera_binding_id(_binding_id(seq, binding))

    # A LevelSequenceActor in the level so the cinematic is one click away (no auto-play: the perf run must stay still).
    for a in eas.get_all_level_actors():
        if a.get_actor_label() == "LS_OpeningDolly_Player":
            eas.destroy_actor(a)
    lsa = eas.spawn_actor_from_class(unreal.LevelSequenceActor, unreal.Vector(0, 0, 0))
    lsa.set_actor_label("LS_OpeningDolly_Player")
    lsa.set_folder_path("OV/Cinematics")
    lsa.set_editor_property("tags", [unreal.Name("OV_AUTO")])
    try:
        lsa.set_sequence(seq)
    except Exception:
        lsa.set_editor_property("level_sequence_asset", seq)
    eal.save_loaded_asset(seq)
    unreal.log("[OV] %s: %d frames @ %d fps, dolly %.1f m, pan %.0f deg" % (path, frames, FPS, DOLLY_M, PAN_DEG))
    return {"asset": path, "frames": frames, "fps": FPS}


if __name__ != "make_opening_dolly":
    main()
