import {measureHand} from './controller.mjs?v=4';
// Screen-space pointer: no camera-distance estimate or palm-size gating.
export function measurePointer(image,world,aspect=4/3){
 if(image?.length!==21||!image.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 const p=world?.length===21&&world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))?world:image;
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,(p[a].z??0)-(p[b].z??0));
 const length=d(5,6)+d(6,7)+d(7,8),palm=d(5,17);
 if(length<1e-6||palm<1e-6)return null;
 return {z:measureHand(image,world,aspect)?.z,x:1-image[8].x,y:image[8].y,extended:d(5,8)/length>.86&&d(0,8)>d(0,6)*1.04,pinch:d(4,8)/palm};
}
export class SwipeController{
 constructor(){this.mode='index';this.gain=12;this.reverse=false;this.reset();}
 reset(){this.history=[];this.active=false;this.locked=false;this.releaseAt=null;this.candidate=null;}
 update(s,t){
  const zero={dx:0,dz:0,yaw:0,active:false,distance:0,speed:0,status:'Show one hand'};
  // Losing tracking must not silently rearm an already consumed gesture.
  if(!s||!Number.isFinite(s.x)||!Number.isFinite(t)){this.history=[];this.candidate=null;return {...zero,status:this.locked?'Fold index to rearm':'Show one hand'};}
  const down=this.mode==='pinch'?s.pinch<(this.active?.55:.35):s.extended;
  if(!down){
   this.releaseAt??=t;this.history=[];this.candidate=null;
   if(t-this.releaseAt>=60){this.locked=false;this.active=false;}
   return {...zero,status:'Released · extend index for next gesture'};
  }
  this.releaseAt=null;this.active=true;
  if(this.locked)return {...zero,status:this.mode==='index'?'Done · fold index before next gesture':'Done · release pinch before next gesture'};
  const last=this.history.at(-1);
  if(last&&(t<=last.t||t-last.t>220||Math.abs(s.x-last.x)>.5||Number.isFinite(s.z)&&Number.isFinite(last.z)&&Math.abs(s.z-last.z)>.25)){
   this.history=[];this.candidate=null;
  }
  this.history.push({...s,t});while(this.history.length>1&&t-this.history[0].t>240)this.history.shift();
  const a=this.history[0],seconds=(t-a.t)/1000;
  if(seconds<.025)return {...zero,active:true,status:'Ready · flick sideways, push or pull'};
  const dx=s.x-a.x,dz=Number.isFinite(s.z)&&Number.isFinite(a.z)?s.z-a.z:0;
  const xStrength=Math.abs(dx)/.10,zStrength=Math.abs(dz)/.045;
  const axis=zStrength>xStrength*1.3?'z':'x',travel=axis==='x'?dx:dz;
  const speed=Math.abs(travel)/seconds,threshold=axis==='x'?.10:.045;
  const qualifies=Math.abs(travel)>=threshold&&speed>=(axis==='x'?.5:.20);
  if(!qualifies){this.candidate=null;return {...zero,active:true,distance:Math.abs(dx),speed:Math.abs(dx)/seconds,status:Number.isFinite(s.z)?'Ready · flick sideways, push or pull':'Turn ready · show palm for push / pull'};}
  // Confirm across two detections so a single noisy landmark cannot move the view.
  const sign=Math.sign(travel);
  if(!this.candidate||this.candidate.axis!==axis||this.candidate.sign!==sign){this.candidate={axis,sign};return {...zero,active:true,status:'Gesture detected…'};}
  this.locked=true;
  const gain=this.gain/12;
  const amount=axis==='x'?Math.min(Math.PI/2,(Math.abs(travel)*2.2+Math.min(speed,3)*.12)*gain):Math.min(3,(Math.abs(travel)*10+Math.min(speed,1.5)*.5)*gain);
  return {...zero,yaw:axis==='x'?-sign*amount:0,dz:axis==='z'?-sign*amount*(this.reverse?-1:1):0,distance:Math.abs(dx),speed,active:true,status:(axis==='x'?(sign>0?'Turned right':'Turned left'):(sign>0?'Stepped forward':'Stepped backward'))+' · fold index to rearm'};
 }
}
