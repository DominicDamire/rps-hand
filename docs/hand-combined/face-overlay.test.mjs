import assert from 'node:assert/strict';
import {encodeAux,decodeAux,drawFace,faceIds} from './face-overlay.mjs';
const points=Object.fromEntries(faceIds.map(i=>[i,{x:i/479,y:1-i/480}]));
const result=decodeAux(JSON.parse(JSON.stringify(encodeAux({task:'face',face:{points,matrix:[1,2]}}))));
assert.equal(Object.keys(result.face.points).length,faceIds.length);for(const i of faceIds)assert.ok(Math.abs(result.face.points[i].x-points[i].x)<1/65535);
let paths=0;drawFace({beginPath(){paths++;},moveTo(){},lineTo(){},stroke(){}},result.face.points,480,640);assert.equal(paths,3);assert.ok(faceIds.length<50);console.log('PASS sparse face transport, outline and schematic nose/mouth without dots');
