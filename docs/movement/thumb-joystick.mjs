const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Track thumb base (2) to tip (4).
 const span=(Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect)+Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect))/2;
 if(span<.015)return null;
 const palm=(d(0,9)+d(5,17))/2;if(palm<.005)return null;
 const a=['x','y','z'].map(k=>world[3][k]-world[2][k]),b=['x','y','z'].map(k=>world[4][k]-world[3][k]);
 const length=Math.hypot(...a)*Math.hypot(...b);if(length<1e-8)return null;
 const straight=clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/length);
 // Thumb travel relative to its own base. No index-knuckle target or fixed bend threshold.
 const chain=d(2,3)+d(3,4);
 // A thumb lying against the closed fingers is a release, never a direction.
 // Measure along the knuckle row so this does not depend on screen rotation/mirroring.
 const row=[image[17].x-image[5].x,(image[17].y-image[5].y)/aspect];
 const row2=row[0]**2+row[1]**2;
 const along=row2>1e-8?((image[4].x-image[6].x)*row[0]+(image[4].y-image[6].y)/aspect*row[1])/row2:-Infinity;
 const wrapped=[5,9,13,17].filter(m=>reach(m)<.82).length>=3&&along>-.16&&d(4,6)/d(5,17)<.72;
 return {rest:wrapped,axes:[(image[2].x-image[4].x)/span,(image[2].y-image[4].y)/(aspect*span),(world[4].z-world[2].z)/chain,straight]};
}
const valid=s=>s?.axes?.length===4&&s.axes.every(Number.isFinite);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
// Fixed analog thumb mapping from the tested reference movements; no user setup.
const DEFAULT_MAP={"origin":[0.3708756125518603,-0.5724621207669807,-0.8790693831958614,0.8020211541734797],"weights":[[-0.08063748082743882,1.2519772296202216,-19.147619681101904,-2.8156916671466647],[-0.030052957847388737,4.696678951280948,24.35192083218075,4.095663001933436]]};
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.reason='SHOW THUMB';}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  this.seen=time;
  if(sample.rest){this.reset();this.seen=time;this.reason='FIST REST';return;}
  const delta=sample.axes.map((v,i)=>v-DEFAULT_MAP.origin[i]);
  const [x,z]=DEFAULT_MAP.weights.map(w=>dot(w,delta));
  const dead=v=>Math.sign(v)*Math.max(0,(Math.abs(clamp(v))-.22)/.78);
  this.x=dead(x);this.z=dead(z);
  // A small secondary signal near a main direction is usually tracking cross-talk.
  // Deliberate diagonals retain both axes outside this narrow cone.
  if(Math.abs(this.x)<Math.abs(this.z)*.2)this.x=0;
  if(Math.abs(this.z)<Math.abs(this.x)*.2)this.z=0;
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
