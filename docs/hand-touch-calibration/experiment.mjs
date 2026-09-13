import {imagePalmSize} from './size-wall-depth.mjs';
import {OneHandSweep} from './one-hand-sweep.mjs?v=touch2.2';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
export function fitSweep(samples,aspect){
 const early=samples.filter(s=>s.elapsed<500),late=samples.filter(s=>s.elapsed>=7500);
 if(early.length<3||late.length<3)return null;
 const start=median(early.map(s=>imagePalmSize(s.landmarks,aspect))),end=median(late.map(s=>imagePalmSize(s.landmarks,aspect)));
 if(!(start>end*1.05&&end>0))return null;
 const depths=late.map(s=>s.face?.neckDepth).filter(d=>Number.isFinite(d)&&d>.04&&d<4);if(depths.length<3)return null;
 const starts=early.map(s=>s.face?.handDepth).filter(d=>Number.isFinite(d)&&d>.04&&d<4);if(starts.length<3)return null;
 const startDepth=median(starts),endDepth=median(depths);if(endDepth<=startDepth+.005)return null;
 return {version:2,startDepth,endDepth,face:late[Math.floor(late.length/2)].face,startSize:start,endSize:end};
}
export function sweepDepth(lm,aspect,fit,fallback){
 const size=imagePalmSize(lm,aspect);if(!fit||!size)return fallback;
 const t=(fit.startSize/size-1)/(fit.startSize/fit.endSize-1);
 return Math.max(.04,Math.min(4,fit.startDepth+t*(fit.endDepth-fit.startDepth)));
}
export function installExperiment({container,getHead}){
 const panel=document.createElement('section');panel.style.display='block';panel.innerHTML=`<h2>One-hand sweep</h2><p>Extend one open hand, palm facing yourself. Keep your face visible. After the five-second countdown, move the hand back toward your shoulder/neck for all eight seconds. Do not reverse direction halfway. Finish with the hand at your neck. No second hand, measurements or return sweep.</p><button id="touchSweep">Record 8-second sweep to neck</button> <button id="touchReset">Reset capture</button><p id="touchStatus" role="status" aria-live="polite">Ready. No capture yet.</p><progress id="touchProgress" max="8" value="0" aria-label="Sweep recording progress" style="width:100%"></progress>`;container.prepend(panel);
 const $=id=>panel.querySelector('#'+id),capture=new OneHandSweep();let active=null,timer=null,latest={hands:[],face:null,aspect:1};
 function cancel(){clearInterval(timer);timer=null;capture.cancel();$('touchSweep').disabled=false;}
 function tick(){const result=capture.update(performance.now(),latest.hands,latest.face);if(!result)return;$('touchStatus').textContent=result.message;$('touchProgress').value=result.progress;
  if(result.done){cancel();if(result.samples){const fit=fitSweep(result.samples,latest.aspect);if(fit){active=fit;$('touchStatus').textContent='Sweep captured. Move naturally. The saved mapping stays unchanged until you record again.';}else $('touchStatus').textContent='Sweep not captured: move from the extended position back to your neck, keeping the hand and face visible.';}}
 }
 $('touchSweep').onclick=()=>{cancel();capture.begin(performance.now());$('touchSweep').disabled=true;$('touchProgress').value=0;timer=setInterval(tick,100);tick();};
 $('touchReset').onclick=()=>{cancel();active=null;$('touchProgress').value=0;$('touchStatus').textContent='Capture reset.';};
 return {get active(){return !!active;},get recording(){return capture.started!==null;},get faceReference(){return active?.face;},cancel,
 depth(side,lm,world,base,aspect){return sweepDepth(lm,aspect,active,base);},
 observe(hands,rendered,aspect){const head=getHead(),now=performance.now();let face=null;
  if(head?.face&&now-head.seen<250&&head.depth>0){const sample=hands.find(h=>(!capture.label||h.label===capture.label)&&now-h.seen<250),points=rendered[sample?.label==='Left'?'L':'R']?.result?.points;
   const offset=points?[0,5,9,13,17].reduce((sum,i)=>sum+points[i].z-points[0].z,0)/5:0;
   face={raw:Math.abs(head.face.matrix[14])/100,depth:head.depth,neckDepth:head.depth+offset,handDepth:points?-points[0].z:null};
  }latest={hands,face,aspect};
 }
 };
}
