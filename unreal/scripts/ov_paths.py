"""Where things live. The UE project is the mirror C:\\Users\\<you>\\OVUnreal\\unreal\\OmegaValley (Unreal cannot save
packages under Desktop on this machine); the git repo (public/art, CREDITS.md, studio/) stays at Desktop\\OmegaValley.

  OV_REPO     git repo root (public/, CREDITS.md, studio/, scripts/). Set by the .ps1 runners.
  OV_DATA     barn JSON (default <unreal>/data/village-barn.json next to the project).
Pure Python (no unreal import) so it also runs in tests.
"""
import os


def repo_dir(project_dir):
    env = os.environ.get("OV_REPO")
    if env and os.path.isdir(env):
        return os.path.abspath(env)
    up2 = os.path.normpath(os.path.join(project_dir, "..", ".."))
    if os.path.isfile(os.path.join(up2, "package.json")):
        return up2                                   # project still inside the repo
    desk = os.path.join(os.path.expanduser("~"), "Desktop", "OmegaValley")
    return desk if os.path.isdir(desk) else up2


def unreal_dir(project_dir):
    """<...>/unreal: holds data/ and scripts/ next to the project."""
    return os.path.normpath(os.path.join(project_dir, ".."))


def data_file(project_dir, name="village-barn.json"):
    if name == "village-barn.json" and os.environ.get("OV_DATA"):
        return os.environ["OV_DATA"]
    return os.path.join(unreal_dir(project_dir), "data", name)
