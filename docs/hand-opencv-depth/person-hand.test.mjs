import assert from 'node:assert/strict';
import {acceptPersonHand,defaultHandDepth} from './person-hand.mjs';
const lm=Array.from({length:21},()=>({x:.5,y:.5,z:0})),pose=[];pose[15]={x:.5,y:.5,visibility:1};
const mask={width:20,height:20,values:new Float32Array(400).fill(1)};
assert.ok(acceptPersonHand(lm,pose,mask));mask.values.fill(0);assert.equal(acceptPersonHand(lm,pose,mask),false);
mask.values.fill(1);assert.equal(acceptPersonHand(lm,null,mask),false);assert.equal(acceptPersonHand(lm,pose,null),false);
pose[15].x=.9;assert.ok(acceptPersonHand(lm,pose,mask)); // Coarse wrist disagreement must not erase an in-mask hand.
for(const depth of [.2,.5,1])for(const angle of [-70,0,70]){
 const a=angle*Math.PI/180,w=Array.from({length:21},()=>({x:0,y:0,z:0}));
 for(const [i,x,y] of [[5,.03,-.06],[9,0,-.075],[13,-.012,-.07],[17,-.03,-.055]])w[i]={x:x*Math.cos(a),y,z:-x*Math.sin(a)};
 const image=w.map(p=>({x:.5+(.1+p.x)/(depth+p.z),y:.5+p.y/(depth+p.z),z:p.z}));
 assert.ok(Math.abs(defaultHandDepth(image,w,{x:1,y:1})-depth)<1e-8);
}
console.log('PASS: person/background and coarse-wrist disagreement checks; default-proportion perspective depth');
