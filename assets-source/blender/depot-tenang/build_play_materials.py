"""Build the tactile materials as editable Blender models and transparent sprites."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / "public/assets/depot-tenang-v2"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Dunia_Zee_Play_Materials"
scene.render.engine = "BLENDER_EEVEE"
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.world = bpy.data.worlds.new("Soft daylight")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
for name, position, energy, size in [
    ("Key", (-5, -7, 10), 1500, 7), ("Fill", (6, -3, 6), 650, 6), ("Rim", (0, 5, 8), 1100, 5),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size = energy, "DISK", size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat("-Z", "Y").to_euler()
camera = bpy.data.objects.new("Material_Camera", bpy.data.cameras.new("Material_Camera"))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = "ORTHO"
catalogue = []
manifest = {}


def material(name, color, roughness=0.5, grain=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    if grain:
        noise = mat.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 45
        bump = mat.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.16
        bump.inputs["Distance"].default_value = 0.045
        mat.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


wood = material("Beech formwork", (0.48, 0.29, 0.12), 0.58, True)
wood_edge = material("Fresh wood edges", (0.72, 0.49, 0.24), 0.5)
concrete = material("Wet concrete", (0.39, 0.40, 0.35), 0.3, True)
stone = material("River stone", (0.37, 0.33, 0.25), 0.76, True)
terracotta = material("Painted wooden block", (0.64, 0.25, 0.12), 0.43, True)
water = material("Clear turquoise water", (0.055, 0.43, 0.53), 0.16)
water.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.55
water.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.18
foam = material("Water reflections", (0.68, 0.9, 0.87), 0.2)
mud = material("Wet mud", (0.22, 0.13, 0.055), 0.3, True)
paper = material("Cement sack kraft", (0.70, 0.55, 0.34), 0.85, True)
ink = material("Sack print", (0.18, 0.30, 0.27), 0.75)
metal = material("Bucket handle", (0.42, 0.49, 0.47), 0.27)
rubber = material("Rubber hose", (0.035, 0.055, 0.05), 0.55)


def group(name):
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    catalogue.append(root)
    return root


def finish(obj, name, location, mat, parent, bevel=0):
    obj.name, obj.parent, obj.location = name, parent, location
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    if bevel:
        mod = obj.modifiers.new("Rounded edges", "BEVEL")
        mod.width, mod.segments = bevel, 4
        obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def box(name, location, size, mat, parent, bevel=0.035):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.scale = [v / 2 for v in size]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, location, mat, parent, bevel)


def sphere(name, location, size, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24)
    obj = bpy.context.object
    obj.scale = [v / 2 for v in size]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, location, mat, parent)


def tube(name, points, radius, mat, parent):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions, data.bevel_depth, data.bevel_resolution = "3D", radius, 4
    path = data.splines.new("POLY")
    path.points.add(len(points) - 1)
    for point, xyz in zip(path.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    data.materials.append(mat)
    return obj


def render(key, root, width, height, ortho, target_z=0, pixels=512, contact=None):
    camera.data.ortho_scale = ortho
    camera.location = (0, -18, target_z + 8.2)
    camera.rotation_euler = (Vector((0, 0, target_z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x, scene.render.resolution_y = pixels, round(pixels * height / width)
    scene.render.resolution_percentage = 100
    members = {root, *root.children_recursive}
    for obj in scene.objects:
        obj.hide_render = obj.type not in {"LIGHT", "CAMERA"} and obj not in members
    bpy.context.view_layer.update()
    entry = {"file": "material-" + key + ".png", "width": width, "height": height}
    if contact:
        p = world_to_camera_view(scene, camera, Vector(contact))
        entry["contactY"] = round((0.5 - p.y) * height, 4)
        entry["contactX"] = round((p.x - 0.5) * width, 4)
    manifest[key] = entry
    scene.render.filepath = str(OUTPUT / entry["file"])
    bpy.ops.render.render(write_still=True)


# Solid stones keep their mass and rounded chipped edges at large sizes.
for index in range(3):
    root = group("Stone_" + str(index))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.48)
    obj = bpy.context.object
    for i, vertex in enumerate(obj.data.vertices):
        vertex.co *= 1 + 0.08 * math.sin(i * 7.1 + index * 1.7)
        vertex.co.z = max(-0.34, vertex.co.z)
    obj.rotation_euler = (0.1 * index, 0.15 * index, 0.7 * index)
    finish(obj, "Stone", (0, 0, 0), stone, root, 0.025)
    render("rock-" + str(index), root, 53, 53, 1.18)

root = group("Wooden_Block")
box("Solid block", (0, 0, 0), (0.85, 0.52, 0.85), terracotta, root, 0.06)
box("Inset face", (0, -0.267, 0), (0.62, 0.025, 0.62), wood_edge, root, 0.04)
box("Painted inset", (0, -0.285, 0), (0.51, 0.018, 0.51), terracotta, root, 0.03)
render("block", root, 48, 48, 1.14)

root = group("Concrete_Form")
box("Form base", (0, 0, 0), (3.35, 1.65, 0.16), wood, root)
for y in [-0.8, 0.8]:
    box("Long rim", (0, y, 0.15), (3.42, 0.12, 0.38), wood_edge, root)
for x in [-1.65, 1.65]:
    box("End rim", (x, 0, 0.15), (0.12, 1.65, 0.38), wood_edge, root)
for x in [-1.15, 1.15]:
    box("Brace", (x, -0.88, 0.1), (0.13, 0.09, 0.38), wood, root)
slab = box("Poured concrete", (0, 0, 0.1), (3.14, 1.42, 0.27), concrete, root, 0.055)
for step in range(7):
    slab.scale.z = max(0.015, step / 6)
    slab.location.z = 0.04 + 0.135 * step / 6
    # A thin initial film stays below the wooden rim.
    render("mold-" + str(step), root, 110, 55, 4.15, 0.13, 768, contact=(0, -0.55, 0.31))

root = group("Water_Pool")
sphere("Water volume", (0, 0, 0), (8.3, 2.55, 0.22), water, root)
for j, (cx, cy, rx, ry) in enumerate([(-2.2, 0.1, 1.1, 0.35), (1.25, -0.35, 1.55, 0.32)]):
    points = [(cx + rx * math.cos(t), cy + ry * math.sin(t), 0.115) for t in [0.2 + i * 0.07 for i in range(28)]]
    tube("Surface reflection_" + str(j), points, 0.025, foam, root)
render("pool", root, 380, 126, 10, 0, 1536)

for key, mat in [("water-drop", water), ("concrete-drop", concrete)]:
    root = group(key)
    obj = sphere("Flow drop", (0, 0, 0), (0.52, 0.48, 0.85), mat, root)
    for vertex in obj.data.vertices:
        if vertex.co.z > 0:
            vertex.co.x *= 1 - vertex.co.z * 1.5
            vertex.co.y *= 1 - vertex.co.z * 1.5
    render(key, root, 18, 24, 1.05, 0, 256)

for key, mat in [("water-splash", water), ("concrete-splash", concrete)]:
    root = group(key)
    sphere("Impact pool", (0, 0, 0), (1.4, 0.85, 0.12), mat, root)
    for i in range(7):
        angle = i * math.tau / 7
        sphere("Splash bead", (0.56 * math.cos(angle), 0.35 * math.sin(angle), 0.15 + 0.12 * (i % 3)), (0.12, 0.12, 0.22), mat, root)
    if key == "water-splash":
        tube("Foam arc", [(0.4 * math.cos(i * 0.1), 0.25 * math.sin(i * 0.1), 0.1) for i in range(36)], 0.028, foam, root)
    render(key, root, 64, 44, 2, 0.15, 512)

root = group("Mud_Patch")
for i, (x, y, sx, sy) in enumerate([(0, 0, 0.8, 0.6), (-0.3, 0.1, 0.4, 0.45), (0.32, 0.08, 0.45, 0.3), (0.15, -0.23, 0.28, 0.35)]):
    sphere("Mud lobe", (x, y, 0.035), (sx, sy, 0.12), mud, root)
for x, y in [(-0.49, -0.2), (0.46, -0.21), (-0.1, 0.37)]:
    sphere("Mud fleck", (x, y, 0.025), (0.11, 0.12, 0.07), mud, root)
render("mud", root, 70, 46, 1.35, 0, 512)

root = group("Cement_Sack")
box("Soft paper sack", (0, 0, 0), (0.95, 0.55, 1.1), paper, root, 0.16)
for z in [-0.49, 0.49]:
    box("Folded seam", (0, 0, z), (0.94, 0.53, 0.08), paper, root, 0.025)
box("Printed label", (0, -0.281, 0.02), (0.63, 0.012, 0.6), ink, root, 0.025)
box("Cement symbol", (0, -0.293, 0.03), (0.38, 0.015, 0.24), concrete, root, 0.02)
render("cement-sack", root, 104, 104, 1.5, 0, 512)

root = group("Water_Bucket")
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.38, radius2=0.5, depth=0.76, end_fill_type="NOTHING")
bucket = finish(bpy.context.object, "Bucket shell", (0, 0, 0), water, root)
mod = bucket.modifiers.new("Plastic thickness", "SOLIDIFY")
mod.thickness = 0.045
sphere("Water inside", (0, 0, 0.22), (0.89, 0.89, 0.07), water, root)
tube("Handle", [(0.51 * math.cos(i * math.pi / 40), 0, 0.28 + 0.58 * math.sin(i * math.pi / 40)) for i in range(41)], 0.035, metal, root)
tube("Bucket rim", [(0.5 * math.cos(i * math.tau / 64), 0.5 * math.sin(i * math.tau / 64), 0.38) for i in range(65)], 0.035, foam, root)
render("water-bucket", root, 104, 104, 1.65, 0.22, 512)

root = group("Water_Hose")
tube("Curved rubber hose", [(1, 0, 0), (0.65, -0.05, -0.28), (0.1, -0.05, -0.38), (-0.45, 0, -0.12), (-0.65, 0, 0.22)], 0.09, rubber, root)
tube("Brass nozzle", [(-0.65, 0, 0.22), (-1.08, 0, 0.53)], 0.115, metal, root)
box("Grip", (-0.55, -0.025, 0.02), (0.11, 0.13, 0.32), rubber, root)
render("water-hose", root, 75, 56, 3, 0.12, 512, contact=(-1.12, 0, 0.56))

(ROOT / "src/game/generated/playMaterials.json").write_text(json.dumps(manifest, indent=2) + "\n")
exports = HERE / "exports"
exports.mkdir(exist_ok=True)
for root in catalogue:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root, *root.children_recursive]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(exports / ("material-" + root.name.lower().replace("_", "-") + ".glb")), export_format="GLB", use_selection=True, export_animations=False)
for i, root in enumerate(catalogue):
    for obj in [root, *root.children_recursive]:
        obj.hide_render = False
    root.location = ((i % 4) * 5 - 7.5, (i // 4) * 4, 0)
camera.location = (14, -25, 28)
camera.rotation_euler = (Vector((0, 5, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.ortho_scale = 32
scene.render.resolution_x, scene.render.resolution_y = 1800, 1400
scene.render.filepath = str(HERE / "renders/play-materials.png")
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "play-materials.blend"))
bpy.ops.render.render(write_still=True)
print("Play materials and logical sprite dimensions exported")
