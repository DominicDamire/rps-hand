import assert from 'node:assert/strict';
import {sizeDepthSample,rawPalmSpan} from './simple-size-depth.mjs';
const lm=Array.from({length:21},()=>({x:.5,y:.5}));Object.assign(lm,{0:{x:.5,y:.7},5:{x:.43,y:.5},9:{x:.48,y:.48},13:{x:.53,y:.49},17:{x:.58,y:.52}});
const world=lm.map(p=>({x:p.x,y:p.y,z:0}));
const get=(landmarks=lm,w=world)=>sizeDepthSample({landmarks,world:w,aspect:1,focal:1,modelSpan:.08});
const original=get();assert.ok(original.valid);
for(const shift of [-.2,.2]){const moved=lm.map(p=>({...p,x:p.x+shift}));assert.ok(Math.abs(get(moved).depth-original.depth)<1e-12);}
const folded=lm.map((p,i)=>[0,5,9,13,17].includes(i)?p:{x:.5,y:.6});assert.equal(get(folded).depth,original.depth);
const big=lm.map(p=>({x:.5+(p.x-.5)*2,y:.5+(p.y-.5)*2}));assert.ok(Math.abs(get(big).depth-original.depth/2)<1e-12);
const edge=world.map(p=>({x:0,y:p.y,z:p.x}));assert.equal(get(lm,edge).held,true);assert.equal(get(lm,edge).depth,.5);
assert.equal(rawPalmSpan(null),null);
console.log('PASS: sideways translation invariant; finger curl excluded; doubled size halves depth; edge-on holds; invalid data rejected.');
