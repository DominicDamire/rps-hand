"""Render the built doll for inspection: rest pose from the front, the side and straight down, plus test poses.

    blender -b --python tools/doll/render.py -- docs/doll.glb <out_dir> [pose ...]

A hero angle hides overlap and scale errors, so the orthographic top view is always rendered.
"""
import bpy, sys, os, math, json
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = argv[0], argv[1]
WANT = argv[2:] or ["rest", "elbows", "forward", "head", "fist", "seated"]
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scene = bpy.context.scene
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try: scene.render.engine = eng; break
    except Exception: pass
print("[render] engine", scene.render.engine)
scene.render.film_transparent = False
scene.render.resolution_x, scene.render.resolution_y = 700, 1000
scene.render.image_settings.file_format = "PNG"
world = bpy.data.worlds.new("w"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.09, 0.10, 0.12, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 4.0; key.rotation_euler = Euler((math.radians(58), 0, math.radians(35)))
bpy.context.collection.objects.link(key)
fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "SUN"))
fill.data.energy = 1.6; fill.rotation_euler = Euler((math.radians(70), 0, math.radians(-120)))
bpy.context.collection.objects.link(fill)

# The GLB holds the parts flat, each already in its rest place, and the joint tree travels beside it in the report.
# Build the hierarchy here exactly the way the runtime does: joints as empties, each part re-attached to its joint
# keeping its world transform.
REPORT = json.load(open(os.path.splitext(GLB)[0] + "-report.json"))
J = REPORT["joints"]
def to_blender(r):           # the report is in the GLB frame (Y up, -Z forward)
    return Vector((r[0], -r[2], r[1]))
joints = {}
for name in J:
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.03
    bpy.context.collection.objects.link(e); joints[name] = e
for name, j in J.items():
    p = j["parent"]
    joints[name].location = to_blender(j["rest"]) - (to_blender(J[p]["rest"]) if p else Vector())
    if p: joints[name].parent = joints[p]
bpy.context.view_layer.update()
attached = 0
for o in [x for x in bpy.data.objects if x.type == "MESH"]:
    bone = o.name.split("__")[0]
    if bone not in joints: continue
    w = o.matrix_world.copy(); o.parent = joints[bone]; o.matrix_parent_inverse = joints[bone].matrix_world.inverted()
    o.matrix_world = w; attached += 1
bpy.context.view_layer.update()
print(f"[render] {len(joints)} joints, {attached} parts attached")
assert attached == len(REPORT["parts"]), f"attached {attached} of {len(REPORT['parts'])}"

nodes = {o.name: o for o in bpy.data.objects}
def N(name):
    o = nodes.get(name)
    assert o, f"node {name} missing: have {sorted(joints)[:12]}..."
    return o

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
lo = Vector((min((o.matrix_world @ Vector(c)).x for o in meshes for c in o.bound_box),
             min((o.matrix_world @ Vector(c)).y for o in meshes for c in o.bound_box),
             min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)))
hi = Vector((max((o.matrix_world @ Vector(c)).x for o in meshes for c in o.bound_box),
             max((o.matrix_world @ Vector(c)).y for o in meshes for c in o.bound_box),
             max((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)))
mid = (lo + hi) / 2
H = hi.z - lo.z
print(f"[render] {len(meshes)} meshes, bbox {tuple(round(v,3) for v in lo)} .. {tuple(round(v,3) for v in hi)}, height {H:.3f}")

cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data); bpy.context.collection.objects.link(cam); scene.camera = cam

def shot(name, loc, rot, ortho, res=(700, 1000)):
    cam.location = loc; cam.rotation_euler = Euler(rot); cam_data.ortho_scale = ortho
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("[render]", scene.render.filepath)

def views(tag):
    shot(f"{tag}_front", (mid.x, mid.y - 4, mid.z), (math.radians(90), 0, 0), H * 1.15)
    shot(f"{tag}_side",  (mid.x + 4, mid.y, mid.z), (math.radians(90), 0, math.radians(90)), H * 1.15)
    shot(f"{tag}_top",   (mid.x, mid.y, hi.z + 3),  (0, 0, 0), max(hi.x - lo.x, hi.y - lo.y) * 1.6, (900, 900))
    shot(f"{tag}_three", (mid.x + 2.2, mid.y - 2.6, mid.z + 0.55), (math.radians(78), 0, math.radians(40)), H * 1.2)

def rot(name, x=0, y=0, z=0):
    o = N(name)
    o.rotation_mode = "XYZ"
    o.rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))

REST = {o.name: (o.rotation_mode, o.rotation_euler.copy(), o.rotation_quaternion.copy()) for o in bpy.data.objects}
def clear():
    # restore exactly what the file had: the importer puts a Y-up correction on some nodes, and zeroing those
    # tips the whole doll over or scatters it.
    for o in bpy.data.objects:
        m, e, q = REST[o.name]
        o.rotation_mode = m; o.rotation_euler = e; o.rotation_quaternion = q
    bpy.context.view_layer.update()

POSES = {
    "rest": lambda: None,
    # the forearm swings back about the elbow: in Blender Z-up with the doll facing +Y, that is a rotation about X
    "elbows": lambda: [rot("LForearm", x=-90), rot("RForearm", x=-90)],
    "forward": lambda: [rot("LUpperArm", x=-80), rot("RUpperArm", x=-80), rot("LForearm", x=-20), rot("RForearm", x=-20)],
    "head": lambda: [rot("Neck", z=25), rot("Head", z=25, x=-20)],
    "fist": lambda: [rot(f"{S}{f}{j}", x=-{1: 70, 2: 80, 3: 55}[j]) for S in "LR" for f in ("Index", "Middle", "Ring", "Pinky") for j in (1, 2, 3)],
    "seated": lambda: [rot("LThigh", x=-85), rot("RThigh", x=-85), rot("LShin", x=80), rot("RShin", x=80), rot("Waist", x=6)],
}
for tag in WANT:
    clear(); POSES[tag]()
    bpy.context.view_layer.update()
    views(tag)
print("RENDER_OK")
