"""Movie Render Queue from the command line (full editor, PIE executor). Run by render_mrq.ps1 / run_trial.ps1:

  UnrealEditor.exe <uproject> /Game/OmegaValley/Maps/BarnSlice -ExecutePythonScript="<scripts>\\render_mrq.py" -unattended

Jobs (env OV_MRQ_JOBS, comma list, default "stills,dolly"):
  stills  LS_Stills (one cut per still camera, 45 frames each) -> PNG, Saved/MovieRenders/stills
  dolly   LS_OpeningDolly (8 s @ 30 fps)                      -> JPG, Saved/MovieRenders/dolly
MRQ waits for shader compilation and asset streaming before each frame, so this doubles as the shader warm-up.
The level's auto-play LevelSequenceActor is switched off in memory first (never saved). Writes Saved/ov_mrq_result.json
and quits the editor when the queue is done.
"""
import json
import os
import time
import traceback

import unreal

SAVED = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()))
OUT = os.path.join(SAVED, "MovieRenders")
RESULT = os.path.join(SAVED, "ov_mrq_result.json")
MAP = "/Game/OmegaValley/Maps/BarnSlice"
RES = tuple(int(v) for v in os.environ.get("OV_MRQ_RES", "1920x1080").split("x"))
JOBS = {   # name: (sequence, format, warm-up frames, map)
    "stills": ("/Game/OmegaValley/Cinematics/LS_Stills", "png", 64, MAP),
    "dolly": ("/Game/OmegaValley/Cinematics/LS_OpeningDolly", "jpg", 48, MAP),
    "village": ("/Game/OmegaValley/Cinematics/LS_VillageStills", "png", 64, "/Game/OmegaValley/Maps/Village"),
}
STATE = {"t0": time.time(), "executor": None}


def soft(path):
    return unreal.SoftObjectPath("%s.%s" % (path, path.split("/")[-1]))


def setp(obj, name, value):
    try:
        obj.set_editor_property(name, value)
    except Exception as e:
        unreal.log_warning("[OV] MRQ %s.%s: %s" % (type(obj).__name__, name, e))


def add_job(queue, name, seq, fmt, warm, level):
    j = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    setp(j, "job_name", name)
    setp(j, "sequence", soft(seq))
    setp(j, "map", soft(level))
    c = j.get_configuration()
    out = c.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))
    setp(out, "output_directory", unreal.DirectoryPath(d.replace("\\", "/")))
    setp(out, "file_name_format", "{sequence_name}.{frame_number}")
    setp(out, "output_resolution", unreal.IntPoint(RES[0], RES[1]))
    setp(out, "zero_pad_frame_numbers", 4)
    setp(out, "override_existing_output", True)
    c.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    c.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG if fmt == "png" else unreal.MoviePipelineImageSequenceOutput_JPG)
    aa = c.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    for k, v in (("engine_warm_up_count", warm), ("render_warm_up_count", warm), ("use_camera_cut_for_warm_up", False),
                 ("override_anti_aliasing", True), ("anti_aliasing_method", unreal.AntiAliasingMethod.AAM_TSR),
                 ("spatial_sample_count", 1), ("temporal_sample_count", 1)):
        setp(aa, k, v)
    try:   # game look (Epic), not the cinematic scalability override, so stills match what the player sees
        go = c.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
        setp(go, "cinematic_quality_settings", False)
    except Exception as e:
        unreal.log_warning("[OV] MRQ game override: %s" % e)
    return j


def write(result):
    with open(RESULT, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=1)


def on_finished(executor, success):
    unreal.log("[OV] MRQ executor finished, success=%s" % success)
    res = {"ok": bool(success), "seconds": round(time.time() - STATE["t0"], 1), "jobs": {}}
    for name in STATE["names"]:
        d = os.path.join(OUT, name)
        res["jobs"][name] = {"dir": d, "frames": len(os.listdir(d)) if os.path.isdir(d) else 0}
    write(res)
    unreal.log("[OV] MRQ finished: %s" % json.dumps(res))
    keep_alive(False)
    unreal.SystemLibrary.quit_editor()


def keep_alive(on):
    """-ExecutePythonScript quits the editor once the script returns unless this flag is set (EditorPythonExecuter.cpp)."""
    try:
        unreal.EditorPythonScripting.set_keep_python_script_alive(on)
    except Exception as e:
        unreal.log_warning("[OV] keep_python_script_alive: %s" % e)


def main():
    keep_alive(True)
    if os.path.exists(RESULT):
        os.remove(RESULT)
    try:
        names = [n.strip() for n in os.environ.get("OV_MRQ_JOBS", "stills,dolly").split(",") if n.strip() in JOBS]
        les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        les.load_level(JOBS[names[0]][3] if names else MAP)    # jobs on one map per run
        eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        for a in eas.get_all_level_actors():
            if isinstance(a, unreal.LevelSequenceActor):
                ps = a.get_editor_property("playback_settings")
                setp(ps, "auto_play", False)
                a.set_editor_property("playback_settings", ps)
                try:
                    a.set_editor_property("auto_play", False)
                except Exception:
                    pass
        t = time.time()
        for c in ("Editor.AsyncTextureCompilationFinishAll", "Editor.AsyncStaticMeshCompilationFinishAll"):
            unreal.SystemLibrary.execute_console_command(None, c)
        unreal.log("[OV] asset compilation finished in %.1f s" % (time.time() - t))
        STATE["names"] = names
        mqs = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
        q = mqs.get_queue()
        for j in list(q.get_jobs()):
            q.delete_job(j)
        for n in names:
            add_job(q, n, *JOBS[n])
        ex = mqs.render_queue_with_executor(unreal.MoviePipelinePIEExecutor)
        ex.on_executor_finished_delegate.add_callable_unique(on_finished)
        STATE["executor"] = ex           # keep a reference: the delegate must outlive this script
        unreal.log("[OV] MRQ started: %s at %dx%d" % (", ".join(names), RES[0], RES[1]))
    except Exception as e:
        write({"ok": False, "error": "%s\n%s" % (e, traceback.format_exc())})
        unreal.log_error("[OV] MRQ setup failed: %s" % e)
        keep_alive(False)
        unreal.SystemLibrary.quit_editor()


main()
