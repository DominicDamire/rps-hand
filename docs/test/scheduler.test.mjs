// Exercise the current independent-worker scheduler through its real DOM adapter.
import assert from 'node:assert/strict';
import {BodyView} from '../body/BodyView.js';
import {HeadView} from '../head/HeadView.js';
globalThis.document={hidden:false};globalThis.addEventListener=()=>{};
globalThis.Worker=class{constructor(){this.sent=0;}postMessage(){this.sent++;}terminate(){this.stopped=true;}};
globalThis.createImageBitmap=async()=>({close(){}});
const control=value=>({value,events:{},addEventListener(n,fn){this.events[n]=fn;}});
const video={videoWidth:640,videoHeight:480,readyState:2,currentTime:0};
const head=new HeadView({workerUrl:'x'});
head.worker.onmessage({data:{type:'ready',delegate:'GPU'}});
const adapter={get mode(){return head.mode;},get performance(){return head.perf;},get completedFrames(){return head.completedFrames;}};
const mode=control('seated'),body=new BodyView(video,adapter,{mode,status:{},recenter:control('')});
body.start();body.worker.onmessage({data:{type:'ready',delegate:'GPU'}});
try {
 assert.equal(head.wantsFrame(100),true);
 await head.capture(video,100);
 assert.equal(body.wantsFrame(100),true,'Independent body worker may run while face is busy');
 await body.capture(100);assert.equal(body.worker.sent,1);
 assert.equal(body.wantsFrame(300),false,'Only one body frame in flight');
 body.worker.onmessage({data:{type:'pose',ts:performance.now(),pose:null}});
 body.latency=0;
 assert.equal(body.wantsFrame(300),false,'A stale video frame is not processed again');
 video.currentTime=1;
 assert.equal(body.wantsFrame(249),false);assert.equal(body.wantsFrame(250),true);
 head.perf.latency=80;assert.equal(body.wantsFrame(250),false);assert.equal(body.wantsFrame(320),true);
 head.perf.latency=0;body.misses=3;
 assert.equal(body.wantsFrame(400),false);assert.equal(body.wantsFrame(420),true);
 document.hidden=true;assert.equal(body.wantsFrame(500),false);assert.equal(head.wantsFrame(500),false);
 document.hidden=false;mode.value='off';mode.events.change();assert.equal(body.worker,null);assert.equal(body.wantsFrame(500),false);
 mode.value='seated';mode.events.change();body.start();body.worker.onmessage({data:{type:'ready'}});
 // Stopping while image conversion is pending must close, not post, the frame.
 let resolve,closed=false;globalThis.createImageBitmap=()=>new Promise(r=>resolve=r);
 const worker=body.worker,pending=body.capture(600);body.stop();resolve({close(){closed=true;}});await pending;
 assert.equal(worker.sent,0);assert.equal(closed,true);
} finally {body.stop();head.worker.terminate();clearTimeout(head.timer);}
console.log('PASS: independent workers, backpressure, adaptive intervals, fresh frames, disable/hidden and in-flight cleanup');
