// Skinned upper-body mannequin (upper-body.glb, 11 bones, eyes at the origin, +y up, face toward -z).
// Ported from origin/hand-rig-workflow mirror/avatar/RiggedAvatar.js. Changes for rps_hand: the parent object is
// given (index.html puts it under a group that turns it to face +z and mirrors it with the hands, so all bone maths is
// done in the object's own frame, never in world space, and survives a mirrored parent), the eye position is passed
// explicitly instead of being read from a camera (in the mirror view the render camera is the phone, not the player),
// and playerCamera can be swapped per view (the head is hidden only for that camera).
// Joints and the eye are in the AVATAR frame: x = the user's right, y up, z toward the user's back, metres; joints are
// relative to the eye (decision D3: anatomical proportions kept, wrists handed off to the hand tracker by the caller).
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const V=a=>new T.Vector3().fromArray(a);
const identity=new T.Quaternion();

// All joint translations stay in their bind pose. Tracking rotates bones only.
export class RiggedAvatar {
  constructor(parent,playerCamera=null,status=null,url=new URL('./upper-body.glb',import.meta.url).href){
    this.object=new T.Group();parent.add(this.object);this.bones={};this.bind={};this.meshes=[];
    this.playerCamera=playerCamera;this.bodyVisible=true;this.loaded=false;
    this.ready=new GLTFLoader().loadAsync(url).then(gltf=>{
      // Bind frames are captured with the rig detached, i.e. in the object's own frame (the parent may be rotated).
      this.root=gltf.scene;this.root.updateMatrixWorld(true);
      this.root.traverse(o=>{
        if(o.isBone){this.bones[o.name]=o;this.bind[o.name]={q:o.getWorldQuaternion(new T.Quaternion()),p:o.getWorldPosition(new T.Vector3()),local:o.quaternion.clone()};}
        if(o.isSkinnedMesh){
          this.meshes.push(o);o.frustumCulled=false;o.castShadow=true;o.receiveShadow=false;
          const positions=o.geometry.attributes.position,mask=new Float32Array(positions.count);
          for(let i=0;i<mask.length;i++)mask[i]=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld).y>-.145?1:0;
          o.geometry.setAttribute('headMask',new T.BufferAttribute(mask,1));
          const uniforms={hideHead:{value:0},hideBody:{value:0}};
          o.material.onBeforeCompile=shader=>{
            Object.assign(shader.uniforms,uniforms);
            shader.vertexShader='attribute float headMask; varying float vHeadMask;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeadMask=headMask;');
            shader.fragmentShader='uniform float hideHead; uniform float hideBody; varying float vHeadMask;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif ((hideHead>.5 && vHeadMask>.5)||(hideBody>.5 && vHeadMask<.5)) discard;');
          };
          o.material.customProgramCacheKey=()=> 'connected-avatar-v1';
          o.onBeforeRender=(renderer,world,camera)=>{uniforms.hideHead.value=this.playerCamera&&camera===this.playerCamera?1:0;uniforms.hideBody.value=this.bodyVisible?0:1;o.material.uniformsNeedUpdate=true;};
        }
      });
      this.eyeLocal=this.bones.Head.worldToLocal(new T.Vector3());
      this.object.add(this.root);this.object.updateMatrixWorld(true);
      this.loaded=true;if(status)status.textContent='Connected upper-body rig · 11 bones';
      return this;
    }).catch(e=>{if(status)status.textContent='Avatar could not load: '+e.message;throw e;});
  }
  // A node's frame relative to the rig root (proper rotation + translation even under a mirrored ancestor).
  rel(o){return this._rootInv.clone().multiply(o.matrixWorld);}
  frameQ(o){const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();this.rel(o).decompose(p,q,s);return q;}
  frameP(o){return new T.Vector3().setFromMatrixPosition(this.rel(o));}
  rotate(name,delta){
    const bone=this.bones[name];
    const parent=this.frameQ(bone.parent).invert();
    bone.quaternion.copy(parent.multiply(delta.clone().multiply(this.bind[name].q)));
    bone.updateMatrixWorld(true);
  }
  arm(side,joints,eye,bodyRotation){
    const key=side.toLowerCase(),wrist=joints?.[key+'Wrist'];
    if(!wrist)return;
    // no tracked elbow (hand seen, shoulders not): guide the bend below and behind the wrist, a raised forearm
    const elbow=joints?.[key+'Elbow']??[wrist[0],wrist[1]-.2,wrist[2]+.15];
    const upper=side+'UpperArm',fore=side+'Forearm';
    const start=this.frameP(this.bones[upper]);
    const a=this.bind[fore].p.clone().sub(this.bind[upper].p);
    const b=V([side==='Left'?-.145:.145,-.195,-.025]);
    const target=V(wrist).add(eye),guide=V(elbow).add(eye).sub(start);
    const direction=target.clone().sub(start),distance=T.MathUtils.clamp(direction.length(),Math.abs(a.length()-b.length())+.001,a.length()+b.length()-.001);
    if(direction.lengthSq()<1e-10)return;
    direction.normalize();guide.addScaledVector(direction,-guide.dot(direction));
    if(guide.lengthSq()<1e-8){guide.set(0,0,-1).applyQuaternion(bodyRotation);guide.addScaledVector(direction,-guide.dot(direction));}
    if(guide.lengthSq()<1e-8)guide.set(1,0,0).addScaledVector(direction,-direction.x);
    guide.normalize();
    const along=(a.lengthSq()-b.lengthSq()+distance*distance)/(2*distance);
    const bend=start.clone().addScaledVector(direction,along).addScaledVector(guide,Math.sqrt(Math.max(0,a.lengthSq()-along*along)));
    const end=start.clone().addScaledVector(direction,distance);
    this.rotate(upper,new T.Quaternion().setFromUnitVectors(a.normalize(),bend.clone().sub(start).normalize()));
    this.rotate(fore,new T.Quaternion().setFromUnitVectors(b.normalize(),end.sub(bend).normalize()));
  }
  // eye: THREE.Vector3 in the avatar frame (the parent's local space); head: {physicalYaw, physicalPitch} (radians,
  // relative to the calibrated centre; a branch-style {pose:{...}} is accepted too); joints: eye-relative arrays or null.
  update(eye,head,joints,bodyVisible=true){
    if(!this.loaded)return;this.bodyVisible=bodyVisible;
    this.object.position.set(0,0,0);
    for(const [name,bone] of Object.entries(this.bones))bone.quaternion.copy(this.bind[name].local);
    this.object.updateMatrixWorld(true);this._rootInv=this.root.matrixWorld.clone().invert();
    const bodyRotation=new T.Quaternion();
    if(joints?.leftShoulder&&joints?.rightShoulder&&joints?.leftHip&&joints?.rightHip){
      const x=V(joints.rightShoulder).sub(V(joints.leftShoulder)).normalize();
      const y=V(joints.leftShoulder).add(V(joints.rightShoulder)).sub(V(joints.leftHip)).sub(V(joints.rightHip)).normalize();
      const z=new T.Vector3().crossVectors(x,y).normalize();x.crossVectors(y,z).normalize();
      if(z.lengthSq()>.5){bodyRotation.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));const angle=identity.angleTo(bodyRotation);if(angle>.7)bodyRotation.slerp(identity,1-.7/angle);}
    }
    this.rotate('Spine',identity.clone().slerp(bodyRotation,.4));this.rotate('Chest',bodyRotation);
    const headRotation=new T.Quaternion().setFromEuler(new T.Euler(head?.physicalPitch??head?.pose?.physicalPitch??0,head?.physicalYaw??head?.pose?.physicalYaw??0,0,'YXZ'));
    this.rotate('Neck',bodyRotation.clone().slerp(headRotation,.5));this.rotate('Head',headRotation);
    // Move the entire skeleton so its eyes follow the player. Never stretch a neck. Everything below is in the rig's
    // own frame, where the eyes sit at eyeL; the object translation puts eyeL onto the requested eye.
    const eyeL=this.eyePoint();
    this.object.position.copy(eye).sub(eyeL);
    for(const side of ['Left','Right']){
      const shoulder=joints?.[side.toLowerCase()+'Shoulder'];
      if(shoulder){
        const name=side+'Clavicle',start=this.frameP(this.bones[name]);
        const rest=this.bind[side+'UpperArm'].p.clone().sub(this.bind[name].p).normalize();
        const target=V(shoulder).add(eyeL).sub(start).normalize();
        const swing=new T.Quaternion().setFromUnitVectors(rest.clone().applyQuaternion(bodyRotation),target);
        const angle=identity.angleTo(swing);if(angle>.25)swing.slerp(identity,1-.25/angle);
        this.rotate(name,swing.multiply(bodyRotation));
      }
      this.arm(side,joints,eyeL,bodyRotation);
    }
    this.object.updateMatrixWorld(true);
  }
  // Eye point relative to the rig root as it was when _rootInv was taken: inside update() that is the rig's own frame;
  // after update() (world matrices refreshed with the translation) it is the parent's frame, i.e. it equals `eye`.
  eyePoint(){return this.frameP(this.bones.Head).add(this.eyeLocal.clone().applyQuaternion(this.frameQ(this.bones.Head)));}
}
