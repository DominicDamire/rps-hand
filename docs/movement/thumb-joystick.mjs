const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Screen-plane offset from curled index PIP (6) to thumb tip (4).
 // The wrist-to-knuckle axis cancels hand roll; palm size cancels distance/scale.
 const point=i=>({x:image[i].x,y:image[i].y/aspect});
 const wrist=point(0),knuckle=point(9),anchor=point(6),tip=point(4),index=point(5),pinky=point(17);
 const ux=knuckle.x-wrist.x,uy=knuckle.y-wrist.y,length=Math.hypot(ux,uy);
 const scale=(length+Math.hypot(index.x-pinky.x,index.y-pinky.y))/2;
 if(length<.015||scale<.015)return null;
 const dx=tip.x-anchor.x,dy=tip.y-anchor.y;
 return {x:(dx*uy-dy*ux)/length/scale,y:(dx*ux+dy*uy)/length/scale};
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
