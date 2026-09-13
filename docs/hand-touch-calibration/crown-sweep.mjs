import {palmObservation} from './palm-sweep-depth.mjs?v=touch2.4.8-final';
import {sweepEndpoints} from './one-hand-sweep.mjs?v=touch2.4.8-final';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const palmIds=[0,5,9,13,17];
function observation(s){
 const o=palmObservation(s.landmarks,s.points,s.aspect,s.focal);
 if(!o?.reliable)return null;
 const depth=o.scale/o.size;
 if(!(depth>.04&&depth<4))return null;
 const centre=palmIds.reduce((p,i)=>({x:p.x+s.landmarks[i].x/5,y:p.y+s.landmarks[i].y/5}),{x:0,y:0});
 const backOffset=Math.max(...s.points.map(p=>s.points[0][2]-p[2]));
 return {s,depth,centre,backDepth:depth+backOffset};
}
export function fitCrownSweep(samples){
 const {early,late}=sweepEndpoints(samples),start=early.map(observation).filter(Boolean),end=late.map(observation).filter(Boolean);
 if(start.length<3||end.length<3)return {error:'Need a clear palm at both endpoints. Start: '+start.length+'/3; top of head: '+end.length+'/3. Keep the whole hand visible, with the back of your hand facing the camera.'};
 const aspects=[...start,...end].map(o=>o.s.aspect);
 if(Math.max(...aspects)-Math.min(...aspects)>.01)return {error:'Camera framing changed during capture. Keep the phone orientation and camera quality unchanged, then retry.'};
 const nearDepth=median(start.map(o=>o.depth)),endDepth=median(end.map(o=>o.depth));
 if(endDepth<nearDepth*1.05)return {error:'The hand needs to move farther from the camera as it rises. Start closer and lower, then move back to the top of your head.'};
 if(median(start.map(o=>o.centre.y))-median(end.map(o=>o.centre.y))<.15)return {error:'Not enough upward movement. Start with the hand low in the picture, then finish at the top of your head.'};
 // Face landmarks stop at the forehead, not the crown. Accept the visible
 // hand just above/alongside the upper face; do not pretend to detect touch.
 const atHead=end.filter(o=>{const f=o.s.face;if(!f)return false;
  const h=f.bottom-f.top,w=f.right-f.left;
  return h>.03&&w>.03&&o.centre.y<f.top+h*.5&&o.centre.y>f.top-h&&o.centre.x>f.left-w*.65&&o.centre.x<f.right+w*.65;
 });
 if(atHead.length<3)return {error:'Keep your face visible and finish with the hand touching the top of your head. Do not hide the hand behind your head.'};
 // The endpoint is the user's declared farthest position. Store the rear
 // joint plane (not an extra 30 cm) without refitting model/camera scale.
 const farDepth=median(atHead.map(o=>o.backDepth));
 return {fit:{kind:'crown-sweep',version:1,nearDepth,endDepth,farDepth,aspect:median(aspects),frames:samples.length}};
}

export function rearPlaneCorrection(points,farDepth){
 if(!(farDepth>0)||!points?.length)return 0;
 return Math.max(0,Math.max(...points.map(p=>-p[2]))-farDepth);
}
