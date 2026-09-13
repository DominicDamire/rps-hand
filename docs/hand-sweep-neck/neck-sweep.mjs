import {palmObservation} from './palm-sweep-depth.mjs?v=touch2.4.12-final';
import {sweepEndpoints} from './one-hand-sweep.mjs?v=touch2.4.12-final';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
export const PHONE_TILT_DEGREES=10;
// Assume a phone leaning back, with its camera looking 10 degrees upward.
// Keep tracking/rendering in camera coordinates; use room depth only for
// the rear plane. This avoids tilting or scaling the mirror image twice.
export function roomDepth(p,tilt=PHONE_TILT_DEGREES){
 const angle=tilt*Math.PI/180;return -p[1]*Math.sin(angle)-p[2]*Math.cos(angle);
}
function observation(s){
 const o=palmObservation(s.landmarks,s.points,s.aspect,s.focal);
 if(!o?.reliable)return null;
 const depth=o.scale/o.size,base=-s.points[0][2];
 if(!(depth>.04&&depth<4&&base>0))return null;
 const points=s.points.map(p=>p.map((v,i)=>v+s.points[0][i]*(depth-base)/base));
 return {s,depth,backDepth:Math.max(...points.map(p=>roomDepth(p)))};
}
export function fitNeckSweep(samples){
 const {early,late}=sweepEndpoints(samples),start=early.map(observation).filter(Boolean),end=late.map(observation).filter(Boolean);
 if(start.length<3||end.length<3)return {error:'Need a clear palm at both endpoints. Start: '+start.length+'/3; neck: '+end.length+'/3. Keep the whole hand visible, palm facing you.'};
 const aspects=[...start,...end].map(o=>o.s.aspect);
 if(Math.max(...aspects)-Math.min(...aspects)>.01)return {error:'Camera framing changed during capture. Keep the phone orientation and camera quality unchanged, then retry.'};
 const nearDepth=median(start.map(o=>o.depth)),endDepth=median(end.map(o=>o.depth));
 if(endDepth<nearDepth*1.05)return {error:'The hand needs to move farther from the camera. Start fully extended toward the camera, then move back to your neck.'};
 // No upward-motion or crown-position gate. The user declares the neck
 // contact; face visibility is only an endpoint quality check.
 const atNeck=end.filter(o=>o.s.face);
 if(atNeck.length<3)return {error:'Keep your face visible as you finish at your neck.'};
 const anchors=atNeck.filter(o=>Number.isFinite(o.s.face.neckWristDepth)&&o.s.face.neckWristDepth>.04&&o.s.face.neckWristDepth<4);
 if(anchors.length<3)return {error:'Hold the open palm against the visible bottom of your neck for the final second. Need at least three neck observations.'};
 // One frozen multiplier preserves the inverse-size curve. The finishing
 // palm sets the absolute model-relative reference, just as in 2.4.7.
 const depthGain=median(anchors.map(o=>o.s.face.neckWristDepth/o.depth));
 if(depthGain<.25||depthGain>4)return {error:'Hand and head scales are too far apart. Adjust the head placement before recording again.'};
 const neckDepth=median(anchors.map(o=>{
  const wrist=o.s.points[0],base=-wrist[2],target=o.depth*depthGain;
  const palm=[0,5,9,13,17].map(i=>o.s.points[i]).reduce((sum,p)=>sum.map((v,k)=>v+p[k]/5),[0,0,0]);
  return roomDepth(palm.map((v,k)=>v+wrist[k]*(target-base)/base));
 }));
 return {fit:{kind:'neck-sweep',version:3,depthGain,nearDepth:nearDepth*depthGain,endDepth:endDepth*depthGain,neckDepth,farDepth:neckDepth+.30,phoneTilt:PHONE_TILT_DEGREES,aspect:median(aspects),frames:samples.length}};
}
// Return camera-Z movement toward the camera, along the wrist's image ray.
export function rearPlaneCorrection(points,farDepth,tilt=0){
 if(!(farDepth>0)||!points?.length)return 0;
 const wrist=points[0],base=-wrist[2],alongRay=roomDepth(wrist,tilt);
 if(!(base>0&&alongRay>1e-6))return 0;
 const excess=Math.max(0,Math.max(...points.map(p=>roomDepth(p,tilt)))-farDepth);
 return excess*base/alongRay;
}
