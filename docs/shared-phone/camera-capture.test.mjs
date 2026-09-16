import test from 'node:test';import assert from 'node:assert/strict';import {openCamera} from './camera-capture.mjs';
const error=()=>Object.assign(new Error('mode unsupported'),{name:'OverconstrainedError'});
test('requests minimum 59, not only ideal 60',async()=>{let request;await openCamera({frameRate:{ideal:60}},{getUserMedia:async r=>{request=r;return {};}});assert.equal(request.video.frameRate.min,59);});
test('tries lower resolution then supported fallback',async()=>{const calls=[];await openCamera({width:{ideal:1280},frameRate:{ideal:60}},{getUserMedia:async r=>{calls.push(r);if(calls.length<3)throw error();return {};}});assert.equal(calls[1].video.width.ideal,640);assert.equal(calls[2].video.frameRate.min,undefined);});
test('permission errors are not retried',async()=>{let calls=0;await assert.rejects(openCamera({frameRate:{ideal:60}},{getUserMedia:async()=>{calls++;throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}}));assert.equal(calls,1);});
