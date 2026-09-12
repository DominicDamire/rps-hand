import assert from 'node:assert/strict';
import {encodeAux,decodeAux,drawFace} from './face-overlay.mjs';
const points=Array.from({length:478},(_,i)=>({x:i/479,y:1-i/480}));
const result=decodeAux(JSON.parse(JSON.stringify(encodeAux({task:'face',face:{points,matrix:[1,2]}}))));
assert.equal(result.face.points.length,478);for(let i=0;i<478;i++)assert.ok(Math.abs(result.face.points[i].x-points[i].x)<1/65535);
let dots=0;drawFace({fillRect(){dots++;}},result.face.points,480,640);assert.equal(dots,478);console.log('PASS all face landmarks survive phone transport and render');
