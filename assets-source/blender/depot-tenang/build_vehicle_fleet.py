"""Build, render and measure the playable toy fleet. Run with Blender --background.

The PNGs and vehicleAnchors.json are generated together; do not hand-edit anchors.
All vehicles face +X, Z is up, and wheels turn around Y. Units are toy units.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUTPUT = ROOT / "public/assets/depot-tenang-v2"
GENERATED = ROOT / "src/game/generated"
bpy.ops.wm.open_mainfile(filepath=str(HERE / "truck-family.blend"))
scene = bpy.context.scene
scene.name = "Dunia_Zee_Vehicle_Fleet"
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1536
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.image_settings.color_depth = "8"
scene.view_settings.view_transform = "AgX"
camera = bpy.data.objects["Truck_Sprite_Camera"]
scene.camera = camera
camera.scale = (1, 1, 1)
camera.location = (0, -18, 10)
camera.rotation_euler = (Vector((0, 0, 1.8)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 8.5


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    return result


teal = material("Fleet_Teal", (0.045, 0.34, 0.36))
wood = material("Fleet_Beech", (0.68, 0.44, 0.2))
cream = material("Fleet_Cream", (0.91, 0.78, 0.51))
gold = material("Fleet_Ochre", (0.84, 0.47, 0.085))
red = material("Fleet_Terracotta", (0.62, 0.18, 0.095))
glass = material("Fleet_Window", (0.19, 0.38, 0.42))
rubber = material("Fleet_Rubber", (0.035, 0.043, 0.039))
steel = material("Fleet_Metal", (0.29, 0.32, 0.3))


def root(name):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    return obj


def finish(obj, name, position, mat, parent):
    obj.name = name
    obj.location = position
    obj.parent = parent
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Soft toy edges", "BEVEL")
    bevel.width = 0.055
    bevel.segments = 5
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def box(name, position, size, mat, parent):
    bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.object
    obj.scale = tuple(value / 2 for value in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, position, mat, parent)


def cylinder(name, position, radius, depth, mat, parent, axis="Z"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth)
    obj = bpy.context.object
    if axis == "X":
        obj.rotation_euler.y = math.pi / 2
    elif axis == "Y":
        obj.rotation_euler.x = math.pi / 2
    return finish(obj, name, position, mat, parent)


def sphere(name, position, size, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16)
    obj = bpy.context.object
    obj.scale = tuple(value / 2 for value in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, position, mat, parent)


def wing(name, position, chord, span, mat, parent):
    # A swept planform with rounded tips and a solid, bevelled leading edge.
    outline = [(0.55, 0), (0.35, 0.42), (0.15, 0.5), (-0.25, 0.5),
               (-0.5, 0.42), (-0.5, -0.42), (-0.25, -0.5), (0.15, -0.5), (0.35, -0.42)]
    vertices = [(x * chord, y * span, z) for z in [-0.07, 0.07] for x, y in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return finish(obj, name, position, mat, parent)


def wheels(parent, xs, radius, gauge):
    for index, x in enumerate(xs):
        for side in (-1, 1):
            y = side * gauge / 2
            name = f"{parent.name}_Wheel_{index}_{side}"
            cylinder(name, (x, y, radius), radius, 0.22, rubber, parent, "Y")
            cylinder(name.replace("Wheel", "Hub"), (x, y + side * 0.13, radius), radius * 0.43, 0.07, gold, parent, "Y")


truck_roots = {}
for key, name in [("cargo", "Cargo"), ("tanker", "Tanker"), ("mixer", "Mixer"), ("dump", "Dump")]:
    obj = bpy.data.objects[f"Truck_{name}_ROOT"]
    obj.location = (0, 0, -0.12)
    obj.rotation_euler = (0, 0, math.pi / 2)
    truck_roots[key] = obj
# Remove inherited actions before posing render frames; actions override Euler edits.
for parent in truck_roots.values():
    for obj in [parent, *parent.children_recursive]:
        obj.animation_data_clear()
bpy.data.objects["Dump_Bed_Pivot"].rotation_euler.x = 0

# Model details remain attached to the original rig and preserve axle geometry.
window_glass = material("Fleet_Deep_Glass", (0.028, 0.105, 0.145))
window_glass.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.24
window_glint = material("Fleet_Glass_Reflection", (0.34, 0.62, 0.65))
panel = material("Fleet_Panel_Edge", (0.028, 0.21, 0.23))
bed_rib = material("Fleet_Bed_Rib", (0.73, 0.27, 0.14))
for key, parent in truck_roots.items():
    prefix = key.capitalize()
    for obj in parent.children_recursive:
        if obj.type != "MESH":
            continue
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        if not any(modifier.type == "WEIGHTED_NORMAL" for modifier in obj.modifiers):
            obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        for modifier in obj.modifiers:
            if modifier.type == "BEVEL":
                modifier.segments = 5
        if "Window" in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(window_glass)
    for side, label in [(-1, "Left"), (1, "Right")]:
        window = bpy.data.objects[f"{prefix}_{label}_Window"]
        window.location = (side * 1.205, -1.48, 2.54)
        window.scale.y *= 1.38
        window.scale.z *= 1.22
        box(f"{prefix}_Window_Trim_{label}", (side * 1.19, -1.48, 2.54), (0.035, 1.23, 0.9), rubber, parent)
        box(f"{prefix}_Glass_Glint_{label}", (side * 1.24, -1.68, 2.73), (0.018, 0.45, 0.055), window_glint, parent)
        box(f"{prefix}_Door_Panel_{label}", (side * 1.185, -1.38, 1.91), (0.035, 1.31, 0.31), panel, parent)
        box(f"{prefix}_Door_Handle_{label}", (side * 1.235, -0.92, 2.12), (0.075, 0.27, 0.075), cream, parent)
        box(f"{prefix}_Cab_Step_{label}", (side * 1.23, -1.16, 1.17), (0.22, 1.25, 0.12), steel, parent)
    for y in [-1.65, -0.8, 0.05]:
        if key == "dump":
            for side in [-1, 1]:
                box("Dump_Bed_Support", (side * 1.26, y, 0.99), (0.07, 0.12, 0.9), bed_rib, bpy.data.objects["Dump_Bed_Pivot"])

for obj in list(truck_roots["tanker"].children_recursive):
    if any(part in obj.name for part in ["Ladder_", "Side_Pipe", "Side_Stripe"]):
        near = obj.copy()
        near.data = obj.data.copy()
        scene.collection.objects.link(near)
        near.location.x = -obj.location.x
        near.name = obj.name + "_Near"

# Align the cylindrical shell and circular straps with the truck's length.
for obj in list(truck_roots["tanker"].children_recursive):
    if obj.name.startswith(("Tanker_Tank_", "Tanker_Band_")):
        bpy.data.objects.remove(obj, do_unlink=True)
tanker = truck_roots["tanker"]
cylinder("Tanker_Tank_Body", (0, 0.62, 2.22), 1.0, 2.75, gold, tanker, "Y")
for y in [-0.75, 1.99]:
    sphere("Tanker_Tank_Dome", (0, y, 2.22), (2, 0.76, 2), gold, tanker)
for y in [-0.42, 0.6, 1.62]:
    bpy.ops.mesh.primitive_torus_add(major_radius=1.015, minor_radius=0.045, major_segments=96, minor_segments=12)
    band = bpy.context.object
    band.name = "Tanker_Band"
    band.parent = tanker
    band.location = (0, y, 2.22)
    band.rotation_euler.x = math.pi / 2
    band.data.materials.append(cream)
    for polygon in band.data.polygons:
        polygon.use_smooth = True

scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.3
bpy.data.objects["Fill_Softbox"].data.energy = 650

train = root("Train_ROOT")
box("Train_Chassis", (0, 0, 0.77), (5.45, 1.8, 0.32), wood, train)
box("Train_Cab", (-1.55, 0, 1.75), (1.5, 1.75, 1.8), teal, train)
box("Train_Roof", (-1.6, 0, 2.73), (1.95, 2.05, 0.24), red, train)
for y in (-0.892, 0.892):
    box("Train_Window_Trim", (-1.55, y, 2.06), (1.02, 0.035, 0.85), rubber, train)
    box("Train_Cab_Window", (-1.55, y * 1.02, 2.06), (0.87, 0.04, 0.7), window_glass, train)
    box("Train_Window_Glint", (-1.35, y * 1.055, 2.22), (0.3, 0.025, 0.04), window_glint, train)
    box("Train_Cab_Handle", (-1.94, y * 1.05, 1.57), (0.2, 0.08, 0.07), cream, train)
cylinder("Train_Boiler", (0.43, 0, 1.53), 0.7, 2.65, teal, train, "X")
cylinder("Train_Boiler_Front", (1.8, 0, 1.53), 0.71, 0.13, steel, train, "X")
for x in [-0.32, 1.1]:
    bpy.ops.mesh.primitive_torus_add(major_radius=0.705, minor_radius=0.035, major_segments=64, minor_segments=12)
    band = bpy.context.object
    band.name = "Train_Boiler_Band"
    band.parent = train
    band.location = (x, 0, 1.53)
    band.rotation_euler.y = math.pi / 2
    band.data.materials.append(cream)
    for polygon in band.data.polygons:
        polygon.use_smooth = True
for y in [-0.73, 0.73]:
    cylinder("Train_Handrail", (0.43, y, 1.85), 0.035, 2.3, steel, train, "X")
cylinder("Train_Headlamp", (1.9, 0, 1.78), 0.24, 0.15, gold, train, "X")
cylinder("Train_Chimney", (1, 0, 2.43), 0.23, 0.95, rubber, train)
cylinder("Train_Chimney_Rim", (1, 0, 2.93), 0.33, 0.12, gold, train)
sphere("Train_Dome", (-0.05, 0, 2.25), (0.58, 0.58, 0.6), gold, train)
box("Train_Buffer_Front", (2.9, 0, 0.65), (0.4, 1.95, 0.28), rubber, train)
box("Train_Coupler_Rear", (-2.95, 0, 0.68), (0.6, 0.3, 0.18), steel, train)
wheels(train, (-1.78, -0.12, 1.5), 0.53, 1.94)

carriage = root("Carriage_ROOT")
box("Carriage_Chassis", (0, 0, 0.72), (4.4, 1.78, 0.3), wood, carriage)
box("Carriage_Bed", (0, 0, 0.97), (3.95, 1.68, 0.22), red, carriage)
for y in (-0.80, 0.80):
    box("Carriage_Side", (0, y, 1.2), (3.95, 0.14, 0.55), red, carriage)
    for x in [-1.3, 0, 1.3]:
        box("Carriage_Bed_Support", (x, y * 1.105, 1.2), (0.09, 0.04, 0.52), wood, carriage)
for x in (-1.9, 1.9):
    box("Carriage_End", (x, 0, 1.2), (0.14, 1.68, 0.55), red, carriage)
for x in (-2.46, 2.46):
    box("Carriage_Coupler", (x, 0, 0.68), (0.58, 0.3, 0.18), steel, carriage)
wheels(carriage, (-1.4, 1.4), 0.46, 1.93)

plane = root("Airplane_ROOT")
sphere("Airplane_Fuselage", (0, 0, 1.25), (5, 0.92, 1.02), cream, plane)
sphere("Airplane_Cockpit", (0.32, 0, 1.64), (1.45, 0.8, 0.72), glass, plane)
wing("Airplane_Main_Wing", (0.15, 0, 1.17), 1.35, 6.2, teal, plane)
wing("Airplane_Tailplane", (-1.91, 0, 1.37), 0.82, 2.35, red, plane)
fin = box("Airplane_Tail_Fin", (-1.95, 0, 1.87), (0.75, 0.13, 1.12), red, plane)
fin.rotation_euler.y = -0.24
cylinder("Airplane_Nose", (2.26, 0, 1.25), 0.35, 0.36, gold, plane, "X")
propeller = root("Airplane_Propeller_Pivot")
propeller.parent = plane
propeller.location = (2.52, 0, 1.25)
box("Airplane_Propeller", (0, 0, 0), (0.11, 0.15, 2.1), rubber, propeller)
cylinder("Airplane_Spinner", (0.08, 0, 0), 0.17, 0.22, red, propeller, "X")
for y in (-0.75, 0.75):
    leg = box("Airplane_Landing_Strut", (0.55, y, 0.61), (0.12, 0.14, 0.86), steel, plane)
    cylinder("Airplane_Gear", (0.55, y, 0.25), 0.25, 0.15, rubber, plane, "Y")
box("Airplane_Tail_Strut", (-1.95, 0, 0.62), (0.1, 0.1, 0.75), steel, plane)
cylinder("Airplane_Tail_Gear", (-1.95, 0, 0.18), 0.18, 0.13, rubber, plane, "Y")

crate = root("Crate_ROOT")
box("Crate_Core", (0, 0, 0), (0.9, 0.72, 0.78), cream, crate)
for z in (-0.28, 0.28):
    for y in (-0.38, 0.38):
        box("Crate_Rail", (0, y, z), (0.94, 0.055, 0.1), wood, crate)
for x in (-0.35, 0.35):
    box("Crate_Brace", (x, -0.41, 0), (0.09, 0.05, 0.7), wood, crate)

fleet = {**truck_roots, "train": train, "carriage": carriage, "airplane": plane, "crate": crate}
filenames = {"cargo": "truck-body-sol", "tanker": "truck-tanker-body", "mixer": "truck-mixer-body", "dump": "truck-mining-dump-body", "train": "train-locomotive-sol", "carriage": "train-carriage-sol", "airplane": "airplane-body", "crate": "cargo-crate-sol"}
manifest = {}


def pose_dump(angle):
    pivot = bpy.data.objects["Dump_Bed_Pivot"]
    parent = truck_roots["dump"]
    pivot.rotation_euler.x = angle
    bpy.context.view_layer.update()
    start = Vector((0, -0.1, 1.02))
    end = parent.matrix_world.inverted() @ pivot.matrix_world @ Vector((0, -2.1, 0.32))
    direction = end - start
    for name, radius, lower, upper, mat in [
        ("Dump_Hydraulic_Barrel", 0.13, 0, 0.62, steel),
        ("Dump_Hydraulic_Rod", 0.075, 0.55, 1, cream),
    ]:
        obj = bpy.data.objects.get(name)
        if obj is None:
            obj = cylinder(name, (0, 0, 0), radius, 1, mat, parent)
        obj.location = start + direction * (lower + upper) / 2
        obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        obj.scale.z = direction.length * (upper - lower)


def project(point, width):
    projected = world_to_camera_view(scene, camera, Vector(point))
    return {"x": round((projected.x - 0.5) * width, 4), "y": round((0.5 - projected.y) * width * scene.render.resolution_y / scene.render.resolution_x, 4)}


def show_only(parent, body_only=True):
    members = {parent, *parent.children_recursive}
    for obj in scene.objects:
        if obj.type in {"LIGHT", "CAMERA"}:
            obj.hide_render = False
        else:
            obj.hide_render = obj not in members
            if body_only and obj in members:
                obj.hide_render = any(part in obj.name for part in ("Wheel", "Hub", "Cargo_Crate", "Dump_Rock", "Propeller", "Spinner"))


def measure(parent, width):
    bpy.context.view_layer.update()
    points = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(v)) for obj in parent.children_recursive if obj.type == "MESH" for v in obj.bound_box]
    bounds = [min(p.x for p in points), max(p.x for p in points), min(p.y for p in points), max(p.y for p in points)]
    assert min(bounds[0], bounds[2]) > 0.025 and max(bounds[1], bounds[3]) < 0.975, (parent.name, "clipped frame", bounds)
    wheel_objects = [o for o in parent.children_recursive if "Wheel" in o.name and o.type == "MESH"]
    near_wheels = [o for o in wheel_objects if o.matrix_world.translation.y < 0]
    far_wheels = [o for o in wheel_objects if o.matrix_world.translation.y > 0]
    return {
        "spriteWidth": width, "spriteHeight": width * 512 / 768,
        "frameBounds": bounds,
        "groundContact": project((0, 0, 0), width),
        "wheels": [project(o.matrix_world.translation, width) for o in sorted(near_wheels, key=lambda o: o.matrix_world.translation.x)],
        "farWheels": [project(o.matrix_world.translation, width) for o in sorted(far_wheels, key=lambda o: o.matrix_world.translation.x)],
        "wheelRadius": round(((max((near_wheels[0].matrix_world @ Vector(v)).z for v in near_wheels[0].bound_box) - min((near_wheels[0].matrix_world @ Vector(v)).z for v in near_wheels[0].bound_box)) / 2 if near_wheels else 0) * width / camera.data.ortho_scale, 4),
        "wheelAspect": round(math.cos(math.atan2(8.2, 18)), 6),
    }


OUTPUT.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)
for key, parent in fleet.items():
    camera.data.ortho_scale = 8.5 if key in truck_roots else 7.4
    target_z = 1.8 if key in truck_roots else 1.4
    if key == "crate":
        camera.data.ortho_scale = 1.8
        target_z = 0
    camera.location = (0, -18, target_z + 8.2)
    camera.rotation_euler = (Vector((0, 0, target_z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    width = 248 if key in truck_roots else {"train": 184, "carriage": 184, "airplane": 226, "crate": 248 / 8.5 * 1.8}[key]
    if key == "dump":
        pose_dump(0)
    show_only(parent)
    manifest[key] = measure(parent, width)
    if key == "cargo":
        # Slots are on top of the bed, clear of the cab, measured in Blender space.
        manifest[key]["cargoSlots"] = [project(parent.matrix_world @ Vector(p), width) for p in [(0, 0.3, 2.83), (0, 1.42, 2.83), (0, 0.86, 3.6)]]
    if key in {"train", "carriage"}:
        extent = 3.25 if key == "train" else 2.75
        manifest[key]["couplerFront"] = project((extent, 0, 0.68), width)
        manifest[key]["couplerRear"] = project((-extent, 0, 0.68), width)
        manifest[key]["railContact"] = project((0, -0.97, 0), width)
    if key == "airplane":
        manifest[key]["propeller"] = project(propeller.matrix_world.translation, width)
    if key == "mixer":
        chute = bpy.data.objects["Mixer_Chute"]
        vertices = [chute.matrix_world @ Vector(v) for v in chute.bound_box]
        rear_x = min(v.x for v in vertices)
        lip = [v for v in vertices if abs(v.x - rear_x) < 0.001]
        manifest[key]["pourOutlet"] = project(sum(lip, Vector()) / len(lip), width)
    scene.render.filepath = str(OUTPUT / (filenames[key] + ".png"))
    bpy.ops.render.render(write_still=True)
    if key in {"mixer", "dump"}:
        pivot = bpy.data.objects["Mixer_Drum_Pivot" if key == "mixer" else "Dump_Bed_Pivot"]
        rest = pivot.rotation_euler.copy()
        frames = 24 if key == "mixer" else 13
        manifest[key]["animationFrames"] = frames
        for index in range(1, frames):
            pivot.rotation_euler = rest
            if key == "mixer":
                pivot.rotation_euler.y += index * math.tau / frames
            else:
                pose_dump(-math.radians(38) * index / (frames - 1))
            measure(parent, width)
            scene.render.filepath = str(OUTPUT / f"{filenames[key]}-{index}.png")
            bpy.ops.render.render(write_still=True)
        pivot.rotation_euler = rest
        if key == "dump":
            pose_dump(0)
    # GLBs retain actual wheels, propeller and truck load as editable geometry.
    show_only(parent, body_only=False)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [parent, *parent.children_recursive]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parent
    bpy.ops.export_scene.gltf(filepath=str(HERE / "exports" / f"fleet-{key}.glb"), export_format="GLB", use_selection=True, export_animations=False)

# A front-facing round wheel is rotated INSIDE a projected ellipse by Phaser.
wheel = root("Wheel_Prop_ROOT")
cylinder("Wheel_Tire", (0, 0, 0), 0.9, 0.24, rubber, wheel, "Y")
cylinder("Wheel_Rim", (0, -0.15, 0), 0.54, 0.07, steel, wheel, "Y")
cylinder("Wheel_Axle", (0, -0.21, 0), 0.2, 0.09, gold, wheel, "Y")
for angle in range(0, 360, 60):
    a = math.radians(angle)
    cylinder("Wheel_Bolt", (math.cos(a) * 0.36, -0.21, math.sin(a) * 0.36), 0.065, 0.05, cream, wheel, "Y")
camera.location = (0, -18, 0)
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.ortho_scale = 1.9
scene.render.resolution_x = scene.render.resolution_y = 512
show_only(wheel, body_only=False)
scene.render.filepath = str(OUTPUT / "wheel-sprite.png")
bpy.ops.render.render(write_still=True)
# Face-on propeller; gameplay compresses its disc in the same side projection.
show_only(propeller, body_only=False)
camera.location = (20, 0, 1.25)
camera.rotation_euler = (Vector((2.52, 0, 1.25)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.ortho_scale = 2.3
scene.render.filepath = str(OUTPUT / "propeller-sprite.png")
bpy.ops.render.render(write_still=True)

(GENERATED / "vehicleAnchors.json").write_text(json.dumps(manifest, indent=2) + "\n")
# Arrange the source as a readable catalogue, with no overlapping roots.
for index, parent in enumerate(fleet.values()):
    parent.location = ((index % 4) * 9 - 13.5, (index // 4) * 10, 0)
    for obj in [parent, *parent.children_recursive]:
        obj.hide_render = False
for obj in scene.objects:
    if obj.type not in {"LIGHT", "CAMERA"} and not any(obj == r or obj in r.children_recursive for r in fleet.values()):
        obj.hide_render = True
camera.location = (18, -30, 30)
camera.rotation_euler = (Vector((0, 4, 1)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.ortho_scale = 42
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.filepath = str(HERE / "renders/vehicle-fleet.png")
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "vehicle-fleet.blend"))
bpy.ops.render.render(write_still=True)
print("Fleet generated with verified frame bounds and projected anchors")
