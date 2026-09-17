import test from 'node:test';import assert from 'node:assert/strict';import {startTracking,defaults} from './tracking-session.mjs';
test('telemetry counts actual completions, then clears rates and timings on stalled/ended input',async()=>{
 const keys=['performance','document','Worker','createImageBitmap','requestAnimationFrame','cancelAnimationFrame','setInterval','clearInterval'];
 const saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));let now=0,raf,report,stop;const workers=[],stats=[];let accepted=0;
 try{
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  globalThis.document={hidden:false,createElement:()=>({getContext:()=>({drawImage(){}})})};
  globalThis.requestAnimationFrame=fn=>(raf=fn,1);globalThis.cancelAnimationFrame=()=>{};
  globalThis.setInterval=fn=>(report=fn,1);globalThis.clearInterval=()=>{};
  globalThis.createImageBitmap=async()=>({close(){}});
  globalThis.Worker=class{constructor(){this.frames=[];workers.push(this);}postMessage(m){if(m.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',delegate:'GPU'}}));else this.frames.push(m);}terminate(){}};
  const track={readyState:'live',enabled:true,muted:false,getSettings:()=>({frameRate:60})};
  const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0,srcObject:{getVideoTracks:()=>[track]}};
  stop=startTracking(v,()=>accepted++,s=>stats.push(s),()=>defaults);await new Promise(r=>setImmediate(r));
  for(let i=0;i<30;i++){
   now=i*33;v.currentTime=i/30;raf(now);await new Promise(r=>setImmediate(r));now+=16;
   for(const w of workers)if(w.frames.length){const frame=w.frames.pop();w.onmessage({data:{type:'result',task:['hands','face','pose'][workers.indexOf(w)],time:frame.time,inferenceMs:11,landmarks:[]}});}
  }
  now=1001;report();assert.equal(stats.at(-1).sourceState,'live');assert.equal(stats.at(-1).hands,30);
  assert.equal(stats.at(-1).ms.hands,11);assert.equal(stats.at(-1).age.hands,16);assert.equal(stats.at(-1).detections.hands,0);
  const count=accepted;for(let t=1030;t<2300;t+=33){now=t;raf(now);await new Promise(r=>setImmediate(r));}
  now=2300;report();assert.equal(accepted,count);assert.equal(stats.at(-1).sourceState,'stalled');
  for(const task of ['hands','face','pose']){assert.equal(stats.at(-1)[task],0);assert.equal(stats.at(-1).ms[task],null);assert.equal(stats.at(-1).age[task],null);}
  track.readyState='ended';now=3301;report();assert.equal(stats.at(-1).sourceState,'inactive');
  workers[0].onmessage({data:{type:'result',task:'hands',inferenceMs:99,landmarks:[[]]}});assert.equal(accepted,count,'late result from dead source is discarded');
 }finally{stop?.();for(const [k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
