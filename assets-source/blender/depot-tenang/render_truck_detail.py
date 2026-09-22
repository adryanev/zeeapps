import bpy
from math import radians
from mathutils import Vector


scene = bpy.data.scenes["Dunia_Zee_Truck_Family"]
bpy.context.window.scene = scene


def belongs_to(obj, root_name):
    parent = obj
    while parent is not None:
        if parent.name == root_name:
            return True
        parent = parent.parent
    return False


for obj in scene.objects:
    obj.hide_render = belongs_to(obj, "Truck_Cargo_ROOT") or belongs_to(obj, "Truck_Dump_ROOT")

tanker = bpy.data.objects["Truck_Tanker_ROOT"]
mixer = bpy.data.objects["Truck_Mixer_ROOT"]
tanker.location = (-3.1, 0.0, 0.0)
mixer.location = (3.1, 0.0, 0.0)
tanker.rotation_euler.z = radians(-34)
mixer.rotation_euler.z = radians(-34)

camera = bpy.data.objects["Truck_Family_Camera"]
camera.location = (13.5, -13.0, 7.5)
camera.data.ortho_scale = 12.2
camera.rotation_euler = (Vector((0.0, 0.5, 2.0)) - camera.location).to_track_quat("-Z", "Y").to_euler()

scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 75
scene.render.filepath = "/Users/adryanev/Code/personal/zeeapps/.impeccable/review/tanker-mixer-detail-v1.png"
bpy.ops.render.render(scene=scene.name, write_still=True)
