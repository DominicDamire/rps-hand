import assert from 'node:assert/strict';
import {encodeAux,decodeAux,drawFace,faceIds} from './face-overlay.mjs';
const points=Object.fromEntries(faceIds.map(i=>[i,{x:i/479,y:1-i/480}]));
const result=decodeAux(JSON.parse(JSON.stringify(encodeAux({task:'face',face:{points,matrix:[1,2]}}))));
assert.equal(Object.keys(result.face.points).length,faceIds.length);for(const i of faceIds)assert.ok(Math.abs(result.face.points[i].x-points[i].x)<1/65535);
let dots=0;drawFace({fillRect(){dots++;}},result.face.points,480,640);assert.equal(dots,56);assert.equal(faceIds.length,8);
const capture=points=>{const out=[];drawFace({fillRect(...args){out.push(args);}},points,480,640);return out;};assert.deepEqual(capture(points),capture({...points,13:{x:0,y:0},14:{x:1,y:1},159:{x:.1,y:.3}}),'Mouth opening and eyelid landmarks cannot change decorative dots');console.log('PASS green face dots survive transport');
