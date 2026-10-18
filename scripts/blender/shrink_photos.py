# Shrinks the Joseph-game room images into church wall photos (640x360 JPEG).
# Run: blender -b -P scripts/blender/shrink_photos.py
import bpy, os
SRC = os.path.join(os.path.dirname(bpy.data.filepath or os.getcwd()), "reference/omega-valley-joseph/rooms")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "reference", "omega-valley-joseph", "rooms")
OUT = os.path.join(ROOT, "public", "art", "photos")
os.makedirs(OUT, exist_ok=True)
for name in ["church_steps", "great_hall", "yard"]:
    img = bpy.data.images.load(os.path.join(SRC, name + ".png"))
    img.scale(640, 360)
    s = bpy.context.scene.render.image_settings
    s.file_format, s.quality = "JPEG", 85
    img.filepath_raw = os.path.join(OUT, name + ".jpg")
    img.file_format = "JPEG"
    img.save()
    print("saved", name)
