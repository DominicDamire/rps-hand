"""Build docs/doll.glb from the user's ball-joint doll FBX.

    "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe" -b --python tools/doll/build.py -- <fbx> <out.glb> [tri budget]

What the source actually is (measured, not assumed): 105 separate rigid meshes, no armature, no vertex groups, no skin
weights and no textures, holding THREE copies of the same 35-part set. Only one copy is assembled - the one standing at
y about 2 - and every visible island has a twin about 6 mm larger carrying the "outline" material, an inverted-hull
cartoon outline, so half of the 316k triangles are throwaway.

A ball-joint doll needs no skinning: every part is rigid and every joint is a literal ball, so each part is parented to
a joint node and the joint is rotated. The export is a plain node hierarchy with meshes attached - no skeleton, no
per-vertex work at runtime, and nothing that can tear.

Blender is Z-up with the doll facing +Y; the glTF exporter turns that into Y-up facing -Z, which is what the game wants,
and leaves +X as the doll's own right.
"""
import bpy, bmesh, sys, json, math, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
FBX, OUT = argv[0], argv[1]
TRI_BUDGET = int(argv[2]) if len(argv) > 2 else 55000
TARGET_HEIGHT = 1.75
MIN_TRIS = 160

def log(*a): print("[doll]", *a, flush=True)

def bbox(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return (lo + hi) / 2, lo, hi

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

# ---------------------------------------------------------------- import, keep the assembled copy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=FBX)
allm = [o for o in bpy.data.objects if o.type == "MESH"]
keep = [o for o in allm if 1.80 < bbox(o)[0].y < 2.20]
log("imported", len(allm), "meshes; assembled:", len(keep))
fams = sorted(set(o.name.split(".")[0] for o in keep))
log("families:", len(fams), fams)
assert len(keep) >= 34, f"assembled copy incomplete: {len(keep)}"
assert "waist" in fams, "the assembled waist is missing"
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- drop the outline shell, per object
def drop_outline(o):
    idx = [i for i, s in enumerate(o.material_slots) if s.material and "outline" in s.material.name.lower()]
    if not idx: return 0
    bm = bmesh.new(); bm.from_mesh(o.data)
    gone = [f for f in bm.faces if f.material_index in idx]
    n = len(gone)
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return n

before = sum(tris(o) for o in keep)
for o in keep: drop_outline(o)
after = sum(tris(o) for o in keep)
log(f"outline shell removed: {before} -> {after} triangles")
assert after < before * 0.75, "the outline shell did not come off"

# ---------------------------------------------------------------- one scale/position for the whole doll
# Bake every object's transform straight into its mesh data. bpy.ops.object.transform_apply refuses multi-user data
# and reports nothing useful when it skips an object: it silently left the waist - the only part carrying an object
# level offset, (0, 2, 0) - two metres from the body, and the export faithfully reproduced that.
def bake(o, M):
    # matrix_parent_inverse is a leftover from the FBX import on the parts that carried their position in the object
    # transform. Blender ignores it while an object has no parent; the glTF exporter applies it anyway, which is what
    # put the chest and the waist two metres behind the body in the file while Blender showed them in the right place.
    o.matrix_parent_inverse = Matrix()
    o.data.transform(M @ o.matrix_world.copy())
    o.matrix_world = Matrix()
    o.data.update()

for o in keep: bake(o, Matrix())
bpy.context.view_layer.update()   # without this the next bake reads a stale matrix_world and doubles the offset
lo = Vector((min(bbox(o)[1][i] for o in keep) for i in range(3)))
hi = Vector((max(bbox(o)[2][i] for o in keep) for i in range(3)))
height = hi.z - lo.z
scale = TARGET_HEIGHT / height
log(f"source height {height:.4f} m -> {TARGET_HEIGHT} m (x{scale:.4f})")
mid = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
M = Matrix.Translation(-(mid * scale) - Vector((0, 0, lo.z * scale))) @ Matrix.Scale(scale, 4)
for o in keep: bake(o, M)
bpy.context.view_layer.update()
depth = max(abs(bbox(o)[0].y) for o in keep)
assert depth < 0.5, f"a part is {depth:.2f} m out in depth after baking: the transforms did not take"
lo = Vector((min(bbox(o)[1][i] for o in keep) for i in range(3)))
hi = Vector((max(bbox(o)[2][i] for o in keep) for i in range(3)))
log(f"bbox {tuple(round(v,3) for v in lo)} .. {tuple(round(v,3) for v in hi)}")

# ---------------------------------------------------------------- split into rigid islands, tagged with the family
islands = []
for o in list(keep):
    fam = o.name.split(".")[0]
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.mesh.separate(type="LOOSE")
    for x in [s for s in bpy.context.selected_objects if s.type == "MESH"]:
        c, ilo, ihi = bbox(x)
        islands.append({"o": x, "fam": fam, "c": c, "lo": ilo, "hi": ihi, "size": ihi - ilo, "tris": tris(x)})
log("islands:", len(islands), "triangles:", sum(i["tris"] for i in islands))

SIDED = {"clavicleKnot", "shoulder", "upperArm", "elbow", "foreArm", "forearmKnot", "palm",
         "thumbRoot", "thumbMid", "thumbTip", "thunbKnot", "indexRoot", "inderMid", "indexTip", "indexKnot",
         "middleRoot", "middleMid", "middleTip", "middleKnot", "ringRoot", "ringMid", "ringTip", "ringKnot",
         "pinkyRoot", "pinkyMid", "pinkyTip", "pinkyKnot", "tight", "knee", "calf", "foot"}
for i in islands:
    i["side"] = ("R" if i["c"].x > 0 else "L") if i["fam"] in SIDED else ""

def group(fam, side=""):
    return [i for i in islands if i["fam"] == fam and i["side"] == side]

def centroid(fam, side=""):
    g = group(fam, side)
    assert g, f"no islands for {fam}{side}"
    w = sum(i["tris"] for i in g)
    return Vector((sum(i["c"][k] * i["tris"] for i in g) / w for k in range(3)))

def biggest(fam, side=""):
    return max(group(fam, side), key=lambda i: i["tris"])["c"]

def smallest(fam, side=""):
    return min(group(fam, side), key=lambda i: i["tris"])["c"]

def highest(fam, side=""):
    return max(group(fam, side), key=lambda i: i["c"].z)["c"]

def side_island(fam, side):
    """the island of an unsided family that sits on one side (the chest's shoulder sockets)"""
    g = [i for i in group(fam) if (i["c"].x > 0.01 if side == "R" else i["c"].x < -0.01)]
    assert g, f"no {side} island in {fam}"
    return max(g, key=lambda i: i["tris"])["c"]

def mid(a, b): return (a + b) / 2

def corners(i):
    lo, hi = i["lo"], i["hi"]
    return [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]

def joint_between(famA, famB, side=""):
    """The pivot between two parts of one chain: where their shells actually meet along the chain's own axis.
    The midpoint of their centroids is not it - on a finger that is a centimetre out, which is most of a phalanx, and
    the segments visibly fly apart as they curl."""
    a, b = centroid(famA, side), centroid(famB, side)
    axis = (b - a)
    if axis.length < 1e-6: return mid(a, b)
    axis.normalize()
    endA = max((c - a).dot(axis) for i in group(famA, side) for c in corners(i))
    startB = min((c - a).dot(axis) for i in group(famB, side) for c in corners(i))
    return a + axis * ((endA + startB) / 2)

# ---------------------------------------------------------------- the skeleton: every pivot measured from the parts
def build_bones():
    B = {}
    def add(name, parent, pos): B[name] = {"parent": parent, "pos": Vector(pos)}
    add("Root", None, (0, 0, 0))
    add("Hips", "Root", centroid("hip"))
    add("Waist", "Hips", mid(centroid("hip"), centroid("waist")))
    add("Chest", "Waist", mid(centroid("waist"), centroid("chest")))
    add("Neck", "Chest", highest("chest"))
    add("Head", "Neck", mid(highest("chest"), centroid("head")))
    for S in ("L", "R"):
        add(f"{S}Clavicle", "Chest", side_island("chest", S))
        add(f"{S}UpperArm", f"{S}Clavicle", centroid("shoulder", S))   # the shoulder cap IS the ball the arm turns on
        add(f"{S}Forearm", f"{S}UpperArm", centroid("elbow", S))
        add(f"{S}Hand", f"{S}Forearm", biggest("forearmKnot", S))
        for f, root, midp, tip, knot in (("Thumb", "thumbRoot", "thumbMid", "thumbTip", "thunbKnot"),
                                         ("Index", "indexRoot", "inderMid", "indexTip", "indexKnot"),
                                         ("Middle", "middleRoot", "middleMid", "middleTip", "middleKnot"),
                                         ("Ring", "ringRoot", "ringMid", "ringTip", "ringKnot"),
                                         ("Pinky", "pinkyRoot", "pinkyMid", "pinkyTip", "pinkyKnot")):
            add(f"{S}{f}1", f"{S}Hand", centroid(knot, S))          # the knuckle ball the doll actually has
            add(f"{S}{f}2", f"{S}{f}1", joint_between(root, midp, S))
            add(f"{S}{f}3", f"{S}{f}2", joint_between(midp, tip, S))
        # the hip shell is not sided, so the thigh pivot stays the midpoint of the two centroids
        add(f"{S}Thigh", "Hips", mid(centroid("hip"), biggest("tight", S)))
        add(f"{S}Shin", f"{S}Thigh", centroid("knee", S))
        add(f"{S}Foot", f"{S}Shin", smallest("foot", S))
    return B

BONES = build_bones()
log("bones:", len(BONES))

PART_BONE = {"head": "Head", "chest": "Chest", "waist": "Waist", "hip": "Hips",
             "clavicleKnot": "{S}Clavicle", "shoulder": "{S}UpperArm", "upperArm": "{S}UpperArm",
             "elbow": "{S}Forearm", "foreArm": "{S}Forearm", "forearmKnot": "{S}Hand", "palm": "{S}Hand",
             "thumbRoot": "{S}Thumb1", "thunbKnot": "{S}Thumb1", "thumbMid": "{S}Thumb2", "thumbTip": "{S}Thumb3",
             "indexRoot": "{S}Index1", "indexKnot": "{S}Index1", "inderMid": "{S}Index2", "indexTip": "{S}Index3",
             "middleRoot": "{S}Middle1", "middleKnot": "{S}Middle1", "middleMid": "{S}Middle2", "middleTip": "{S}Middle3",
             "ringRoot": "{S}Ring1", "ringKnot": "{S}Ring1", "ringMid": "{S}Ring2", "ringTip": "{S}Ring3",
             "pinkyRoot": "{S}Pinky1", "pinkyKnot": "{S}Pinky1", "pinkyMid": "{S}Pinky2", "pinkyTip": "{S}Pinky3",
             "tight": "{S}Thigh", "knee": "{S}Shin", "calf": "{S}Shin", "foot": "{S}Foot"}
for i in islands:
    t = PART_BONE.get(i["fam"])
    assert t, f"no bone for part family {i['fam']}"
    i["bone"] = t.replace("{S}", i["side"])
    assert i["bone"] in BONES, f"bone {i['bone']} not in the skeleton"
orphans = [i["fam"] for i in islands if not i.get("bone")]
assert not orphans, orphans

# ---------------------------------------------------------------- decimate to the budget
small = [i for i in islands if i["tris"] <= 600]
large = [i for i in islands if i["tris"] > 600]
room = TRI_BUDGET - sum(i["tris"] for i in small)
ratio = max(0.05, min(1.0, room / max(1, sum(i["tris"] for i in large))))
log(f"decimate: {len(large)} large islands at ratio {ratio:.3f}, {len(small)} small kept whole")
for i in large:
    want = max(MIN_TRIS, int(i["tris"] * ratio))
    m = i["o"].modifiers.new("dec", "DECIMATE"); m.ratio = want / i["tris"]
    bpy.context.view_layer.objects.active = i["o"]
    bpy.ops.object.modifier_apply(modifier=m.name)
    i["tris"] = tris(i["o"])
total = sum(i["tris"] for i in islands)
log("triangles after decimation:", total)

# ---------------------------------------------------------------- one matte material
mat = bpy.data.materials.new("doll")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.86, 0.80, 0.74, 1)
bsdf.inputs["Roughness"].default_value = 0.62
if "Specular IOR Level" in bsdf.inputs: bsdf.inputs["Specular IOR Level"].default_value = 0.25
for i in islands:
    i["o"].data.materials.clear(); i["o"].data.materials.append(mat)
    while i["o"].data.uv_layers:            # no textures anywhere in the source, so UVs are dead weight in the file
        i["o"].data.uv_layers.remove(i["o"].data.uv_layers[0])
    while i["o"].data.color_attributes:
        i["o"].data.color_attributes.remove(i["o"].data.color_attributes[0])

# ---------------------------------------------------------------- flat export; the joint tree is data, not nodes
# The parts are exported unparented, each already in its rest world position, and the joint tree travels beside them in
# the report. The runtime (and the render tool) rebuild the hierarchy by name and re-attach each part keeping its world
# transform, which three.js does in one call. Doing the parenting in Blender instead put one part - the only one with a
# delta transform on it - two metres behind the body in the exported file, twice, in two different ways: glTF has no
# parent-inverse and no delta transform, so there is nothing to be gained by making the exporter guess.
# Rebuild every part as a brand new object holding the same (already world-space) mesh data. The objects that came out
# of the FBX carry leftovers - a parent inverse, delta transforms - that Blender ignores for an unparented object but
# the glTF exporter applies, which is what kept putting the chest and the waist two metres behind the body in the file
# while Blender itself showed them in the right place. A fresh object has none of that.
fresh = []
for n, i in enumerate(islands):
    i["node"] = f"{i['bone']}__{i['fam']}__{n}"
    data = i["o"].data
    old = i["o"]
    o = bpy.data.objects.new(i["node"], data)
    bpy.context.collection.objects.link(o)
    i["o"] = o
    bpy.data.objects.remove(old, do_unlink=True)
    fresh.append(o)
bpy.context.view_layer.update()
stray = [o.name for o in fresh if max(abs(v) for v in o.matrix_world.translation) > 1e-6
         or max(abs(v) for v in o.matrix_parent_inverse.translation) > 1e-6]
assert not stray, f"fresh objects are not clean: {stray[:4]}"
log("rebuilt", len(fresh), "parts as clean objects")

# ---------------------------------------------------------------- report and export
def loc(v): return [round(x, 4) for x in v]
def L(a, b): return (BONES[b]["pos"] - BONES[a]["pos"]).length   # Vector.length is a property in Blender
report = {
    "source": os.path.basename(FBX), "height_m": round(hi.z - lo.z, 4), "target_height_m": TARGET_HEIGHT,
    "triangles": total, "islands": len(islands), "bones": len(BONES),
    "note": "rigid ball-joint parts hung on joint nodes; no skinning. Blender Z-up +Y forward exports as Y-up -Z forward.",
    # the doll is stylised: long legs, a short torso and short arms. The retarget has to scale a real arm into this reach.
    "measure": {"arm_reach": round(L("RUpperArm", "RForearm") + L("RForearm", "RHand"), 4),
                "upper_arm": round(L("RUpperArm", "RForearm"), 4),
                "forearm": round(L("RForearm", "RHand"), 4),
                "leg": round(L("RThigh", "RShin") + L("RShin", "RFoot"), 4),
                "shoulder_width": round(abs(BONES["RUpperArm"]["pos"].x - BONES["LUpperArm"]["pos"].x), 4),
                "shoulder_height": round(BONES["RUpperArm"]["pos"].z, 4),
                "hip_height": round(BONES["Hips"]["pos"].z, 4)},
    "joints": {n: {"parent": b["parent"], "rest": [round(b["pos"].x, 5), round(b["pos"].z, 5), round(-b["pos"].y, 5)]}
               for n, b in BONES.items()},
    "parts": sorted([{"node": i["node"], "family": i["fam"], "side": i["side"], "bone": i["bone"], "tris": i["tris"],
                      "centre": loc(i["c"]), "size": loc(i["size"])} for i in islands],
                    key=lambda d: (d["bone"], -d["tris"])),
}
# where the eyes are: the game pins the rig by them. No face on this doll, so: head centre, at the front of the skull.
hc = centroid("head"); hg = group("head")
hfront = max(i["hi"].y for i in hg)
report["eye"] = [0, round(hc.z + 0.02, 5), round(-(hfront - 0.02), 5)]   # in the GLB frame
json.dump(report, open(os.path.splitext(OUT)[0] + "-report.json", "w"), indent=1)

# Several islands still shared one mesh datablock with each other, and the exporter reuses a shared mesh and puts the
# difference on the node - which is where the stray two-metre translations came from. Give every part its own data.
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = islands[0]["o"]
bpy.ops.object.make_single_user(object=True, obdata=True, material=False, animation=False)
shared = [i["o"].name for i in islands if i["o"].data.users > 1]
log("still shared:", shared or "none")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True,
                          export_yup=True, export_materials="EXPORT", export_cameras=False, export_lights=False)
log("wrote", OUT, os.path.getsize(OUT), "bytes;", total, "triangles;", len(BONES), "joints")
# --- check the file we just wrote, by reading it back ------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=OUT)
ms = [o for o in bpy.data.objects if o.type == "MESH"]
pts = [o.matrix_world @ Vector(c) for o in ms for c in o.bound_box]
rlo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
rhi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
log(f"re-read: {len(ms)} meshes, bbox {tuple(round(v,3) for v in rlo)} .. {tuple(round(v,3) for v in rhi)}")
assert rhi.y - rlo.y < 0.6, f"the exported doll is {rhi.y - rlo.y:.2f} m deep: parts are still stranded"
assert abs((rhi.z - rlo.z) - TARGET_HEIGHT) < 0.02, "height wrong in the exported file"
print("BUILD_OK")
