"""Project the authored road and railway into the background image's coordinates."""
import json
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[3]
scene = bpy.context.scene
assert scene.name == "Depot_Tenang_Master"
scene.render.resolution_x, scene.render.resolution_y = 1672, 941
scene.render.resolution_percentage = 100


def project(point):
    p = world_to_camera_view(scene, scene.camera, Vector(point))
    return {"x": round(p.x, 7), "y": round(1 - p.y, 7)}


road = bpy.data.objects["ENV_Road_Asphalt"]
vertices = road.data.vertices
assert len(vertices) % 2 == 0
points = [(road.matrix_world @ vertices[i].co + road.matrix_world @ vertices[i + 1].co) / 2 for i in range(0, len(vertices), 2)]
assert all(points[i + 1].x >= points[i].x for i in range(len(points) - 1))
layout = {
    "imageWidth": 1672,
    "imageHeight": 941,
    "road": [project(p) for p in points],
    "rail": [project((-12.4, 4.48, 1.075)), project((12.4, 4.48, 1.075))],
    "airplaneParking": project((9, -2.1, 0.91)),
}
output = ROOT / "src/game/generated/depotLayout.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(layout, indent=2) + "\n")
print("Exported", len(points), "road samples and rail contact line", layout["rail"])
