export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Track thumb base (2) to tip (4).
 const span=(Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect)+Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect))/2;
 if(span<.015)return null;
 const palm=(d(0,9)+d(5,17))/2;if(palm<.005)return null;
 // A thumb lying against the closed fingers is a release, never a direction.
 // Measure along the knuckle row so this does not depend on screen rotation/mirroring.
 const row=[image[17].x-image[5].x,(image[17].y-image[5].y)/aspect];
 const row2=row[0]**2+row[1]**2;
 const along=row2>1e-8?((image[4].x-image[6].x)*row[0]+(image[4].y-image[6].y)/aspect*row[1])/row2:-Infinity;
 const wrapped=[5,9,13,17].filter(m=>reach(m)<.82).length>=3&&along>-.16&&d(4,6)/d(5,17)<.72;
 // Follow the thumb tip directly in the mirrored camera view.
 return {rest:wrapped,position:{x:image[4].x,y:-image[4].y/aspect}};
}
const valid=s=>Number.isFinite(s?.position?.x)&&Number.isFinite(s?.position?.y);
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.previous=null;this.pending={dx:0,dz:0};this.reason='SHOW THUMB';}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  if(sample.rest){this.reset();this.seen=time;this.reason='FIST REST';return;}
  const p=sample.position,old=this.previous,age=time-this.seen;this.seen=time;this.previous={...p};
  this.x=this.z=0;
  if(!old||age>180){this.pending={dx:0,dz:0};this.reason='THUMB READY';return;}
  const dx=-(p.x-old.x),dz=-(p.y-old.y),length=Math.hypot(dx,dz);
  // Ignore tiny tracker jitter and implausible single-frame landmark jumps.
  if(length<.003||length>.5){this.reason='THUMB STILL';return;}
  const travel=Math.min(.6,(length-.003)*this.speed*1.6);
  this.pending.dx+=dx/length*travel;this.pending.dz+=dz/length*travel;
  const queued=Math.hypot(this.pending.dx,this.pending.dz);if(queued>.6){this.pending.dx*=.6/queued;this.pending.dz*=.6/queued;}
  this.x=dx/length;this.z=dz/length;this.reason='MOVING';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now){if(now-this.seen>180){this.reset();return {dx:0,dz:0};}const step=this.pending;this.pending={dx:0,dz:0};return step;}
}
