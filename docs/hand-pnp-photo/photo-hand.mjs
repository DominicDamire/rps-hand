import * as T from 'three';
import {buildTips} from './contact.mjs?v=photo1';
// Pixel centres read from the user's first landmark screenshot, not a metric 3D scan.
export const PHOTO_POINTS=[[401,838],[340.8,819.6],[292.8,771.8],[260,725.8],[225.2,694.4],[316.8,690],[296.4,628.2],[286.4,585.2],[279.5,547.5],[354.2,678.4],[338.5,609.5],[329.5,561.5],[323.5,519.5],[391.5,683],[388.4,617.2],[384.4,572.2],[379,533.2],[430.4,699.2],[438.6,648.2],[442.6,612.8],[443,578]];
const fingers=['Thumb','Index','Middle','Ring','Pinky'];
export function fitPhotoHand(rig){
 const oldTips=buildTips(rig),old={};for(const [n,r]of Object.entries(rig.rest))old[n]=r.world.clone();
 rig.root.updateMatrixWorld(true);
 const snapshots=new Map();for(const m of rig.parts){if(!/^[RL](Hand|Thumb|Index|Middle|Ring|Pinky)/.test(m.name))continue;const a=m.geometry.attributes.position;snapshots.set(m,Array.from({length:a.count},(_,i)=>new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld)));}
 const targets={},report={},allTargets={};let rightAnchor=null,rightTargets=null;
 for(const s of ['R','L']){
  const wrist=old[s+'Hand'],middle=old[s+'Middle1'],along=middle.clone().sub(wrist).normalize();
  const across=old[s+'Index1'].clone().sub(old[s+'Pinky1']);across.addScaledVector(along,-across.dot(along)).normalize();const normal=new T.Vector3().crossVectors(across,along).normalize();
  const palms=[...snapshots.keys()].filter(m=>m.name.startsWith(s+'Hand__palm')).sort((a,b)=>new T.Box3().setFromPoints(snapshots.get(b)).getSize(new T.Vector3()).length()-new T.Box3().setFromPoints(snapshots.get(a)).getSize(new T.Vector3()).length());
  if(!palms.length)throw Error('Missing outer palm geometry');
  const verts=snapshots.get(palms[0]),sorted=verts.map(p=>({p,d:p.clone().sub(wrist).dot(along)})).sort((a,b)=>a.d-b.d),cut=sorted[0].d+.003;
  const bottom=sorted.filter(p=>p.d<=cut),anchor=bottom.reduce((v,r)=>v.add(r.p),new T.Vector3()).divideScalar(bottom.length);
  // Both hands share the same mirrored anchor and dimensions.
  if(s==='R')rightAnchor=anchor.clone();else anchor.copy(rightAnchor).setX(-rightAnchor.x);
  const length=middle.clone().sub(anchor).dot(along),uv=PHOTO_POINTS.map(([x,y])=>new T.Vector2(x-PHOTO_POINTS[0][0],PHOTO_POINTS[0][1]-y));
  const ey=uv[9].clone().normalize(),ex=new T.Vector2(-ey.y,ey.x),pixels=uv[9].length(),points=[];
  for(let i=0;i<21;i++){
   const f=Math.floor((i-1)/4),k=(i-1)%4+1,name=i===0?s+'Hand':s+fingers[f]+Math.min(k,3);
   const oldPoint=i===0?anchor:k<4?old[name]:old[s+fingers[f]+'3'].clone().add(oldTips[s+fingers[f]]);
   const depth=oldPoint.clone().sub(anchor).dot(normal);
   points.push(anchor.clone().addScaledVector(across,uv[i].dot(ex)*length/pixels).addScaledVector(along,uv[i].dot(ey)*length/pixels).addScaledVector(normal,i===0?0:depth));
  }
  if(s==='R')rightTargets=points.map(p=>p.clone());else for(let i=0;i<21;i++)points[i].copy(rightTargets[i]).setX(-rightTargets[i].x);
  allTargets[s]=points;targets[s+'Hand']=points[0];
  for(let f=0;f<5;f++)for(let k=1;k<=3;k++)targets[s+fingers[f]+k]=points[1+4*f+k-1];
  report[s]={wristAnchorShiftMm:anchor.distanceTo(wrist)*1000,points:points.map(p=>p.toArray()),metresPerPixel:length/pixels,oldWrist:wrist.toArray(),cameraRight:across.clone().multiplyScalar(ex.x).addScaledVector(along,ey.x).toArray(),cameraUp:across.clone().multiplyScalar(ex.y).addScaledVector(along,ey.y).toArray()};
  // Deform only the outer palm once. Mechanical wrist hardware stays at its original rest location.
  const from=[anchor,...fingers.map(f=>old[s+f+'1'])],to=[points[0],...fingers.map((f,i)=>points[1+4*i])];
  for(const [m,vertices]of snapshots){if(!m.name.startsWith(s))continue;
   if(m.name.startsWith(s+'Hand__palm'))for(const v of vertices){let nearest=-1;const weights=from.map((p,i)=>{const d=v.distanceToSquared(p);if(d<1e-12)nearest=i;return 1/Math.max(1e-12,d*d);});const sum=weights.reduce((a,b)=>a+b,0),delta=new T.Vector3();for(let i=0;i<from.length;i++)delta.addScaledVector(to[i].clone().sub(from[i]),nearest>=0?Number(i===nearest):weights[i]/sum);v.add(delta);}
   else if(!m.name.startsWith(s+'Hand')){
    const match=m.name.match(/^[RL](Thumb|Index|Middle|Ring|Pinky)([123])__/);if(!match)continue;
    const f=fingers.indexOf(match[1]),k=+match[2],a=old[s+match[1]+k],b=k<3?old[s+match[1]+(k+1)]:a.clone().add(oldTips[s+match[1]]),newA=points[1+4*f+k-1],newB=points[1+4*f+k];
    const axis=b.clone().sub(a),oldLength=axis.length();axis.normalize();const next=newB.clone().sub(newA),ratio=next.length()/oldLength,rotation=new T.Quaternion().setFromUnitVectors(axis,next.normalize());
    for(const v of vertices){v.sub(a);v.addScaledVector(axis,v.dot(axis)*(ratio-1)).applyQuaternion(rotation).add(newA);}
   }
  }
 }
 for(const [n,p]of Object.entries(targets))rig.rest[n].world.copy(p);
 for(const [n,p]of Object.entries(targets)){const j=rig.joints[n],parent=rig.rest[j.parent.name]?.world;j.position.copy(p);if(parent)j.position.sub(parent);}
 rig.root.updateMatrixWorld(true);
 for(const [m,vertices]of snapshots){m.geometry=m.geometry.clone();const attr=m.geometry.attributes.position;const inverse=m.parent.matrixWorld.clone().invert();m.position.set(0,0,0);m.quaternion.identity();m.scale.set(1,1,1);m.updateMatrix();for(let i=0;i<vertices.length;i++){const p=vertices[i].applyMatrix4(inverse);attr.setXYZ(i,p.x,p.y,p.z);}attr.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();delete m.userData.directRestMatrix;}
 rig.root.updateMatrixWorld(true);rig.photoReference={report,targets:allTargets};return report;
}
