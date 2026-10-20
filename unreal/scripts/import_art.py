"""Imports Aktham's exports into the UE project, reproducibly (re-run replaces the assets in place).

  public/art/*.jpg|png    -> /Game/OmegaValley/Art/Textures   (*_normal: normal map; valley-sky: no mips, skybox group)
  public/models/*.glb     -> /Game/OmegaValley/Art/Models     (Interchange glTF; static meshes get Nanite on)

Run alone: UnrealEditor-Cmd.exe <uproject> -run=pythonscript -script="<scripts>\\import_art.py" -unattended -nosplash
build_barn_level.py calls main() itself when textures are missing (OV_REIMPORT=1 forces a re-import).
Licences: only files already logged in CREDITS.md are imported. Anything else is skipped and listed in the log.
Normal maps are green-down (DirectX) like UE expects (src/villageTextures.ts NORMAL_Y = -1): no flip.
"""
import glob
import os
import re
import sys

import unreal

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
except NameError:
    pass
import ov_paths  # noqa: E402

PROJECT_DIR = os.path.abspath(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
REPO = ov_paths.repo_dir(PROJECT_DIR)
TEX_DIR, MODEL_DIR = "/Game/OmegaValley/Art/Textures", "/Game/OmegaValley/Art/Models"
EAL = unreal.EditorAssetLibrary


def key(name):
    """'dirt-road_normal' and 'dirt_road_normal' (sanitised asset name) map to the same key."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def credited():
    out = set()
    with open(os.path.join(REPO, "CREDITS.md"), encoding="utf-8") as fh:
        for line in fh:
            p = line.split("|")[0].strip()
            if p.startswith("public/"):
                out.add(p.replace("\\", "/"))
    return out


def existing_textures():
    """key -> asset path for every Texture2D already in TEX_DIR."""
    out = {}
    if not EAL.does_directory_exist(TEX_DIR):
        return out
    for p in EAL.list_assets(TEX_DIR, recursive=False):
        out[key(p.split("/")[-1].split(".")[0])] = p.split(".")[0]
    return out


def task(path, dest):
    t = unreal.AssetImportTask()
    t.set_editor_property("filename", path)
    t.set_editor_property("destination_path", dest)
    t.set_editor_property("automated", True)
    t.set_editor_property("replace_existing", True)
    t.set_editor_property("save", True)
    return t


def fix_texture(a):
    name = key(a.get_name())
    if name.endswith("normal"):
        a.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
        a.set_editor_property("srgb", False)
    elif name.endswith("rough"):
        a.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
        a.set_editor_property("srgb", False)
    elif name == "valleysky":       # equirect backdrop: one mip, so the u-wrap seam cannot pick a tiny mip
        a.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
        a.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_SKYBOX)
        a.set_editor_property("never_stream", True)
        a.set_editor_property("address_x", unreal.TextureAddress.TA_WRAP)
        a.set_editor_property("address_y", unreal.TextureAddress.TA_CLAMP)


def main(force=None):
    force = (os.environ.get("OV_REIMPORT") == "1") if force is None else force
    ok = credited()
    have = existing_textures()
    files = sorted(glob.glob(os.path.join(REPO, "public", "art", "*.jpg")) + glob.glob(os.path.join(REPO, "public", "art", "*.png")))
    models = sorted(glob.glob(os.path.join(REPO, "public", "models", "*.glb")))
    tasks, skipped = [], []
    for f in files + models:
        rel = os.path.relpath(f, REPO).replace("\\", "/")
        if rel not in ok:
            skipped.append(rel)
            continue
        if not force and not f.endswith(".glb") and key(os.path.splitext(os.path.basename(f))[0]) in have:
            continue
        tasks.append(task(f, MODEL_DIR if f.endswith(".glb") else TEX_DIR))
    if skipped:
        unreal.log_warning("[OV] not in CREDITS.md, skipped: " + ", ".join(skipped))
    if tasks:
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    sme = None
    try:
        sme = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
    except Exception:
        pass
    n_tex = n_mesh = 0
    for t in tasks:
        for p in t.get_editor_property("imported_object_paths") or []:
            a = EAL.load_asset(p)
            if isinstance(a, unreal.Texture2D):
                fix_texture(a)
                n_tex += 1
            elif isinstance(a, unreal.StaticMesh):
                ns = a.get_editor_property("nanite_settings")
                ns.set_editor_property("enabled", True)
                if sme:
                    sme.set_nanite_settings(a, ns, True)
                else:
                    a.set_editor_property("nanite_settings", ns)
                n_mesh += 1
            EAL.save_loaded_asset(a)
    unreal.log("[OV] art: imported %d textures, %d static meshes (Nanite on), %d already present, %d skipped (no credit)"
               % (n_tex, n_mesh, len(have), len(skipped)))
    return existing_textures()


if __name__ != "import_art":
    main()
