import {measureHand} from './controller.mjs?v=6';
export function indexExtension(p){
 if(p?.length!==21||!p.every(v=>[v.x,v.y,v.z].every(Number.isFinite)))return 0;
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z);
 const length=d(5,6)+d(6,7)+d(7,8);
 return length>1e-6?d(5,8)/length:0;
}
export function isPointing(p){return indexExtension(p)>=.88;}
export function measurePointer(image,world,aspect=4/3){
 if(image?.length!==21||!image.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const p=world?.length===21?world:image.map(p=>({x:p.x,y:p.y/aspect,z:0}));
 // An uncertain depth estimate must never block visible lateral finger movement.
 return {x:1-image[8].x,z:measureHand(image,world,aspect)?.z,extension:indexExtension(p)};
}
// Relative displacement, not distance from a joystick centre: no motion while held still.
export class SwipeController{
 constructor(){this.gain=12;this.reverse=false;this.reset();}
 reset(){this.last=null;this.anchor=null;this.since=null;this.active=false;}
 update(s,t){
  const zero={dx:0,dz:0,yaw:0,active:false,status:'Show your index finger'};
  if(!s||![s.x,t].every(Number.isFinite)){this.reset();return zero;}
  const extension=s.extension??(s.pointing?1:0);
  if(extension<(this.active?.76:.88)){this.reset();return {...zero,status:'Index folded · movement off'};}
  if(this.last&&(t<=this.last.t||t-this.last.t>500||Math.abs(s.x-this.last.x)>.22))this.reset();
  this.since??=t;
  const previous=this.last;this.last={...s,t};
  if(!this.active){this.anchor={...s};this.active=true;return {...zero,active:true,status:'Movement ready · trace a path'};}
  const consume=(axis,slack)=>{const v=s[axis]-this.anchor[axis],out=Math.sign(v)*Math.max(0,Math.abs(v)-slack);this.anchor[axis]+=out;return out;};
  const validDepth=Number.isFinite(s.z)&&Number.isFinite(previous.z)&&Math.abs(s.z-previous.z)<.14;
  if(!validDepth)this.anchor.z=s.z;
  const depth=validDepth?(s.z+previous.z)/2:.5;
  let dx=consume('x',.003)*depth*1.1547*this.gain;
  let dz=validDepth?-consume('z',.008)*this.gain*(this.reverse?-1:1):0;
  const length=Math.hypot(dx,dz),limit=10*(t-previous.t)/1000,k=length>limit?limit/length:1;
  dx*=k;dz*=k;
  return {...zero,dx,dz,active:true,status:length>0?'Moving · relax index to release':'Ready · holding still'};
 }
}
