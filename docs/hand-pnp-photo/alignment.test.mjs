
import * as T from 'three';import {DollRig} from '../doll/DollRig.js';import {fitPhotoHand,surfaceSection,PHOTO_POINTS} from './photo-hand.mjs?v=aligned2';import {directDriver,pointOnRay} from './direct.mjs?v=aligned2';
export async function checkAlignment(){
const rig=new DollRig(new T.Scene(),{headLayer:false});await rig.ready;const report=fitPhotoHand(rig),checks={},tips={};
for(const s of ['R','L'])for(const [i,f]of ['Thumb','Index','Middle','Ring','Pinky'].entries())tips[s+f]=rig.photoReference.targets[s][4+4*i].clone().sub(rig.photoReference.targets[s][3+4*i]);
let maxCentre=0,finite=true;const missing=[],centres=[];
for(const s of ['R','L']){
 const x=new T.Vector3().fromArray(report[s].cameraRight),y=new T.Vector3().fromArray(report[s].cameraUp),z=new T.Vector3().crossVectors(x,y).normalize();
 const pts=rig.photoReference.targets[s];
 for(let i=0;i<21;i++){
  const name=i===0?s+'Hand__palm':s+['Thumb','Index','Middle','Ring','Pinky'][Math.floor((i-1)/4)] ;
  let best=null;
  for(const m of rig.parts.filter(m=>m.name.startsWith(name))){const a=m.geometry.attributes.position,vs=Array.from({length:a.count},(_,j)=>new T.Vector3().fromBufferAttribute(a,j).applyMatrix4(m.matrixWorld));const pair=surfaceSection(m,vs,pts[i],x,y,z);if(pair&&(!best||pair[1]-pair[0]>best[1]-best[0]))best=pair;}
  if(best){const error=Math.abs((best[0]+best[1])/2-pts[i].dot(z))*1000;maxCentre=Math.max(maxCentre,error);centres.push([s+i,error]);}else missing.push(s+i);
 }
}
checks.maxThicknessCentreErrorMm=maxCentre;checks.noSurfaceAt=missing;
checks.mirrorError=Math.max(...rig.photoReference.targets.R.map((p,i)=>p.clone().setX(-p.x).distanceTo(rig.photoReference.targets.L[i])));
checks.finite=rig.parts.every(m=>Array.from(m.geometry.attributes.position.array).every(Number.isFinite));
checks.rayBoneError=0;checks.rayProjectionError=0;
for(let i=0;i<100;i++){const base=new T.Vector3(.01,-.01,-.5),target=new T.Vector3(.01+Math.sin(i)*.02,-.01+Math.cos(i)*.02,-.5-.04),ray=target.clone().normalize(),out=pointOnRay(base,ray,base.distanceTo(target),target);checks.rayBoneError=Math.max(checks.rayBoneError,Math.abs(out.distanceTo(base)-base.distanceTo(target)));checks.rayProjectionError=Math.max(checks.rayProjectionError,out.distanceTo(target));}
checks.passed=checks.finite&&checks.mirrorError<1e-9&&checks.rayBoneError<1e-9&&checks.rayProjectionError<1e-9&&maxCentre<.00001&&!missing.length;

let maxDriverError=0,maxLengthError=0;
for(const side of ['R','L']){
 const drive=directDriver(rig,tips),rest=rig.photoReference.targets[side];
 for(const angle of [0,.5,-.8]){
  const q=new T.Quaternion().setFromEuler(new T.Euler(.2,angle,.1));
  const points=rest.map(p=>p.clone().sub(rest[0]).applyQuaternion(q).add(new T.Vector3(.02,-.03,-.6)));
  const result=drive(points,side,q,1/60,{fitImage:true,thickness:1.3,tipInset:0});
  for(const [f,name]of ['Thumb','Index','Middle','Ring','Pinky'].entries())for(let k=1;k<=3;k++){
   const i=1+4*f+k-1,actual=rig.joints[side+name+k].getWorldPosition(new T.Vector3());
   maxDriverError=Math.max(maxDriverError,actual.distanceTo(result.points[i]));
   maxLengthError=Math.max(maxLengthError,Math.abs(result.points[i+1].distanceTo(result.points[i])-rest[i+1].distanceTo(rest[i])));
  }
 }
}
checks.maxDriverError=maxDriverError;checks.maxLengthError=maxLengthError;
const impossible=pointOnRay(new T.Vector3(1,0,-1),new T.Vector3(0,0,-1),.02,new T.Vector3(0,0,-1));
checks.unreachablePreservesLength=Math.abs(impossible.distanceTo(new T.Vector3(1,0,-1))-.02)<1e-10;
checks.passed&&=maxDriverError<1e-8&&maxLengthError<1e-8&&checks.unreachablePreservesLength;
return checks;
}
