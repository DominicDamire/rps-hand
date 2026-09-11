"""Build docs/doll.glb from the user's ball-joint doll FBX.

    "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" -b --python tools/doll/build.py -- <fbx> <out.glb>

What the source actually is (measured, not assumed): 105 separate rigid meshes, no armature, no vertex groups, no skin
weights and no textures, holding THREE copies of the same 35-part set. Only the ".001" copy is assembled (the waist is
the exception: its assembled piece is "waist.002"). Every visible island has a twin about 6 mm larger carrying the
"outline" material - an inverted-hull cartoon outline - so half of the 316k triangles are throwaway.

A ball-joint doll needs no skinning: every part is rigid and every joint is a literal ball, so each part is parented to
a joint node and the joint is rotated. The export is therefore a plain node hierarchy with meshes attached, which three
handles without a skeleton and without per-vertex work.

Blender is Z-up with the doll facing +Y; the glTF exporter turns that into Y-up facing -Z, which is what the game wants,
and leaves +X as the doll's own right.
"""
import bpy, bmesh, sys, json, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
FBX, OUT = argv[0], argv[1]
TRI_BUDGET = int(argv[2]) if len(argv) > 2 else 55000
TARGET_HEIGHT = 1.75          # metres, a person's height; the source doll is 1.619
MIN_TRIS = 180                # never decimate an island below this

def log(*a): print("[doll]", *a)

# ---------------------------------------------------------------- import and keep the assembled copy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
log("imported", len(meshes), "meshes")

def centre(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return (lo + hi) / 2, lo, hi

# the assembled doll sits at y ~ 2; every other copy is elsewhere
keep = []
for o in meshes:
    c, _, _ = centre(o)
    if 1.80 < c.y < 2.20:
        keep.append(o)
log("assembled parts:", len(keep), sorted(set(o.name for o in keep)))
assert len(keep) >= 34, f"expected the whole assembled doll, found {len(keep)}"

for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- one object, no outline shell
bpy.ops.object.select_all(action="DESELECT")
for o in keep: o.select_set(True)
bpy.context.view_layer.objects.active = keep[0]
bpy.ops.object.join()
doll = bpy.context.view_layer.objects.active
doll.name = "doll"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
before = len(doll.data.polygons)

outline = [i for i, s in enumerate(doll.material_slots) if s.material and "outline" in s.material.name.lower()]
log("material slots:", [s.material.name if s.material else None for s in doll.material_slots], "outline:", outline)
if outline:
    bm = bmesh.new(); bm.from_mesh(doll.data)
    gone = [f for f in bm.faces if f.material_index in outline]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bm.to_mesh(doll.data); bm.free()
    doll.data.update()
    bpy.ops.object.select_all(action="DESELECT"); doll.select_set(True)
    bpy.context.view_layer.objects.active = doll
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose(); bpy.ops.object.mode_set(mode="OBJECT")
log("faces", before, "->", len(doll.data.polygons), "after dropping the outline shell")

# ---------------------------------------------------------------- scale, centre, and face the right way
c, lo, hi = centre(doll)
height = hi.z - lo.z
scale = TARGET_HEIGHT / height
log(f"height {height:.3f} m -> {TARGET_HEIGHT} m (x{scale:.4f})")
doll.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(scale=True)
c, lo, hi = centre(doll)
# origin at the floor, centred left-right and front-back on the hips
doll.location = (-c.x, -c.y, -lo.z)
bpy.ops.object.transform_apply(location=True)
c, lo, hi = centre(doll)
log(f"bbox now {tuple(round(v,3) for v in lo)} .. {tuple(round(v,3) for v in hi)}")

# ---------------------------------------------------------------- split into rigid islands
bpy.ops.object.select_all(action="DESELECT"); doll.select_set(True)
bpy.context.view_layer.objects.active = doll
bpy.ops.mesh.separate(type="LOOSE")
islands = [o for o in bpy.context.selected_objects if o.type == "MESH"]
log("islands:", len(islands), "tris:", sum(len(p.vertices) - 2 for p in o.data.polygons) for_ := 0) if False else None
total_tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in islands)
log("islands:", len(islands), "tris:", total_tris)

info = []
for o in islands:
    ic, ilo, ihi = centre(o)
    info.append({"o": o, "c": ic, "lo": ilo, "hi": ihi,
                 "tris": sum(len(p.vertices) - 2 for p in o.data.polygons)})

# ---------------------------------------------------------------- the skeleton, measured from the parts themselves
# Every joint is placed at the centre of the ball that turns there, found from the islands around that height.
def pick(pred):
    got = [i for i in info if pred(i)]
    assert got, "no island matched"
    return got

zs = sorted(i["c"].z for i in info)
top = max(i["hi"].z for i in info)

def cluster(side, zlo, zhi, xlo=0.0, xhi=9.0):
    """centroid of the islands on one side within a height band"""
    got = [i for i in info if zlo <= i["c"].z <= zhi and xlo <= abs(i["c"].x) <= xhi and (i["c"].x * side > 0 or side == 0)]
    if not got: return None
    n = len(got)
    return Vector((sum(i["c"].x for i in got) / n, sum(i["c"].y for i in got) / n, sum(i["c"].z for i in got) / n))

print("ISLAND_TABLE_START")
print(json.dumps(sorted([{"tris": i["tris"], "c": [round(v, 4) for v in i["c"]],
                          "size": [round(v, 4) for v in (i["hi"] - i["lo"])]} for i in info],
                        key=lambda d: (-d["c"][2], d["c"][0]))))
