import test from 'node:test';import assert from 'node:assert/strict';import {startTracking,defaults} from '../hand-sweep-neck/tracking-session.mjs';
test('startup serializes models, retries a stalled GPU once on CPU, and surfaces failure',async()=>{
 const workers=[],timers=new Map();let id=0,raf;
 const originals=Object.fromEntries(['Worker','document','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','createImageBitmap'].map(k=>[k,globalThis[k]]));
 globalThis.Worker=class{constructor(url){this.url=new URL(url);workers.push(this);}postMessage(){}terminate(){this.dead=true;}emit(data){this.onmessage({data});}};
 globalThis.document={hidden:false,createElement:()=>({getContext:()=>({drawImage(){}})})};
 globalThis.requestAnimationFrame=f=>(raf=f,++id);globalThis.cancelAnimationFrame=()=>{};
 globalThis.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};globalThis.clearTimeout=i=>timers.delete(i);globalThis.setInterval=()=>++id;globalThis.clearInterval=()=>{};globalThis.createImageBitmap=async()=>({close(){}});
 let stop;try{
 const video={readyState:2,videoWidth:640,videoHeight:480,currentTime:1};stop=startTracking(video,()=>{},()=>{},()=>defaults);
 assert.equal(workers.length,1);assert.equal(workers[0].url.searchParams.get('task'),'hands');
 workers[0].emit({type:'loading',message:'Starting GPU inference'});[...timers.values()].find(t=>t.ms===20000).fn();
 assert.equal(workers[0].dead,true);assert.equal(workers[1].url.searchParams.get('delegate'),'CPU');
 workers[1].emit({type:'ready',delegate:'CPU'});raf(performance.now());assert.equal(workers.length,3);assert.equal(workers[2].url.searchParams.get('task'),'face');
 workers[2].emit({type:'error',message:'GPU failed'});assert.equal(workers[3].url.searchParams.get('delegate'),'CPU');workers[3].emit({type:'error',message:'CPU failed'});
 video.currentTime++;raf(performance.now());assert.equal(workers.length,5);assert.equal(workers[4].url.searchParams.get('task'),'pose');
 video.currentTime++;raf(performance.now());assert.equal(workers.length,5,'failed face must not restart each video frame');
 await Promise.resolve();
 }finally{stop?.();for(const [k,v]of Object.entries(originals))globalThis[k]=v;}
});
