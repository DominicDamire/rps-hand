// Capture orchestration only: this does not infer depth or require hand contact.
export class OneHandSweep {
 constructor(){this.cancel();}
 cancel(){this.started=null;this.samples=[];this.label=null;this.last=null;}
 begin(now){this.cancel();this.started=now;}
 update(now,hands,face){
  if(this.started===null)return null;
  const elapsed=now-this.started-5000;
  if(elapsed<0)return {message:'Starting in '+Math.ceil(-elapsed/1000)+' — extend one open hand, palm facing you. Keep your face visible.',progress:0};
  if(elapsed>=8000){
   const samples=this.samples,early=samples.filter(s=>s.elapsed<2000),late=samples.filter(s=>s.elapsed>=6000);
   this.cancel();
   return samples.length>=12&&early.length>=3&&late.length>=3?{done:true,progress:8,samples,message:'Sweep recorded.'}:{done:true,progress:8,message:'Sweep finished. Not enough visible-hand frames at the start or end. Keep one hand and your face visible, then retry.'};
  }
  const h=hands.find(h=>(!this.label||h.label===this.label)&&now-h.seen<250&&h.confidence>=.5&&h.landmarks?.length===21&&h.landmarks.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
  if(h&&face&&h.time!==this.last){this.label=h.label;this.last=h.time;this.samples.push({elapsed,label:h.label,landmarks:h.landmarks.map(p=>({...p})),world:h.world?.map(p=>({...p})),face});}
  return {progress:elapsed/1000,message:'Recording '+(elapsed/1000).toFixed(1)+'/8.0 s — move your open hand back toward your shoulder/neck. Finish there; do not move forward again.'};
 }
}
