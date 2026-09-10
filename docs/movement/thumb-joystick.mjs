const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Keep the working lateral offset from thumb tip to index PIP unchanged.
 const span=(Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect)+Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect))/2;
 if(span<.015)return null;
 const palm=(d(0,9)+d(5,17))/2;if(palm<.005)return null;
 const a=['x','y','z'].map(k=>world[3][k]-world[2][k]),b=['x','y','z'].map(k=>world[4][k]-world[3][k]);
 const length=Math.hypot(...a)*Math.hypot(...b);if(length<1e-8)return null;
 const straight=clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/length);
 const across=['x','y','z'].map(k=>world[17][k]-world[5][k]);
 const width2=across.reduce((s,v)=>s+v*v,0);if(width2<1e-8)return null;
 const coverage=across.reduce((s,v,i)=>s+v*(world[4][['x','y','z'][i]]-world[5][['x','y','z'][i]]),0)/width2;
 // A wrapped thumb crosses toward the middle/ring fingers; a backward curl stays by the index.
 const resting=coverage>.2&&coverage<1.3&&Math.min(d(4,10),d(4,14),d(4,11),d(4,15))/palm<.65;
 return {x:(image[4].x-image[6].x)/span,straight,resting};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.neutral=null;this.seen=-Infinity;this.reason='OPEN HAND / NO THUMB';}
 receive(sample,time){
  if(!sample){this.reset();return;}
  if(!Number.isFinite(sample.straight)||!Number.isFinite(sample.x)){this.reset();return;}
  if(sample.resting){this.x=0;this.z=0;this.seen=time;this.reason='RESTING THUMB';return;}
  this.neutral??={...sample};this.seen=time;
  // Preserve sideways sensitivity and centre; only the forward/back/rest mapping changes.
  const dead=v=>Math.sign(v)*Math.max(0,(Math.abs(v)-.2)/.8);
  this.x=dead(clamp((sample.x-this.neutral.x)/.55));
  this.z=sample.straight>.88?-Math.min(1,(sample.straight-.88)/.1):sample.straight<.78?Math.min(1,(.78-sample.straight)/.25):0;
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
