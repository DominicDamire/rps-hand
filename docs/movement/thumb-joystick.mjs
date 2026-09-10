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
 const centre={x:(world[0].x+world[5].x+world[17].x)/3,y:(world[0].y+world[5].y+world[17].y)/3,z:(world[0].z+world[5].z+world[17].z)/3};
 const palm=(d(0,9)+d(5,17))/2;if(palm<.005)return null;
 const thumbReach=Math.hypot(world[4].x-centre.x,world[4].y-centre.y,world[4].z-centre.z)/palm;
 return {reach:thumbReach,x:(image[2].x-image[4].x)/(span*.5)};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.reset();}
 reset(){this.x=0;this.z=0;this.neutral=null;this.seen=-Infinity;this.reason='OPEN HAND / NO THUMB';}
 receive(sample,time){
  if(!sample){this.reset();return;}
  if(!Number.isFinite(sample.reach)||!Number.isFinite(sample.x)){this.reset();return;}
  this.neutral??={...sample};this.seen=time;
  // Palm-normalized reach includes movement at the thumb base, unlike one joint angle.
  const dead=v=>Math.sign(v)*Math.max(0,(Math.abs(v)-.2)/.8);
  this.x=dead(clamp((sample.x-this.neutral.x)/.55));
  this.z=-dead(clamp((sample.reach-this.neutral.reach)/.35))||0;
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
