const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 const a=[world[3].x-world[2].x,world[3].y-world[2].y,world[3].z-world[2].z],b=[world[4].x-world[3].x,world[4].y-world[3].y,world[4].z-world[3].z];
 const length=Math.hypot(...a)*Math.hypot(...b);if(length<1e-8)return null;
 const straight=clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/length);
 const span=Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect)+Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect);
 if(span<.015)return null;
 return {straight,x:(image[2].x-image[4].x)/(span*.5)};
}
export class ThumbJoystick {
 constructor(){this.speed=3;this.reset();}
 reset(){this.x=0;this.z=0;this.neutral=null;this.seen=-Infinity;this.reason='OPEN HAND / NO THUMB';}
 receive(sample,time){
  if(!sample){this.reset();return;}
  this.neutral??=sample.x;this.seen=time;
  // Thumb IP bend provides depth; deflection relative to its automatic centre provides strafe.
  const side=sample.straight>.8?clamp((sample.x-this.neutral)/.65):0;
  this.x=Math.sign(side)*Math.max(0,(Math.abs(side)-.12)/.88);
  this.z=sample.straight>.9?-Math.min(1,(sample.straight-.9)/.08):sample.straight<.8?Math.min(1,(.8-sample.straight)/.25):0;
  this.z*=1-Math.abs(this.x);
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
