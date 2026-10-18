"""Imports Aktham's exports into the UE project, reproducibly (re-run replaces the assets in place).

  public/art/*.jpg|png    -> /Game/OmegaValley/Art/Textures   (*_normal: normal map, *_rough: linear mask)
  public/models/*.glb     -> /Game/OmegaValley/Art/Models     (Interchange glTF; static meshes get Nanite on)

Run: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<repo>\\unreal\\scripts\\import_art.py" -unattended -nosplash
Licences: only files already logged in CREDITS.md are imported. Anything else is skipped and listed in the log.
"""
import glob
import os

import unreal

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
REPO = os.path.normpath(os.path.join(PROJECT_DIR, "..", ".."))
TEX_DIR, MODEL_DIR = "/Game/OmegaValley/Art/Textures", "/Game/OmegaValley/Art/Models"


def credited():
    out = set()
    with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as fh:
        for line in fh:
            p = line.split("|")[0].strip()
            if p.startswith("public/"):
                out.add(p.replace("\\", "/"))
    return out


def task(path, dest):
    t = unreal.AssetImportTask()
    t.set_editor_property("filename", path)
    t.set_editor_property("destination_path", dest)
    t.set_editor_property("automated", True)
    t.set_editor_property("replace_existing", True)
    t.set_editor_property("save", True)
    return t


def main():
    ok = credited()
    files = sorted(glob.glob(os.path.join(REPO, "public", "art", "*.jpg")) + glob.glob(os.path.join(REPO, "public", "art", "*.png")))
    models = sorted(glob.glob(os.path.join(REPO, "public", "models", "*.glb")))
    tasks, skipped = [], []
    for f in files + models:
        rel = os.path.relpath(f, REPO).replace("\\", "/")
        if rel not in ok:
            skipped.append(rel)
            continue
        tasks.append(task(f, MODEL_DIR if f.endswith(".glb") else TEX_DIR))
    if skipped:
        unreal.log_warning("[OV] not in CREDITS.md, skipped: " + ", ".join(skipped))
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    sme = None
    try:
        sme = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    except Exception:
        pass
    n_tex = n_mesh = 0
    for t in tasks:
        for p in t.get_editor_property("imported_object_paths") or []:
            a = unreal.EditorAssetLibrary.load_asset(p)
            if isinstance(a, unreal.Texture2D):
                name = a.get_name().lower()
                if name.endswith("_normal"):
                    a.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
                    a.set_editor_property("srgb", False)
                elif name.endswith("_rough"):
                    a.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
                    a.set_editor_property("srgb", False)
                n_tex += 1
            elif isinstance(a, unreal.StaticMesh):
                ns = a.get_editor_property("nanite_settings")
                ns.set_editor_property("enabled", True)
                if sme:
                    sme.set_nanite_settings(a, ns, True)
                else:
                    a.set_editor_property("nanite_settings", ns)
                n_mesh += 1
            unreal.EditorAssetLibrary.save_loaded_asset(a)
    unreal.log("[OV] imported %d textures, %d static meshes (Nanite on), %d skipped" % (n_tex, n_mesh, len(skipped)))


if __name__ != "import_art":
    main()
