import {measureHand} from './controller.mjs?v=7';
export function indexExtension(p){
 if(p?.length!==21||!p.every(v=>[v.x,v.y,v.z].every(Number.isFinite)))return 0;
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z);
 const length=d(5,6)+d(6,7)+d(7,8);
 if(length<=1e-6)return 0;
 const straightJoint=(a,b,c)=>{const u=[p[b].x-p[a].x,p[b].y-p[a].y,p[b].z-p[a].z],v=[p[c].x-p[b].x,p[c].y-p[b].y,p[c].z-p[b].z];const norm=Math.hypot(...u)*Math.hypot(...v);return norm>1e-10?(1+Math.max(-1,Math.min(1,u.reduce((sum,n,i)=>sum+n*v[i],0)/norm)))/2:0;};
 // Check both finger joints as well as total length: a bent fingertip must not pass.
 return Math.min(d(5,8)/length,straightJoint(5,6,7),straightJoint(6,7,8));
}
export function isPointing(p){return indexExtension(p)>=.98;}
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
  const zero={dx:0,dz:0,yaw:0,active:false,status:'Fully straighten your index'};
  if(!s||![s.x,t].every(Number.isFinite)){this.reset();return zero;}
  const extension=s.extension??(s.pointing?1:0);
  if(extension<(this.active?.97:.98)){this.reset();return {...zero,status:'Straighten index fully · movement off'};}
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
