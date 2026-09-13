import assert from 'node:assert/strict';
import {HandContactAssist} from './hand-contact-assist.mjs';
const lm=Array.from({length:21},(_,i)=>({x:.2+i*.003,y:.3+i*.004})),other=lm.map(p=>({...p,x:p.x+.5}));other[8]={...lm[8]};
const packet=(isLeft,t)=>({lm:isLeft?lm:other,points:Array.from({length:21},(_,i)=>[(isLeft?-1:1)*(i===0?.14:.04),0,-.6]),time:t,seen:t,confidence:.95});
const assist=new HandContactAssist(),run=(now,enabled=true,left=packet(true,now),right=packet(false,now))=>assist.update({left,right,now,enabled});
assert.equal(run(0,false),null,'off means no correction');assert.equal(run(0),null,'confirm actual contact before closing');
const fit=run(120);assert.ok(fit);const a=packet(true,120).points[8],b=packet(false,120).points[8];
assert.ok(Math.hypot(...a.map((v,i)=>v+fit.A[i]-b[i]-fit.B[i]))<.001001,'confirmed visible contact closes');
const separated={...packet(false,140),lm:lm.map(p=>({...p,x:p.x+.5}))};assert.equal(run(140,true,packet(true,140),separated),null,'release immediately when the image separates');
assert.equal(run(150),null,'re-contact must confirm again');assert.equal(run(270,true,packet(true,270),{...packet(false,270),time:260}),null,'do not combine different frames');
assert.equal(run(280),null);assert.equal(run(600,true,packet(true,280),packet(false,280)),null,'lost hands do not stick');
assert.equal(run(610),null);assert.equal(run(730,false),null,'switching off clears a pending latch');
console.log('PASS: contact confirmation, full closing, immediate release, off reset, stale/asynchronous frame rejection');

const immediate=new HandContactAssist();assert.ok(immediate.update({left:packet(true,0),right:packet(false,0),now:0,enabled:true,confirmMs:0}),'zero confirmation applies immediately');
const slow=new HandContactAssist();assert.equal(slow.update({left:packet(true,0),right:packet(false,0),now:0,enabled:true,confirmMs:500}),null);
assert.equal(slow.update({left:packet(true,300),right:packet(false,300),now:300,enabled:true,confirmMs:500}),null);
assert.ok(slow.update({left:packet(true,500),right:packet(false,500),now:500,enabled:true,confirmMs:500}),'confirmation setting controls when attachment activates');
