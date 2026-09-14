import assert from 'node:assert/strict';
import {DepthFusion} from './depth-fusion.mjs';
const f=new DepthFusion(),uv=[.5,.5];
const sample=(meters,label='Left',spread=.05)=>({label,meters,spread,uv});
f.accept([sample(1)],100);assert.equal(f.correct('Left',1,uv,100,false),1);assert.equal(f.references.size,0);
assert.equal(f.correct('Left',1,uv,100,true),1);
f.accept([sample(.8)],200);assert.equal(f.correct('Left',1,uv,200,true),.95);
assert.equal(f.correct('Right',1,uv,200,true),1);
assert.equal(f.correct('Left',1,[.8,.5],200,true),1);
assert.equal(f.correct('Left',1,uv,3000,true),1);
f.accept([sample(.1)],400);assert.equal(f.correct('Left',1,uv,400,true,1),.1);assert.equal(f.correct('Left',1,uv,400,true,0),1);assert.equal(f.correct('Left',1,uv,400,true,.5),.55);
f.accept([sample(.8,'Left',.8)],500);assert.equal(f.correct('Left',1,uv,500,true),1);
f.reset();assert.equal(f.references.size,0);assert.equal(f.correct('Left',1,uv,500,true),1);
console.log('PASS: disabled, frozen reference, independent hands, stale/moved/noisy/outlier rejection, reset');

console.log("PASS: 0%, 50%, 100% exact blend, without old palm-disagreement gate");

const pure=new DepthFusion();pure.accept([{label:'Left',meters:2,spread:.05,uv}],0);assert.equal(pure.correct('Left',.4,uv,0,true,1),.4);
pure.accept([{label:'Left',meters:3,spread:.05,uv}],100);assert.ok(Math.abs(pure.correct('Left',.9,uv,100,true,1)-.6)<1e-12);
assert.ok(Math.abs(pure.correct('Left',1.8,uv,4000,true,1)-.6)<1e-12);
console.log('PASS: 100% ignores changing palm depth and holds stale map depth');
