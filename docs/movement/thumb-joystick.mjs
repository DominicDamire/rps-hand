const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Thumb position relative to index PIP, in the camera's lateral/depth plane.
 // MediaPipe image z uses the same approximate scale as x; normalize both by hand size.
 if(!Number.isFinite(image[4].z)||!Number.isFinite(image[6].z))return null;
 const span=(Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect)+Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect))/2;
 if(span<.015)return null;
 return {x:(image[4].x-image[6].x)/span,y:-(image[4].z-image[6].z)/span};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.neutral=null;this.seen=-Infinity;this.reason='OPEN HAND / NO THUMB';}
 receive(sample,time){
  if(!sample){this.reset();return;}
  if(!Number.isFinite(sample.y)||!Number.isFinite(sample.x)){this.reset();return;}
  this.neutral??={...sample};this.seen=time;
  // Two axes relative to the neighbouring finger; no bend or palm-distance classification.
  const dead=v=>Math.sign(v)*Math.max(0,(Math.abs(v)-.2)/.8);
  this.x=dead(clamp((sample.x-this.neutral.x)/.55));
  this.z=-dead(clamp((sample.y-this.neutral.y)/.35))||0;
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
