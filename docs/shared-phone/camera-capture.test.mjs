import test from 'node:test';import assert from 'node:assert/strict';import {openCamera} from './camera-capture.mjs';
const error=()=>Object.assign(new Error('mode unsupported'),{name:'OverconstrainedError'});
test('requests minimum 59, not only ideal 60',async()=>{let request;await openCamera({frameRate:{ideal:60}},{getUserMedia:async r=>{request=r;return {};}});assert.equal(request.video.frameRate.min,59);});
test('tries lower resolution then supported fallback',async()=>{const calls=[];await openCamera({width:{ideal:1280},frameRate:{ideal:60}},{getUserMedia:async r=>{calls.push(r);if(calls.length<3)throw error();return {};}});assert.equal(calls[1].video.width.ideal,640);assert.equal(calls[2].video.frameRate.min,undefined);});
test('permission errors are not retried',async()=>{let calls=0;await assert.rejects(openCamera({frameRate:{ideal:60}},{getUserMedia:async()=>{calls++;throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}}));assert.equal(calls,1);});

test('does not accept silently downgraded strict capture',async()=>{
 let calls=0,stops=0,applies=0;
 const slow={getSettings:()=>({frameRate:30}),applyConstraints:async()=>{applies++;},stop:()=>{stops++;}};
 const fast={getSettings:()=>({frameRate:60}),stop:()=>{}};
 const result=await openCamera({frameRate:{ideal:60}},{getUserMedia:async()=>{calls++;const t=calls===1?slow:fast;return {getVideoTracks:()=>[t],getTracks:()=>[t]};}});
 assert.equal(calls,2);assert.equal(stops,1);assert.equal(applies,1);assert.equal(result.getVideoTracks()[0],fast);
});
test('keeps 30 FPS fallback when no 60 FPS mode succeeds',async()=>{
 let calls=0,stops=0;const t={getSettings:()=>({frameRate:30}),stop:()=>stops++};
 const result=await openCamera({frameRate:{ideal:60}},{getUserMedia:async()=>{calls++;return {getVideoTracks:()=>[t],getTracks:()=>[t]};}});
 assert.equal(calls,3);assert.equal(stops,2);assert.equal(result.getVideoTracks()[0].getSettings().frameRate,30);
});

test('missing camera API explains secure-context requirement',async()=>{await assert.rejects(openCamera({},{}),/HTTPS/);});
test('stale device ID falls back to default camera',async()=>{const calls=[];const stream={};assert.equal(await openCamera({deviceId:{exact:'gone'},frameRate:{ideal:30}},{getUserMedia:async r=>{calls.push(r);if(calls.length===1)throw Object.assign(new Error('gone'),{name:'NotFoundError'});return stream;}}),stream);assert.equal(calls[1].video.deviceId,undefined);});
