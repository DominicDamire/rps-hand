import test from 'node:test';
import assert from 'node:assert/strict';
import {ThumbJoystick,thumbVector,measureThumb} from './thumb-joystick.mjs';
import {drawThumbJoystick} from './ui.mjs';
const s=(x=0,y=0,rest=false,scale=1)=>({point:[x,y],rest,scale});
const ready=()=>{const c=new ThumbJoystick();for(const t of [-400,-300,-200,-100,0])c.receive(s(0,.35,true),t);return c;};
test('fist captures a fixed circle above its resting thumb',()=>{const c=ready();assert.deepEqual(c.centre,[0,0]);assert.equal(c.scale,1);assert.equal(c.direction,null);});
test('hand position and size changes cannot drag or resize the circle',()=>{
 const c=ready();for(let t=40;t<1000;t+=40)c.receive(s(.7,.8,true,2),t);
 assert.deepEqual(c.centre,[0,0]);assert.equal(c.scale,1);assert.deepEqual(c.step(1000),{dx:0,dz:0});
});
test('all held screen directions move with equal maximum speed',()=>{
 for(const [x,z,name] of [[-.5,0,'LEFT'],[.5,0,'RIGHT'],[0,-.5,'FORWARD'],[0,.5,'BACKWARD'],[.5,-.5,'FORWARD RIGHT']]){
 const c=ready();c.receive(s(x,z),100);c.receive(s(x,z),180);assert.equal(c.direction,name);
 assert.ok(Math.abs(Math.hypot(c.x,c.z)-1)<1e-10);assert.deepEqual(c.step(200),c.step(220));}
});
test('circle centre and fist both stop immediately',()=>{for(const stop of [s(),s(.6,.7,true)]){const c=ready();c.receive(s(.5),100);c.receive(s(.5),180);c.receive(stop,220);assert.deepEqual(c.step(220),{dx:0,dz:0});}});
test('lost tracking preserves circle but requires fist before movement resumes',()=>{
 const c=ready();c.receive(s(.5),100);c.receive(s(.5),180);c.receive(null,220);
 assert.deepEqual(c.centre,[0,0]);c.receive(s(.5),260);c.receive(s(.5),340);assert.deepEqual(c.step(340),{dx:0,dz:0});
 c.receive(s(.7,.8,true),380);c.receive(s(-.5),420);c.receive(s(-.5),500);assert.equal(c.direction,'LEFT');
 assert.deepEqual(c.centre,[0,0]);assert.deepEqual(c.step(751),{dx:0,dz:0});assert.deepEqual(c.centre,[0,0]);
});
test('only reset allows replacing the captured circle',()=>{const c=ready();c.reset();for(let t=0;t<=400;t+=100)c.receive(s(.5,.7,true,2),t);assert.deepEqual(c.centre,[.5,0]);assert.equal(c.scale,2);});
test('neutral jitter and one corrupt reversal do not cause drift',()=>{
 const c=ready();for(let t=40;t<1000;t+=40){c.receive(s(.16+Math.sin(t)*.01),t);assert.deepEqual(c.step(t),{dx:0,dz:0});}
 c.receive(s(.5),1000);c.receive(s(.5),1080);c.receive(s(-.5),1120);assert.ok(c.x>0);c.receive(s(.5),1160);assert.ok(c.x>0);
});
test('continuous circular input covers every heading',()=>{let last;const bins=new Set();for(let i=0;i<=1440;i++){const a=i*Math.PI/720,v=thumbVector([.5*Math.cos(a),.5*Math.sin(a)],[0,0]);bins.add(Math.round((a*180/Math.PI)%360/5)%72);if(last)assert.ok(Math.hypot(v.x-last.x,v.z-last.z)<.01);last=v;}assert.equal(bins.size,72);});
test('measurement follows absolute mirrored tip, not moving thumb base or depth',()=>{
 const world=Array.from({length:21},(_,i)=>({x:Math.sin(i)*.04,y:Math.cos(i)*.04,z:.01}));
 const image=world.map(p=>({x:.5+p.x*3,y:.5+p.y*3}));const a=measureThumb(image,world,1);assert.ok(a);
 const moved=image.map(p=>({...p}));moved[2].x+=.1;assert.deepEqual(measureThumb(moved,world,1).point,a.point);
 moved[4].x+=.1;assert.ok(measureThumb(moved,world,1).point[0]<a.point[0]);
});
test('rendered circle stays put while thumb marker moves',()=>{
 const arcs=[];const ctx=new Proxy({arc:(...a)=>arcs.push(a)}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const hand=Array.from({length:21},()=>({x:.5,y:.5}));const joystick={centre:[.5,.4],scale:.2,active:false};
 drawThumbJoystick(ctx,hand,640,480,joystick);const first=arcs.map(a=>a.slice());arcs.length=0;
 hand[2]={x:.9,y:.9};hand[4]={x:.7,y:.6};drawThumbJoystick(ctx,hand,640,480,joystick);
 assert.deepEqual(arcs.slice(0,3),first.slice(0,3));assert.notDeepEqual(arcs[3],first[3]);
});
