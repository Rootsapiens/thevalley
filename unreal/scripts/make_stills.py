"""Sequencer: /Game/OmegaValley/Cinematics/LS_Stills, one camera cut per still camera, HOLD frames each.

Movie Render Queue (render_mrq.py) renders it; the last frame of each cut is the still (Lumen and auto exposure have
HOLD frames to settle). Cut i covers frames [i*HOLD, (i+1)*HOLD). Writes Saved/ov_stills.json: label -> last frame.
"""
import json
import os

import unreal

import make_opening_dolly as D

SEQ_DIR, SEQ_NAME = "/Game/OmegaValley/Cinematics", "LS_Stills"
FPS, HOLD = 30, 45


def main(cams, name=SEQ_NAME, index="ov_stills.json"):
    eal = unreal.EditorAssetLibrary
    path = "%s/%s" % (SEQ_DIR, name)
    if eal.does_asset_exist(path):
        eal.delete_asset(path)
    seq = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, SEQ_DIR, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(FPS, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(HOLD * len(cams))
    try:
        cut = seq.add_track(unreal.MovieSceneCameraCutTrack)
    except Exception:
        cut = seq.add_master_track(unreal.MovieSceneCameraCutTrack)
    last = {}
    for i, cam in enumerate(cams):
        b = seq.add_possessable(cam)
        cs = cut.add_section()
        cs.set_range(i * HOLD, (i + 1) * HOLD)
        cs.set_camera_binding_id(D._binding_id(seq, b))
        last[cam.get_actor_label()] = (i + 1) * HOLD - 1
    eal.save_loaded_asset(seq)
    out = os.path.join(os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())), index)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"sequence": path, "fps": FPS, "hold": HOLD, "lastFrame": last}, fh, indent=1)
    unreal.log("[OV] %s: %d cuts x %d frames" % (path, len(cams), HOLD))
    return {"asset": path, "cuts": len(cams), "hold": HOLD}
