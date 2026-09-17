import test from 'node:test';import assert from 'node:assert/strict';
import {createFrameSource,videoSourceActive} from './frame-source.mjs';
test('frozen video never becomes new merely because wall time passes',()=>{
 const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0},s=createFrameSource(v);
 assert.equal(s.observe(0),true);for(let t=33;t<4000;t+=33)assert.equal(s.observe(t),false);
 assert.equal(s.state(4000),'stalled');assert.equal(s.id,1);
});
test('Safari constant media time works with actual presented frames',()=>{
 const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0},s=createFrameSource(v);
 for(let i=1;i<60;i++)assert.equal(s.observe(i*17,{mediaTime:0,presentedFrames:i}),true);
 assert.equal(s.observe(1004,{mediaTime:0,presentedFrames:59}),false);assert.equal(s.id,59);
});
test('decoded counter prevents a running clock from masquerading as new images',()=>{
 const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0,getVideoPlaybackQuality:()=>({totalVideoFrames:1})},s=createFrameSource(v);
 assert.equal(s.observe(0),true);for(let t=1;t<100;t++){v.currentTime=t;assert.equal(s.observe(t*33),false);}
 assert.equal(s.state(3300),'stalled');
});
test('polling and frame callbacks cannot double-count one decoded frame',()=>{
 let frames=1;const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0,getVideoPlaybackQuality:()=>({totalVideoFrames:frames})},s=createFrameSource(v);
 assert.equal(s.observe(0),true);assert.equal(s.observe(1,{mediaTime:0,presentedFrames:1}),false);
 frames++;assert.equal(s.observe(33,{mediaTime:0,presentedFrames:2}),true);assert.equal(s.observe(34),false);assert.equal(s.id,2);
});
test('ended, muted, paused and disconnected sources are inactive',()=>{
 const track={readyState:'live',enabled:true,muted:false},v={readyState:2,videoWidth:640,videoHeight:480,currentTime:1,srcObject:{getVideoTracks:()=>[track]}};
 assert.equal(videoSourceActive(v),true);track.readyState='ended';assert.equal(videoSourceActive(v),false);
 track.readyState='live';track.muted=true;assert.equal(videoSourceActive(v),false);track.muted=false;v.paused=true;assert.equal(videoSourceActive(v),false);
 v.paused=false;v.srcObject=null;assert.equal(videoSourceActive(v),false);
});
test('new presented frames remain usable if the decoded counter stops updating',()=>{
 const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:0,getVideoPlaybackQuality:()=>({totalVideoFrames:1})},s=createFrameSource(v);
 s.observe(0);s.observe(1,{mediaTime:0,presentedFrames:1});
 for(let i=2;i<10;i++){s.observe(i*33-1);assert.equal(s.observe(i*33,{mediaTime:0,presentedFrames:i}),true);}
 assert.equal(s.id,9);
});
