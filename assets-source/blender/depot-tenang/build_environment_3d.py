"""Export clean resting places for the runtime diorama.

Run: blender -b --python assets-source/blender/depot-tenang/build_environment_3d.py
"""

from pathlib import Path

import bpy


EXPORTS = Path(__file__).resolve().parent / "exports"
EXPORTS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1)
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.79
    return value


SAND = material("warm sand", (0.68, 0.43, 0.24))
CREAM = material("cream walls", (0.8, 0.68, 0.49))
TERRA = material("terracotta roof", (0.52, 0.2, 0.13))
GOLD = material("honey roof", (0.85, 0.55, 0.14))
TEAL = material("deep teal", (0.05, 0.32, 0.34))
GLASS = material("window glass", (0.34, 0.7, 0.72))
GREEN = material("pine green", (0.25, 0.46, 0.24))
GREEN_LIGHT = material("leaf green", (0.42, 0.61, 0.27))
WOOD = material("wood", (0.42, 0.25, 0.14))


def cube(name, location, scale, paint, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(paint)
    if bevel:
        mod = obj.modifiers.new("soft edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def roof(name, width, depth, eave, ridge, paint):
    half_w = width / 2
    half_d = depth / 2
    verts = [
        (-half_w, -half_d, eave), (half_w, -half_d, eave),
        (-half_w, 0, ridge), (half_w, 0, ridge),
        (-half_w, half_d, eave), (half_w, half_d, eave),
    ]
    faces = [(0, 1, 3, 2), (2, 3, 5, 4), (0, 2, 4), (1, 5, 3), (0, 4, 5, 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(paint)
    mod = obj.modifiers.new("soft edges", "BEVEL")
    mod.width = 0.065
    mod.segments = 2
    obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def window(name, x, y, z):
    cube(name + " frame", (x, y, z), (0.76, 0.09, 0.72), WOOD)
    cube(name + " glass", (x, y - 0.055, z), (0.58, 0.045, 0.55), GLASS, 0.015)
    cube(name + " cross", (x, y - 0.085, z), (0.065, 0.04, 0.55), CREAM, 0)


def export(name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(EXPORTS / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
    )
    bpy.ops.object.delete(use_global=False)


cube("station foundation", (0, 0, 0.1), (5.1, 3.15, 0.2), SAND)
cube("station walls", (0, 0.18, 1.32), (4.4, 2.5, 2.45), TERRA)
cube("station front trim", (0, -1.1, 1.4), (4.55, 0.16, 0.13), CREAM)
cube("station door", (0, -1.15, 0.98), (0.86, 0.11, 1.65), TEAL)
window("station left window", -1.37, -1.18, 1.65)
window("station right window", 1.37, -1.18, 1.65)
roof("station roof", 5.1, 3.2, 2.45, 3.3, GOLD)
cube("station roof ridge", (0, 0, 3.28), (5.3, 0.11, 0.11), SAND)
export("env-station")

cube("garage floor", (0, 0, 0.09), (4.6, 3.35, 0.18), SAND)
cube("garage walls", (0, 0.25, 1.24), (4.1, 2.7, 2.32), CREAM)
cube("garage door frame", (0, -1.18, 1.15), (2.45, 0.18, 2.02), WOOD)
cube("garage door", (0, -1.3, 1.12), (2.15, 0.11, 1.72), TEAL)
for x in [-0.63, 0, 0.63]:
    cube("garage door panel", (x, -1.375, 1.1), (0.045, 0.03, 1.42), GLASS, 0)
roof("garage roof", 4.8, 3.55, 2.34, 3.05, TERRA)
export("env-garage")

cube("hangar foundation", (0, 0, 0.08), (5.65, 3.95, 0.16), SAND)
cube("hangar back wall", (0, 1.55, 1.38), (5.1, 0.32, 2.64), TEAL)
for x in [-2.4, 2.4]:
    cube("hangar side", (x, 0, 1.38), (0.32, 3.3, 2.64), TEAL)
    cube("hangar front post", (x, -1.58, 1.25), (0.42, 0.42, 2.5), GOLD)
cube("hangar opening", (0, 1.31, 1.28), (4.45, 0.03, 2.2), WOOD, 0)
roof("hangar roof", 5.75, 4.05, 2.65, 3.65, GLASS)
export("env-hangar")

bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.19, depth=1.1, location=(0, 0, 0.55))
bpy.context.object.name = "tree trunk"
bpy.context.object.data.materials.append(WOOD)
for name, radius, height, z, paint in [
    ("tree lower branches", 1.02, 1.65, 1.43, GREEN),
    ("tree upper branches", 0.73, 1.42, 2.23, GREEN_LIGHT),
]:
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=0.06, depth=height, location=(0, 0, z))
    bpy.context.object.name = name
    bpy.context.object.data.materials.append(paint)
export("env-tree")
