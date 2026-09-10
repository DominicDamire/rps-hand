import {measureHand} from './controller.mjs?v=5';
export function isPointing(p){
 if(p?.length!==21||!p.every(v=>[v.x,v.y,v.z].every(Number.isFinite)))return false;
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z);
 const straight=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3));
 const curled=m=>straight(m)<.82&&d(0,m+3)<d(0,m+1)*1.12;
 return straight(5)>.96&&d(0,8)>d(0,6)*1.14&&[9,13,17].every(curled)&&d(4,8)>d(5,17)*.5;
}
export function measurePointer(image,world,aspect=4/3){
 const sample=measureHand(image,world,aspect);
 if(!sample)return null;
 return {...sample,x:1-image[8].x,pointing:isPointing(world)};
}
// Relative displacement, not distance from a joystick centre: no motion while held still.
export class SwipeController{
 constructor(){this.gain=12;this.reverse=false;this.reset();}
 reset(){this.last=null;this.anchor=null;this.since=null;this.active=false;}
 update(s,t){
  const zero={dx:0,dz:0,yaw:0,active:false,status:'Point with index only · other fingers curled'};
  if(!s||!s.pointing||![s.x,s.z,t].every(Number.isFinite)){this.reset();return zero;}
  if(this.last&&(t<=this.last.t||t-this.last.t>220||Math.abs(s.x-this.last.x)>.22||Math.abs(s.z-this.last.z)>.14))this.reset();
  this.since??=t;
  const previous=this.last;this.last={...s,t};
  if(!this.active){this.anchor={...s};if(t-this.since<70)return {...zero,status:'Point detected…'};this.active=true;return {...zero,active:true,status:'Movement ready · trace a path'};}
  const consume=(axis,slack)=>{const v=s[axis]-this.anchor[axis],out=Math.sign(v)*Math.max(0,Math.abs(v)-slack);this.anchor[axis]+=out;return out;};
  const depth=(s.z+previous.z)/2;
  let dx=consume('x',.006)*depth*1.1547*this.gain;
  let dz=-consume('z',.008)*this.gain*(this.reverse?-1:1);
  const length=Math.hypot(dx,dz),limit=10*(t-previous.t)/1000,k=length>limit?limit/length:1;
  dx*=k;dz*=k;
  return {...zero,dx,dz,active:true,status:length>0?'Moving · relax index to release':'Ready · holding still'};
 }
}
