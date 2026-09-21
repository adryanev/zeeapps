from pathlib import Path

import bpy


SCENE_NAME = "Dunia_Zee_Truck_Family"
VARIANTS = {
    "Truck_Cargo_ROOT": "truck-cargo.glb",
    "Truck_Tanker_ROOT": "truck-tanker.glb",
    "Truck_Mixer_ROOT": "truck-mixer.glb",
    "Truck_Dump_ROOT": "truck-mining-dump.glb",
}


scene = bpy.data.scenes[SCENE_NAME]
export_dir = Path(__file__).resolve().parent / "exports"
export_dir.mkdir(parents=True, exist_ok=True)
scene.frame_set(1)

for root_name, filename in VARIANTS.items():
    root = bpy.data.objects[root_name]
    saved_location = root.location.copy()
    saved_rotation = root.rotation_euler.copy()
    saved_scale = root.scale.copy()

    bpy.ops.object.select_all(action="DESELECT")
    root.location = (0, 0, 0)
    root.rotation_euler = (0, 0, 0)
    root.scale = (1, 1, 1)

    for obj in [root, *root.children_recursive]:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    bpy.ops.export_scene.gltf(
        filepath=str(export_dir / filename),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_cameras=False,
        export_lights=False,
    )

    root.location = saved_location
    root.rotation_euler = saved_rotation
    root.scale = saved_scale
