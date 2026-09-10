import test from 'node:test';import assert from 'node:assert/strict';import {ThumbJoystick,thumbVector,measureThumb} from './thumb-joystick.mjs';
const s=(x=0,z=0,rest=false)=>({point:[x,z],rest});const ready=()=>{const c=new ThumbJoystick();for(const t of [-400,-300,-200,-100,0])c.receive(s(0,0,true),t);return c;};
test('tracking loss discards the old centre before reacquisition',()=>{const c=ready();assert.ok(c.centre);c.receive(null,200);assert.equal(c.centre,null);c.receive(s(.5),240);assert.deepEqual(c.step(250),{dx:0,dz:0});});
test('live left right forward and backward offsets all drive movement',()=>{for(const [x,z,name] of [[-.5,0,'LEFT'],[.5,0,'RIGHT'],[0,-.5,'FORWARD'],[0,.5,'BACKWARD']]){const c=ready();c.receive(s(x,z),200);c.receive(s(x,z),280);assert.equal(c.direction,name);assert.deepEqual(c.step(290,.02),c.step(300,.02));}});
test('fist neutral and stale tracking stop held movement',()=>{for(const stop of [s(),s(0,0,true),null]){const c=ready();c.receive(s(0,.5),200);c.receive(s(0,.5),280);c.receive(stop,300);assert.deepEqual(c.step(301,.02),{dx:0,dz:0});}});
test('free circle has continuous direction through all quadrants',()=>{let last;for(let i=0;i<=1440;i++){const a=i*Math.PI/720,v=thumbVector(s(.5*Math.cos(a),.5*Math.sin(a)).point,[0,0]);if(last)assert.ok(Math.hypot(v.x-last.x,v.z-last.z)<.02);last=v;}});
test('small wobble holds direction while a sustained reversal changes it',()=>{const c=ready();c.receive(s(.5),200);c.receive(s(.5),280);const x=c.x;c.receive(s(.51),310);assert.equal(c.x,x);c.receive(s(-.5),350);assert.ok(c.x>0);c.receive(s(-.5),430);assert.ok(c.x<0);});

test('all compass angles remain reachable without direction snapping',()=>{const bins=new Set();for(let i=0;i<10000;i++){const a=i*Math.PI*2/10000,v=thumbVector(s(.5*Math.cos(a),.5*Math.sin(a)).point,[0,0]);bins.add(Math.round(((Math.atan2(v.z,v.x)+Math.PI*2)%(Math.PI*2))*180/Math.PI/5)%72);}assert.equal(bins.size,72);});
test('single corrupt direction sample cannot reverse movement',()=>{const c=ready();c.receive(s(.5),200);c.receive(s(.5),280);c.receive(s(-.5),310);assert.ok(c.x>0);c.receive(s(.5),340);assert.ok(c.x>0);});
test('persistent neutral never accumulates movement',()=>{const c=ready();for(let t=200;t<5000;t+=40){c.receive(s(Math.sin(t)*.015,Math.cos(t)*.015),t);assert.deepEqual(c.step(t,.016),{dx:0,dz:0});}});

test('screen measurement ignores depth and compensates hand translation and camera size',()=>{
 const world=Array.from({length:21},(_,i)=>({x:Math.sin(i)*.04,y:Math.cos(i)*.04,z:.01}));
 const image=world.map(p=>({x:.5+p.x*3,y:.5+p.y*3}));
 const a=measureThumb(image,world,1);assert.ok(a);
 const translated=image.map(p=>({x:p.x*.6+.1,y:p.y*.6+.2}));
 const b=measureThumb(translated,world,1);assert.ok(b);
 a.point.forEach((v,i)=>assert.ok(Math.abs(v-b.point[i])<1e-10));
 const depth=world.map((p,i)=>({...p,z:i===4?.08:p.z}));
 assert.deepEqual(measureThumb(image,depth,1).point,a.point);
 const up=image.map(p=>({...p}));up[4].y-=.03;
 const left=image.map(p=>({...p}));left[4].x+=.03;
 assert.ok(thumbVector(measureThumb(up,world,1).point,a.point).z<0);
 assert.ok(thumbVector(measureThumb(left,world,1).point,a.point).x<0);
});
test('stale held input stops even without another tracker result',()=>{
 const c=ready();c.receive(s(.5),200);c.receive(s(.5),280);
 assert.ok(c.step(300,.02).dx>0);assert.deepEqual(c.step(531,.02),{dx:0,dz:0});
});

test('fist release establishes a fresh centre without rightward drift',()=>{
 const c=ready();c.receive(s(.5),200);c.receive(s(.5),280);
 c.receive(s(0,0,true),300);assert.deepEqual(c.centre,[0,0]);
 for(let t=340;t<=740;t+=100){c.receive(s(.6,0,true),t);assert.deepEqual(c.step(t),{dx:0,dz:0});}
 assert.deepEqual(c.centre,[.6,0]);
 c.receive(s(.6),780);assert.equal(c.direction,null);
 c.receive(s(.1),820);c.receive(s(.1),900);assert.equal(c.direction,'LEFT');
});
test('small rightward offset remains neutral instead of latching movement',()=>{
 const c=ready();for(let t=40;t<4000;t+=40){c.receive(s(.16+Math.sin(t)*.01),t);assert.deepEqual(c.step(t),{dx:0,dz:0});}
});
test('moving output can decrease through the wobble filter and reach zero',()=>{
 const c=ready();c.receive(s(.5),100);c.receive(s(.5),180);
 const start=c.x;c.receive(s(.48),220);assert.ok(c.x<start);
 for(let t=260;t<=980;t+=40)c.receive(s(Math.max(.12,.48-(t-220)*.0005)),t);
 assert.deepEqual(c.step(980),{dx:0,dz:0});
});

test('a steering pose cannot be captured as the initial resting fist',()=>{
 const c=new ThumbJoystick();for(let t=0;t<1000;t+=50){c.receive(s(.6),t);assert.equal(c.centre,null);assert.deepEqual(c.step(t),{dx:0,dz:0});}
 for(let t=1000;t<=1400;t+=100)c.receive(s(.2,.3,true),t);
 assert.deepEqual(c.centre,[.2,.3]);
 c.receive(s(.7,.3),1440);c.receive(s(.7,.3),1520);assert.equal(c.direction,'RIGHT');
 c.receive(s(.2,.3),1560);assert.deepEqual(c.step(1560),{dx:0,dz:0});
});
test('unsteady or interrupted fist capture cannot arm movement',()=>{
 const c=new ThumbJoystick();for(let t=0;t<1000;t+=100)c.receive(s(t%200?1:0,0,true),t);
 assert.equal(c.centre,null);c.receive(s(0,0,true),1000);c.receive(s(),1100);c.receive(s(0,0,true),1200);assert.equal(c.centre,null);
});
