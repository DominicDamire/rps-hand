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
const vectors={FORWARD:[0,-1],BACKWARD:[0,1],LEFT:[-1,0],RIGHT:[1,0]};
const targets=Object.entries(vectors).map(([name,move])=>({name,move,tilt:THUMB_TILTS[name]}));
for(const a of ['FORWARD','BACKWARD'])for(const b of ['LEFT','RIGHT']){const tilt=THUMB_TILTS[a].map((v,i)=>v+THUMB_TILTS[b][i]),n=Math.hypot(...tilt);targets.push({name:a+' '+b,move:[vectors[b][0]/Math.SQRT2,vectors[a][1]/Math.SQRT2],tilt:tilt.map(v=>v/n)});}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.active=null;this.candidate=null;this.reason='SHOW THUMB';}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  if(time<=this.seen)return;
  if(time-this.seen>250)this.reset();
  this.seen=time;
  if(sample.rest){this.stop('FIST REST');return;}
  const n=Math.hypot(...sample.tilt);if(n<.5){this.stop('THUMB UNCLEAR');return;}
  const tilt=sample.tilt.map(v=>v/n);
  if(distance(tilt,THUMB_TILTS.NEUTRAL)<.22){this.stop('NEUTRAL');return;}
  const ranked=targets.map(t=>({...t,error:distance(tilt,t.tilt)})).sort((a,b)=>a.error-b.error),best=ranked[0];
  if(best.error>.55){this.stop('THUMB UNCLEAR');return;}
  if(this.active){
   const current=targets.find(t=>t.name===this.active);
   // Hysteresis: a neighbouring guess must be substantially better to change direction.
   if(best.name===this.active||distance(tilt,current.tilt)-best.error<.12){this.candidate=null;return;}
  }else if(ranked[1].error-best.error<.04){this.candidate=null;this.reason='THUMB BETWEEN DIRECTIONS';return;}
  if(this.candidate?.name!==best.name)this.candidate={name:best.name,since:time,count:1};else this.candidate.count++;
  if(this.candidate.count>=2&&time-this.candidate.since>=90){this.active=best.name;[this.x,this.z]=best.move;this.candidate=null;this.reason='MOVING';}
  else if(!this.active)this.reason='CONFIRMING TILT';
 }
 stop(reason){this.x=this.z=0;this.active=null;this.candidate=null;this.reason=reason;}
 get direction(){return this.active;}
 step(now,dt=.016){if(now-this.seen>250)this.reset();const d=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*d,dz:this.z*d};}
}
