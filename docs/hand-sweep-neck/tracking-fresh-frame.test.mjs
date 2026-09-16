import test from 'node:test';import assert from 'node:assert/strict';import {startTracking} from './tracking-session.mjs';
test('slow hand result immediately uses newest frame, without repeating or queuing frames',async()=>{
 const keys=['document','Worker','createImageBitmap','requestAnimationFrame','cancelAnimationFrame'],saved=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const frames=[],callbacks=new Map();let id=0,worker,stop;
 try{
 globalThis.document={hidden:false,createElement:()=>({getContext:()=>({drawImage(){}})})};
 globalThis.createImageBitmap=async()=>({close(){}});globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 globalThis.Worker=class{constructor(){worker=this;}postMessage(m){if(m.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready',delegate:'GPU'}}));else frames.push(m);}terminate(){}};
 const video={readyState:2,videoWidth:640,videoHeight:480,currentTime:1,requestVideoFrameCallback(cb){callbacks.set(++id,cb);return id;},cancelVideoFrameCallback(i){callbacks.delete(i);}};
 stop=startTracking(video,()=>{},()=>{},()=>({handRate:60,faceRate:0,shoulderRate:0,freshFrames:true,uncappedTracking:true}));
 await new Promise(r=>setImmediate(r));
 const emit=()=>{const pending=[...callbacks.values()];callbacks.clear();for(const cb of pending)cb(performance.now(),{mediaTime:video.currentTime,presentedFrames:video.currentTime});};
 emit();await new Promise(r=>setImmediate(r));assert.equal(frames.length,1);
 video.currentTime=2;emit();await new Promise(r=>setImmediate(r));assert.equal(frames.length,1,'busy worker never queues');
 worker.onmessage({data:{type:'result',task:'hands',time:performance.now(),inferenceMs:56}});await new Promise(r=>setImmediate(r));assert.equal(frames.length,2,'new frame starts on result');
 worker.onmessage({data:{type:'result',task:'hands',time:performance.now(),inferenceMs:56}});emit();await new Promise(r=>setImmediate(r));assert.equal(frames.length,2,'same frame never repeats');
 }finally{stop?.();for(const[k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
