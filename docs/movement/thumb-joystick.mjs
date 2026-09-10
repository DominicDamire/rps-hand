export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].every(m=>reach(m)>.94))return null;
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
 // Thumb tilt from its own base; whole-hand translation cannot steer it.
 const vector=['x','y','z'].map(k=>world[4][k]-world[2][k]);
 const length=Math.hypot(...vector);if(length<.008)return null;
 return {rest:wrapped,tilt:vector.map(v=>v/length)};
}
const valid=s=>s?.tilt?.length===3&&s.tilt.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>{const n=Math.hypot(...a);return n>1e-8?a.map(v=>v/n):null;};
export function thumbVector(tilt,centre){
 const t=unit(tilt);if(!t||!centre)return null;
 // Live neutral defines the plane; screen horizontal is right/left, depth is forward/back.
 let right=unit([-1+centre[0]*centre[0],centre[0]*centre[1],centre[0]*centre[2]]);
 if(!right)right=[0,-1,0];
 let back=unit([centre[1]*right[2]-centre[2]*right[1],centre[2]*right[0]-centre[0]*right[2],centre[0]*right[1]-centre[1]*right[0]]);
 if(back[2]<0)back=back.map(v=>-v);
 const alignment=dot(t,centre);if(alignment<.1)return null;
 const angle=Math.acos(Math.max(-1,Math.min(1,alignment)));
 if(angle<.12)return {x:0,z:0};
 const x=dot(t,right),z=dot(t,back),r=Math.hypot(x,z);if(r<1e-7)return {x:0,z:0};
 const magnitude=Math.min(1,(angle-.12)/.45);return {x:x/r*magnitude,z:z/r*magnitude};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.centre=null;this.settling=[];this.seen=-Infinity;this.stop('SHOW THUMB');}
 stop(reason){this.x=this.z=0;this.raw={x:0,z:0};this.candidate=null;this.lastTilt=null;this.reason=reason;}
 receive(sample,time){
  if(!valid(sample)){this.stop('TRACKING LOST');this.settling=[];this.seen=-Infinity;return;}
  if(time<=this.seen)return;
  const elapsed=time-this.seen;if(elapsed>250){this.stop('TRACKING RESUMED');this.settling=[];}this.seen=time;
  if(sample.rest){this.stop('FIST REST');this.settling=[];return;}
  const t=unit(sample.tilt);if(!t){this.stop('THUMB UNCLEAR');return;}
  if(!this.centre){
   this.reason='HOLD UPRIGHT BRIEFLY';
   if(this.settling.length&&distance(t,this.settling[0].tilt)>.1)this.settling=[];
   this.settling.push({tilt:t,time});
   if(this.settling.length>=3&&time-this.settling[0].time>=180){this.centre=unit([0,1,2].map(i=>this.settling.reduce((s,p)=>s+p.tilt[i],0)));this.settling=[];this.stop('NEUTRAL');}
   return;
  }
  const v=thumbVector(t,this.centre);if(!v){this.stop('THUMB UNCLEAR');return;}this.raw={...v};
  if(Math.hypot(v.x,v.z)<.001){this.stop('NEUTRAL');return;}
  const active=Math.hypot(this.x,this.z)>.01,change=Math.hypot(v.x-this.x,v.z-this.z);
  if(active&&((this.lastTilt&&distance(t,this.lastTilt)<.035)||change<.07)){this.candidate=null;return;}
  if(!active||change>.8){
   const agreement=this.candidate?(v.x*this.candidate.x+v.z*this.candidate.z)/(Math.hypot(v.x,v.z)*Math.hypot(this.candidate.x,this.candidate.z)):-1;
   if(!this.candidate||agreement<Math.cos(Math.PI/5))this.candidate={...v,since:time,count:1};else this.candidate.count++;
   if(this.candidate.count<2||time-this.candidate.since<70){if(!active)this.reason='CONFIRMING TILT';return;}
  }
  this.candidate=null;const alpha=active?1-Math.exp(-Math.min(100,elapsed)/30):1;
  this.x+=(v.x-this.x)*alpha;this.z+=(v.z-this.z)*alpha;this.lastTilt=t;this.reason='MOVING';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt=.016){if(now-this.seen>250)this.stop('TRACKING LOST');const d=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*d,dz:this.z*d};}
}
