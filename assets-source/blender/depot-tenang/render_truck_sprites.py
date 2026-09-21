from math import radians
from pathlib import Path

import bpy


SCENE_NAME = "Dunia_Zee_Truck_Family"
CAMERA_NAME = "Truck_Sprite_Camera"
VARIANTS = {
    "Truck_Cargo_ROOT": "truck-cargo.png",
    "Truck_Tanker_ROOT": "truck-tanker.png",
    "Truck_Mixer_ROOT": "truck-mixer.png",
    "Truck_Dump_ROOT": "truck-mining-dump.png",
}
GAME_BODY_OUTPUTS = {
    "Truck_Cargo_ROOT": "truck-body-sol.png",
    "Truck_Tanker_ROOT": "truck-tanker-body.png",
    "Truck_Mixer_ROOT": "truck-mixer-body.png",
    "Truck_Dump_ROOT": "truck-mining-dump-body.png",
}
GAME_ASSET_DIR = Path(__file__).resolve().parents[3] / "public" / "assets" / "depot-tenang-v2"


def belongs_to(obj, root_name):
    parent = obj
    while parent is not None:
        if parent.name == root_name:
            return True
        parent = parent.parent
    return False


scene = bpy.data.scenes[SCENE_NAME]
camera = bpy.data.objects[CAMERA_NAME]
output_dir = Path(__file__).resolve().parent / "renders"
output_dir.mkdir(parents=True, exist_ok=True)

saved_hidden = {obj.name: obj.hide_render for obj in scene.objects}
saved_transforms = {
    name: (bpy.data.objects[name].location.copy(), bpy.data.objects[name].rotation_euler.copy())
    for name in VARIANTS
}
saved_camera = scene.camera
saved_camera_scale = camera.scale.copy()

scene.camera = camera
scene.render.resolution_x = 1024
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.film_transparent = True

try:
    for selected_name, filename in VARIANTS.items():
        for obj in scene.objects:
            if obj.type in {"LIGHT", "CAMERA"}:
                obj.hide_render = False
            elif obj.name in {"Studio_Tabletop", "Studio_Backdrop"}:
                obj.hide_render = True
            elif any(belongs_to(obj, root_name) for root_name in VARIANTS):
                obj.hide_render = not belongs_to(obj, selected_name)
            else:
                obj.hide_render = True

        selected = bpy.data.objects[selected_name]
        selected.location = (0, 0, 0)
        selected.rotation_euler = (0, 0, radians(-22))
        scene.render.filepath = str(output_dir / filename)
        bpy.ops.render.render(scene=scene.name, write_still=True)
        selected.location, selected.rotation_euler = saved_transforms[selected_name]

    camera.scale.x = -abs(camera.scale.x)
    scene.render.resolution_y = 474
    GAME_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    for selected_name, filename in GAME_BODY_OUTPUTS.items():
        selected = bpy.data.objects[selected_name]
        selected.location = (0, 0, 0)
        selected.rotation_euler = (0, 0, radians(-22))
        for obj in scene.objects:
            if obj.type in {"LIGHT", "CAMERA"}:
                obj.hide_render = False
            elif belongs_to(obj, selected_name):
                hidden_parts = ("Wheel", "Hub")
                if selected_name == "Truck_Cargo_ROOT":
                    hidden_parts += ("Crate",)
                obj.hide_render = any(part in obj.name for part in hidden_parts)
            else:
                obj.hide_render = True
        scene.render.filepath = str(GAME_ASSET_DIR / filename)
        bpy.ops.render.render(scene=scene.name, write_still=True)
        selected.location, selected.rotation_euler = saved_transforms[selected_name]
finally:
    for obj in scene.objects:
        if obj.name in saved_hidden:
            obj.hide_render = saved_hidden[obj.name]
    for name, (location, rotation) in saved_transforms.items():
        bpy.data.objects[name].location = location
        bpy.data.objects[name].rotation_euler = rotation
    camera.scale = saved_camera_scale
    scene.camera = saved_camera
