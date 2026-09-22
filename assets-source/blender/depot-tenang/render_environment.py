"""Render the Depot Tenang Blender environment used by the Phaser scene.

Run from Blender with the master scene loaded:

    blender -b depot-tenang-master.blend -P render_environment.py
"""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "public" / "assets" / "depot-tenang-v2" / "depot-tenang-table-felt-bg.png"


def render_environment() -> None:
    scene = bpy.context.scene
    if scene.name != "Depot_Tenang_Master":
        raise RuntimeError(f"Expected Depot_Tenang_Master, found {scene.name}")

    dynamic_objects = [obj for obj in scene.objects if obj.name.startswith("ENV_Active_")]
    previous_visibility = {obj.name: obj.hide_render for obj in dynamic_objects}

    try:
        for obj in dynamic_objects:
            obj.hide_render = True

        scene.render.resolution_x = 1672
        scene.render.resolution_y = 941
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGB"
        scene.render.film_transparent = False
        scene.render.filepath = str(OUTPUT)

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.render.render(write_still=True)
    finally:
        for obj in dynamic_objects:
            obj.hide_render = previous_visibility[obj.name]

    print(f"Rendered Depot Tenang environment to {OUTPUT}")


if __name__ == "__main__":
    render_environment()
