"""Render actual browser-exported joint transforms in Blender, without re-solving the pose.
blender -b --python tools/doll/verify_hand_attachments.py -- docs/doll.glb poses.json output_dir
"""
import bpy, sys, json, os, math
from mathutils import Matrix, Vector
args=sys.argv[sys.argv.index('--')+1:];glb,poses_file,out=args
glb=os.path.abspath(glb);poses_file=os.path.abspath(poses_file);out=os.path.abspath(out)
os.makedirs(out,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(glb))
rep=json.load(open(glb.replace('.glb','-report.json')));poses=json.load(open(poses_file))
C=Matrix.Rotation(math.pi/2,4,'X');Ci=C.inverted()
def mat(values):return Matrix([[values[col*4+row] for col in range(4)] for row in range(4)])
def point(values):return C.to_3x3()@Vector(values)
joints={}
for name in rep['joints']:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);joints[name]=o
for name,j in rep['joints'].items():
 o=joints[name];parent=j['parent'];o.parent=joints.get(parent);o.location=point(j['rest'])-(point(rep['joints'][parent]['rest']) if parent else Vector())
bpy.context.view_layer.update()
count=0
for o in list(bpy.data.objects):
 if o.type!='MESH':continue
 bone=o.name.split('__')[0]
 if bone not in joints:continue
 world=o.matrix_world.copy();o.parent=joints[bone];o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=joints[bone].matrix_world.inverted()@world
 o.hide_render=not bone.startswith(('RHand','RThumb','RIndex','RMiddle','RRing','RPinky'))
 count+=1
assert count==len(rep['parts']),(count,len(rep['parts']))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.1,.14,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.view_settings.view_transform='AgX'
cam=bpy.data.objects.new('Hand inspection',bpy.data.cameras.new('Hand inspection'));bpy.context.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=.34
for n,pos,power,size in [('Key',(2,-3,4),180,3),('Fill',(-3,1,3),100,3)]:
 light=bpy.data.objects.new(n,bpy.data.lights.new(n,'AREA'));bpy.context.collection.objects.link(light);light.data.energy=power;light.data.shape='DISK';light.data.size=size
 light.location=pos
metrics=[]
for idx,pose in enumerate(poses):
 frame=1+idx*20;scene.frame_set(frame)
 for name,values in pose['joints'].items():
  M=mat(values)
  if rep['joints'][name]['parent'] is None:M=mat(pose['root'])@M
  o=joints[name];o.rotation_mode='QUATERNION';o.matrix_basis=C@M@Ci
  o.keyframe_insert(data_path='location',frame=frame);o.keyframe_insert(data_path='rotation_quaternion',frame=frame);o.keyframe_insert(data_path='scale',frame=frame)
 bpy.context.view_layer.update()
 # Local attachment offsets and scales must be unchanged by posing.
 max_shift=0;max_scale=0
 for name,o in joints.items():
  if not name.startswith(('RThumb','RIndex','RMiddle','RRing','RPinky','LThumb','LIndex','LMiddle','LRing','LPinky')):continue
  parent=rep['joints'][name]['parent'];expected=point(rep['joints'][name]['rest'])-point(rep['joints'][parent]['rest'])
  max_shift=max(max_shift,(o.location-expected).length);max_scale=max(max_scale,max(abs(v-1) for v in o.scale))
 assert max_shift<1e-6 and max_scale<1e-5,(pose['pose'],max_shift,max_scale)
 metrics.append(dict(pose=pose['pose'],max_attachment_shift_mm=max_shift*1000,max_scale_error=max_scale))
 side=pose.get('side','R')
 for obj in bpy.data.objects:
  if obj.type=='MESH':obj.hide_render=not obj.name.startswith(tuple(side+n for n in ['Hand','Thumb','Index','Middle','Ring','Pinky']))
 wrist=joints[side+'Hand'].matrix_world.translation;i=joints[side+'Index1'].matrix_world.translation;p=joints[side+'Pinky1'].matrix_world.translation
 normal=(i-wrist).cross(p-wrist).normalized();forward=((i+p)*.5-wrist).normalized();centre=wrist+forward*.09
 for view in ['palm','oblique']:
  direction=normal if view=='palm' else (normal+forward*.3+normal.cross(forward)*.65).normalized()
  cam.location=centre+direction*.8;cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
  for n in ['Key','Fill']:
   l=bpy.data.objects[n];l.location=centre+direction*1.2+Vector((-.6 if n=='Fill' else .6,0,1));l.rotation_euler=(centre-l.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=os.path.join(out,pose['pose']+'_'+view+'.png');bpy.ops.render.render(write_still=True)
scene.frame_end=1+(len(poses)-1)*20;scene.frame_set(1)
bpy.context.view_layer.update()
for obj in bpy.data.objects:
 if obj.type=='MESH':obj.hide_render=not obj.name.startswith(('RHand','RThumb','RIndex','RMiddle','RRing','RPinky'))
w=bpy.data.objects['RHand'].matrix_world.translation;i=bpy.data.objects['RIndex1'].matrix_world.translation;p=bpy.data.objects['RPinky1'].matrix_world.translation
n=(i-w).cross(p-w).normalized();f=((i+p)*.5-w).normalized();c=w+f*.09
scene.camera.location=c+n*.8;scene.camera.rotation_euler=(c-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(out,'hand-attachments.blend')))
json.dump(metrics,open(os.path.join(out,'attachment-metrics.json'),'w'),indent=2)
print('ATTACHMENT_CHECK_PASS',json.dumps(metrics))
