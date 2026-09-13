import assert from 'node:assert/strict';
import {OneHandSweep} from './one-hand-sweep.mjs';
const sweep=new OneHandSweep(),landmarks=Array.from({length:21},()=>({x:.5,y:.5,z:0})),hand=now=>({label:'Left',seen:now,time:now,confidence:.9,landmarks});
sweep.begin(0);assert.match(sweep.update(0,[],null).message,/Starting in 5/);
for(let now=5000;now<13000;now+=100){const r=sweep.update(now,[hand(now)],{points:[]});assert.match(r.message,/back toward your shoulder/);}
const result=sweep.update(13000,[],null);assert.equal(result.progress,8);assert.equal(result.samples.length,80);assert.ok(result.done);assert.equal(sweep.update(14000,[],null),null);
sweep.begin(20000);assert.equal(sweep.update(33000,[],null).samples,undefined,'deadline stops even without hand tracking');
sweep.begin(40000);sweep.update(45000,[hand(45000)],{});sweep.update(45100,[{...hand(45100),label:'Right'}],{});assert.equal(sweep.samples.length,1,'do not switch hands midway');
sweep.cancel();assert.equal(sweep.update(46000,[hand(46000)],{}),null);
console.log('PASS: one hand only, 5-second prep, one-way eight-second sweep, exact deadline, no index contact, no measured anchor and cancellation');

sweep.begin(0);
for(let now=4000;now<5000;now+=100)sweep.update(now,[hand(now)],{});
for(let now=6000;now<12700;now+=100){
 const h=hand(now);h.landmarks=landmarks.map((p,i)=>i===8?{...p,y:-.01}:p);
 sweep.update(now,[h],now<7000||now>=12000?{}:null);
}
assert.ok(sweep.update(13000,[],null).samples,'brief face loss and fingertip boundary noise must not discard visible palm frames');
sweep.begin(0);let msg=sweep.update(5000,[{...hand(5000),landmarks:landmarks.map(p=>({...p,x:2}))}],{}).message;
assert.match(msg,/Palm outside camera frame/,'tell the user what rejected a frame');
assert.match(sweep.update(13000,[],null).message,/start 0\/3, neck 0\/3/,'failed capture reports endpoint counts');
