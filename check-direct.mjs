import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const code=await (await fetch('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.core.js')).text();
const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const T=await import(url);
const source=(await fs.readFile('docs/hand-demo/direct-arms.mjs','utf8')).replace("'three'",JSON.stringify(url));
const {constrainArmDirections,poseDirectArm}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let count=0;
for(let i=0;i<2000;i++){
 const v=()=>new T.Vector3(Math.sin(i*1.3+count++),Math.cos(i*.7),Math.sin(i*.23));
 const r=constrainArmDirections(v(),v());
 for(const d of [r.upper,r.lower]){assert.ok(Number.isFinite(d.x));assert.ok(d.z<=1e-9);assert.ok(Math.abs(d.length()-1)<1e-9);}
 assert.ok(r.upper.angleTo(r.lower)<=150*Math.PI/180+1e-7);
}
const u=new T.Vector3(0,-1,0),l=new T.Vector3(0,0,-1),r=constrainArmDirections(u,l);
assert.ok(r.upper.distanceTo(u)<1e-9&&r.lower.distanceTo(l)<1e-9);
console.log('2000 direction cases passed: finite unit vectors, front/side limits, elbow bend limit; valid forward pose unchanged.');
