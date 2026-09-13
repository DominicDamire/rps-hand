import assert from 'node:assert/strict';
import {startTracking,defaults} from './tracking-session.mjs';
const workers=[];let callback,fallback,closes=0;
globalThis.requestAnimationFrame=fn=>{fallback=fn;return 2;};globalThis.cancelAnimationFrame=()=>fallback=null;
globalThis.Worker=class{constructor(url){this.task=new URL(url).searchParams.get('task');this.frames=[];workers.push(this);}postMessage(d){if(d.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',delegate:'GPU'}}));else this.frames.push(d);}terminate(){this.dead=true;}};
globalThis.document={hidden:false,createElement:()=>({getContext:()=>({drawImage(){}})})};
globalThis.createImageBitmap=async()=>({close(){closes++;}});
const video={readyState:2,videoWidth:640,videoHeight:480,requestVideoFrameCallback(fn){callback=fn;return 1;},cancelVideoFrameCallback(){callback=null;}};
let received=0,opts={...defaults,handPriority:false};const stop=startTracking(video,()=>received++,()=>{},()=>opts);
const frame=async(n)=>{video.currentTime=n/60;fallback(n*17);await new Promise(r=>setImmediate(r));};
await frame(0);await frame(1);
assert.equal(workers.length,3);for(const w of workers)assert.equal(w.frames.length,1);
for(let n=2;n<20;n++)await frame(n);
for(const w of workers)assert.equal(w.frames.length,1,'Busy workers must not queue frames');
const hand=workers.find(w=>w.task==='hands');hand.onmessage({data:{type:'result',task:'hands',inferenceMs:10}});
await frame(20);assert.equal(hand.frames.length,2,'The next fresh frame is used after completion');assert.equal(received,1);
opts={...opts,faceRate:0};await frame(21);assert.equal(workers.find(w=>w.task==='face').dead,true);
opts={...opts,faceRate:20};await frame(22);assert.equal(workers.filter(w=>w.task==='face').length,2,'Re-enable restarts that tracker');
stop();assert.equal(callback,null);assert.ok(workers.every(w=>w.dead));
console.log('PASS GPU-default session: no inference queue, newest frame after completion, per-task stop/restart and cleanup');

workers.length=0;video.currentTime=0;
const stalledStop=startTracking(video,()=>{},()=>{},()=>({...defaults,handPriority:false}));
await new Promise(r=>setImmediate(r));
assert.equal(workers.length,3,'Workers initialize before any video-frame callback');
for(let i=1;i<=10;i++){video.currentTime=i/60;fallback(i*17);await new Promise(r=>setImmediate(r));}
for(const w of workers)assert.equal(w.frames.length,1,'RAF fallback sends a fresh frame even when video callbacks never arrive, without queuing');
stalledStop();assert.equal(fallback,null);
console.log('PASS missing video callback regression: initialization and frame processing remain live');

workers.length=0;video.currentTime=0;
const priorityStop=startTracking(video,()=>{},()=>{},()=>({...defaults,handPriority:true}),{copyPreview:false});
await new Promise(r=>setImmediate(r));
const seen=[];let consumed=new Map();
for(let i=1;i<80;i++){video.currentTime=i/60;await frame(i);let active=workers.filter(w=>w.frames.length>(consumed.get(w)||0));assert.ok(active.length<=1,'Priority mode never overlaps inference');for(const w of active){seen.push(w.task);consumed.set(w,w.frames.length);w.onmessage({data:{type:'result',task:w.task,inferenceMs:8}});}}
assert.ok(seen.filter(x=>x==='hands').length>seen.filter(x=>x==='face').length);assert.ok(seen.includes('face')&&seen.includes('pose'),'Auxiliary trackers are not starved');priorityStop();
console.log('PASS hand-priority scheduling: no overlap, hands favored, face and shoulders remain active');

workers.length=0;video.currentTime=0;
const clockStop=startTracking(video,()=>{},()=>{},()=>defaults);
await new Promise(r=>setImmediate(r));
let completed=0;const base=performance.now();
for(let i=0;i<90;i++){const now=base+i*17;fallback(now);await new Promise(r=>setImmediate(r));for(const w of workers){if(w.frames.length){completed+=w.frames.length;w.frames=[];w.onmessage({data:{type:'result',task:w.task,inferenceMs:5}});}}}
assert.ok(completed>10,'A stalled media clock must not freeze tracking even when video callbacks keep arriving');clockStop();
console.log('PASS constant Safari media clock: live image capture continues without relying on timestamps');
