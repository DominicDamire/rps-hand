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
 // Subtract the folded-finger anchor so translating the whole hand is not steering.
 const anchors=[5,9,13,17];
 const anchor=anchors.reduce((p,i)=>({x:p.x+image[i].x/4,y:p.y+image[i].y/4}),{x:0,y:0});
 return {rest:wrapped,position:{x:(anchor.x-image[4].x)/span,y:(anchor.y-image[4].y)/(aspect*span)}};
}
const valid=s=>Number.isFinite(s?.position?.x)&&Number.isFinite(s?.position?.y);
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.centre=null;this.samples=[];this.reason='SHOW THUMB';}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  const previous=this.seen;this.seen=time;
  if(sample.rest){this.reset();this.seen=time;this.reason='FIST REST';return;}
  const p=sample.position;
  if(!this.centre){
   this.reason='CENTRING';this.x=this.z=0;
   if(this.samples.length&&Math.hypot(p.x-this.samples[0].x,p.y-this.samples[0].y)>.1)this.samples=[];
   this.samples.push({...p,time});
   if(this.samples.length>=3&&time-this.samples[0].time>=160){this.centre={x:this.samples.reduce((s,p)=>s+p.x,0)/this.samples.length,y:this.samples.reduce((s,p)=>s+p.y,0)/this.samples.length};this.samples=[];this.reason='THUMB CENTRED';}
   return;
  }
  // Continuous planar stick, independent of inferred depth and finger bend angles.
  let x=-(p.x-this.centre.x)/.4,z=-(p.y-this.centre.y)/.4;
  const radius=Math.hypot(x,z),dead=.2;
  if(radius<=dead){this.x=this.z=0;this.reason='THUMB CENTRED';return;}
  const gain=Math.min(1,(radius-dead)/(1-dead))/radius;x*=gain;z*=gain;
  if(Math.abs(x)<Math.abs(z)*.18)x=0;
  if(Math.abs(z)<Math.abs(x)*.18)z=0;
  const alpha=1-Math.exp(-Math.min(100,Math.max(1,time-previous))/25);
  this.x+=(x-this.x)*alpha;this.z+=(z-this.z)*alpha;
  this.reason='MOVING';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>180)this.reset();const d=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*d,dz:this.z*d};}
}
