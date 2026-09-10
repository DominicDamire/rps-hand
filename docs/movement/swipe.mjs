// Screen-space pointer: no camera-distance estimate or palm-size gating.
export function measurePointer(image,world){
 if(image?.length!==21||!image.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const p=world?.length===21&&world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))?world:image;
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,(p[a].z??0)-(p[b].z??0));
 const length=d(5,6)+d(6,7)+d(7,8),palm=d(5,17);
 if(length<1e-6||palm<1e-6)return null;
 return {x:1-image[8].x,y:image[8].y,extended:d(5,8)/length>.86&&d(0,8)>d(0,6)*1.04,pinch:d(4,8)/palm};
}
export class SwipeController{
 constructor(){this.mode='index';this.gain=12;this.reset();}
 reset(){this.last=null;this.anchor=null;this.time=null;this.active=false;this.distance=0;this.started=null;}
 update(s,t){
  const zero={dx:0,dz:0,yaw:0,active:false,distance:0,speed:0,status:'Show one hand'};
  if(!s||![s.x,t].every(Number.isFinite)){this.reset();return zero;}
  const down=this.mode==='pinch'?s.pinch<(this.active?.55:.35):s.extended;
  if(!down){this.reset();return {...zero,status:this.mode==='index'?'Extend index to turn · fold to release':'Pinch to turn · release to stop'};}
  if(this.time!==null&&(t<=this.time||t-this.time>180||Math.abs(s.x-this.last)>.65))this.reset();
  if(this.time===null){this.last=this.anchor=s.x;this.time=this.started=t;this.active=true;return {...zero,active:true,status:'Ready · swipe left or right'};}
  const dt=(t-this.time)/1000;this.time=t;this.last=s.x;
  // A tiny positional slack rejects tremor but preserves slow strokes across many frames.
  const delta=s.x-this.anchor,travel=Math.abs(delta)<=.003+1e-9?0:Math.sign(delta)*(Math.abs(delta)-.003);
  this.anchor+=travel;this.distance+=Math.abs(travel);
  const speed=Math.abs(travel)/dt;
  const acceleration=1+Math.min(.8,speed*.35);
  const yaw=travel===0?0:-travel*(this.gain/4)*acceleration;
  return {...zero,yaw,active:true,distance:this.distance,speed,status:Math.abs(yaw)>.00001?(yaw<0?'Turning right':'Turning left'):'Ready · hold still to stop'};
 }
}
