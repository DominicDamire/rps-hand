import assert from 'node:assert/strict';
import {measureVideoFrames} from './video-fps.mjs';
let now=0,cb,cancelled=false;
Object.defineProperty(globalThis,'performance',{value:{now:()=>now},configurable:true});
const meter=measureVideoFrames({requestVideoFrameCallback:f=>(cb=f,1),cancelVideoFrameCallback:()=>cancelled=true});
cb(0,{presentedFrames:1});cb(500,{presentedFrames:16});cb(999,{presentedFrames:30});now=1000;
assert.equal(meter.read().fps,30);now=2000;assert.equal(meter.read().fps,0);meter.stop();assert.ok(cancelled);
const unknown=measureVideoFrames({});now=3000;assert.equal(unknown.read().fps,null);unknown.stop();
console.log('30 delivered frames, stalled video, cleanup and unavailable fallback passed');
