import {palmSize} from './palm-distance.mjs?v=alien13';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
export function validReference(r){return r?.version===1&&Number.isFinite(r.size)&&r.size>0&&Number.isFinite(r.depth)&&r.depth>=.1&&r.depth<=1.5;}
export function referenceDepth(lm,world,aspect,reference,fallback){
 const size=palmSize(lm,world,aspect);
 return validReference(reference)&&size?Math.max(.04,Math.min(4,reference.depth*reference.size/size)):fallback;
}
export class ExtendedReferenceCapture{
 constructor(){this.cancel();}
 cancel(){this.started=null;this.samples=[];this.last=null;this.reason='No fresh tracking frames. Keep this page visible.';}
 begin(now,depth){this.cancel();this.started=now;this.depth=depth;}
 update(now,hands,faceVisible,aspect){
  if(this.started===null)return null;
  const elapsed=now-this.started;
  if(elapsed<5000)return {message:'Starting in '+Math.ceil((5000-elapsed)/1000)+' — extend your arm, open your hand below your face.'};
  if(elapsed>=6500){
   const reason=this.reason,values=this.samples,size=values.length?median(values):0,stable=values.length>=8&&values.every(v=>Math.abs(v-size)/size<.2);
   this.cancel();
   return stable?{done:true,reference:{version:1,size,depth:this.depth},message:'Reference saved. Move naturally: hand size now controls distance.'}:{done:true,message:'Reference not captured. '+(values.length<8?reason:'The hand moved during capture. Hold the reference pose steady.')+' Try capture again.'};
  }
  const fresh=hands.filter(h=>now-h.seen<250&&h.confidence>=.5&&h.landmarks?.length===21&&h.landmarks.every(p=>p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985));
  this.reason=!faceVisible?'Keep your face visible.':!fresh.length?'Keep your whole open hand inside the frame.':'Not enough fresh frames. Keep this page visible.';
  const stamp=fresh.map(h=>h.label+':'+h.time).join('|');
  if(faceVisible&&fresh.length&&stamp!==this.last){
   const sizes=fresh.map(h=>palmSize(h.landmarks,h.world,aspect)).filter(v=>Number.isFinite(v)&&v>0);
   if(sizes.length){this.samples.push(median(sizes));this.last=stamp;}
  }
  return {message:'Hold still — capturing extended-hand reference ('+this.samples.length+' samples). Keep face and whole hand visible.'};
 }
}
