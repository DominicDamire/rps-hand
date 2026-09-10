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
// Thumb-angle references only, not full hand poses or image matching.
export const THUMB_TILTS={"NEUTRAL":[0.7984262,-0.4986223,-0.3374779],"FORWARD":[0.5432355,-0.2159375,-0.8113361],"BACKWARD":[0.6139758,-0.7153458,0.3336377],"LEFT":[0.9311239,-0.1177362,-0.3451759],"RIGHT":[0.1658621,-0.8552083,-0.491028]};
const clamp=v=>Math.max(-1,Math.min(1,v));
const neutral=THUMB_TILTS.NEUTRAL;
const angle=t=>Math.atan2(t[1],t[0]);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const forwardSpan=neutral[2]-THUMB_TILTS.FORWARD[2];
const backwardSpan=THUMB_TILTS.BACKWARD[2]-neutral[2];
function lateral(t,z){
 const depthLean=z>=0?wrap(angle(THUMB_TILTS.BACKWARD)-angle(neutral))*z:wrap(angle(THUMB_TILTS.FORWARD)-angle(neutral))*(-z);
 return wrap(angle(neutral)-angle(t))+depthLean;
}
const depth=t=>{const d=t[2]-neutral[2];return d/(d>=0?backwardSpan:forwardSpan);};
const rightSpan=lateral(THUMB_TILTS.RIGHT,depth(THUMB_TILTS.RIGHT));
const leftSpan=-lateral(THUMB_TILTS.LEFT,depth(THUMB_TILTS.LEFT));
export function thumbVector(tilt){
 const n=Math.hypot(...tilt);if(!Number.isFinite(n)||n<.5)return null;
 tilt=tilt.map(v=>v/n);
 // Signed depth is the walking depth axis; lateral noise cannot reverse it.
 let z=depth(tilt),side=lateral(tilt,z),x=side/(side>=0?rightSpan:leftSpan);
 // Remove the small depth offset of a sideways tilt without reversing backward depth.
 const sidewaysDepth=x>=0?depth(THUMB_TILTS.RIGHT)*Math.min(1,x):depth(THUMB_TILTS.LEFT)*Math.min(1,-x);
 z-=sidewaysDepth;
 const length=Math.hypot(x,z);
 if(length<=.16)return {x:0,z:0};
 const gain=Math.min(1,(length-.16)/.84)/length;x*=gain;z*=gain;
 return {x,z};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.candidate=null;this.lastTilt=null;this.reason='SHOW THUMB';}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  if(time<=this.seen)return;
  const elapsed=time-this.seen;if(elapsed>250)this.reset();this.seen=time;
  if(sample.rest){this.stop('FIST REST');return;}
  const v=thumbVector(sample.tilt);if(!v){this.stop('THUMB UNCLEAR');return;}
  if(Math.hypot(v.x,v.z)<.001){this.stop('NEUTRAL');return;}
  const active=Math.hypot(this.x,this.z)>.01,change=Math.hypot(v.x-this.x,v.z-this.z);
  const normalized=sample.tilt.map(v=>v/Math.hypot(...sample.tilt));
  if(active&&this.lastTilt&&distance(normalized,this.lastTilt)<.06){this.candidate=null;return;}
  if(active&&change<.1){this.candidate=null;return;}
  // Confirm starts and abrupt reversals, while ordinary turns move continuously.
  if(!active||change>.8){
   if(!this.candidate||Math.hypot(v.x-this.candidate.x,v.z-this.candidate.z)>.25)this.candidate={...v,since:time,count:1};else this.candidate.count++;
   if(this.candidate.count<2||time-this.candidate.since<70){if(!active)this.reason='CONFIRMING TILT';return;}
  }
  this.candidate=null;
  const alpha=active?1-Math.exp(-Math.min(100,elapsed)/30):1;
  this.x+=(v.x-this.x)*alpha;this.z+=(v.z-this.z)*alpha;this.lastTilt=normalized;this.reason='MOVING';
 }
 stop(reason){this.x=this.z=0;this.candidate=null;this.reason=reason;}
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt=.016){if(now-this.seen>250)this.reset();const d=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*d,dz:this.z*d};}
}
