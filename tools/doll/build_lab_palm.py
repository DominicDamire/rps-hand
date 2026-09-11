"""Build a continuous palm/thenar surface; original doll assets stay untouched."""
import bpy,json,math,os
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(__file__).resolve().parents[2];out=root/'docs/hand-lab'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'docs/doll.glb'))
report=json.loads((root/'docs/doll-report.json').read_text())
C=Matrix.Rotation(math.pi/2,4,'X');Ci=C.inverted()
def rest(n):return Vector(report['joints'][n]['rest'])
def cv(v):return C.to_3x3()@v
def sphere(name,center,axes,radii):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=cv(center))
 obj=bpy.context.object;obj.name=name
 obj.rotation_euler=(C.to_3x3()@Matrix(axes).transposed()).to_euler();obj.scale=radii
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return obj
data={}
originals=list(bpy.context.scene.objects)
for side in ['R','L']:
 wrist=rest(side+'Hand');palm=rest(side+'Middle1')-wrist;y=palm.normalized()
 x=(rest(side+'Index1')-rest(side+'Pinky1'));x=(x-y*x.dot(y)).normalized();normal=x.cross(y).normalized()
 cmc=rest(side+'Thumb1');end=rest(side+'Thumb2')+y*.004
 inside=wrist+y*(cmc-wrist).dot(y);base=inside-y*.008
 axis=(end-base).normalized();wide=normal.cross(axis).normalized();depth=axis.cross(wide).normalized();length=(end-base).length
 rings=[(0,.010,.006),(.15,.014,.007),(.35,.014,.008),(.55,.012,.008),(.75,.010,.007),(.92,.008,.007),(1.06,.007,.007),(1.12,.001,.001)]
 verts=[];faces=[];count=32
 for t,w,d in rings:
  for j in range(count):
   a=j/count*math.tau;verts.append(cv(base+axis*(length*t)+wide*(math.cos(a)*w)+depth*(math.sin(a)*d)))
 for r in range(len(rings)-1):
  for j in range(count):a=r*count+j;b=r*count+(j+1)%count;faces.append((a,b,b+count,a+count))
 faces.append(tuple(reversed(range(count))));faces.append(tuple((len(rings)-1)*count+j for j in range(count)))
 mesh=bpy.data.meshes.new(side+' thenar');mesh.from_pydata(verts,[],faces);mesh.update()
 mound=bpy.data.objects.new(side+' thenar',mesh);bpy.context.collection.objects.link(mound)
 heel=sphere(side+' filled thumb socket',cmc.lerp(inside,.35),(x,y,normal),(.012,.015,.008))
 parts=[o for o in originals if o.type=='MESH' and o.name.startswith(side+'Hand__')]
 assert parts
 copies=[]
 for obj in parts:
  cp=obj.copy();cp.data=obj.data.copy();bpy.context.collection.objects.link(cp);world=obj.matrix_world.copy();cp.parent=None;cp.matrix_world=world;copies.append(cp)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in copies+[mound,heel]:obj.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=side+' Continuous palm'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 obj.data.remesh_voxel_size=.0008;bpy.ops.object.voxel_remesh()
 mod=obj.modifiers.new('Blend palm surface','SMOOTH');mod.factor=1.1;mod.iterations=5;bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.data.calc_loop_triangles();ratio=min(1,2600/max(1,len(obj.data.loop_triangles)));mod=obj.modifiers.new('Realtime topology','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.data.calc_loop_triangles()
 positions=[];weights=[]
 for v in obj.data.vertices:
  point=Ci.to_3x3()@(obj.matrix_world@v.co);positions.extend(round(a,6) for a in point-wrist)
  # Only the thumb-side surface follows the MCP; the heel remains anchored.
  dist=(point-end).length;t=max(0,min(1,(.035-dist)/.023));weights.append(round(t*t*(3-2*t),5))
 indices=[int(i) for face in obj.data.loop_triangles for i in face.vertices]
 data[side]={'position':positions,'index':indices,'weight':weights,'bindMCP':list(end-wrist),'triangles':len(indices)//3}
 for poly in obj.data.polygons:poly.use_smooth=True
 for old in parts:old.hide_set(True);old.hide_render=True
for obj in originals:
 if not obj.name.startswith(('RHand','RThumb','RIndex','RMiddle','RRing','RPinky')):obj.hide_set(True)
for obj in bpy.context.scene.objects:
 if obj.name.startswith('L Continuous'):obj.hide_set(True)
out.mkdir(exist_ok=True)
(out/'palm-shape.json').write_text(json.dumps(data,separators=(',',':')))
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   space=area.spaces.active;space.region_3d.view_location=cv(rest('RHand')+(rest('RMiddle1')-rest('RHand'))*.75);space.region_3d.view_distance=.3;space.clip_start=.001
   direction=cv((rest('RIndex1')-rest('RHand')).cross(rest('RPinky1')-rest('RHand')).normalized())
   space.region_3d.view_rotation=(-direction).to_track_quat('-Z','Y')
bpy.ops.wm.save_as_mainfile(filepath=str(root.parent/'hand-palm-editable.blend'))
print('PALM_MESH_BUILT',[(s,v['triangles']) for s,v in data.items()])
