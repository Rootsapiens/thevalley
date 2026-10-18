# Shrinks two Michelangelo drawings (public domain, Wikimedia Commons) for the church walls.
# Run: blender -b -P scripts/blender/shrink_renaissance.py
import bpy, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "art-src", "renaissance")
OUT = os.path.join(ROOT, "public", "art", "photos")
for src, name in [("pieta-study.jpg", "mary"), ("crucifixion.jpg", "crucifixion")]:
    img = bpy.data.images.load(os.path.join(SRC, src))
    img.scale(640, 360)
    img.filepath_raw = os.path.join(OUT, name + ".jpg")
    img.file_format = "JPEG"
    img.save()
    print("saved", name)
