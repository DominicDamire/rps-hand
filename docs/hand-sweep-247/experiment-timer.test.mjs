import assert from 'node:assert/strict';import {installExperiment} from './experiment.mjs';let now=0,timer=null;globalThis.performance={now:()=>now};globalThis.setInterval=f=>(timer=f,1);globalThis.clearInterval=()=>timer=null;const nodes=new Map();let html='';const node=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,value:0,textContent:''});return nodes.get(id);};globalThis.document={createElement:()=>({style:{},set innerHTML(s){html=s;},querySelector:s=>node(s.slice(1))})};const api=installExperiment({container:{prepend(){}},getHead:()=>null});assert.ok(!html.includes('touchDistance')&&!html.includes('touchAnchor')&&!html.includes('touchValidate'));node('touchSweep').onclick();assert.match(node('touchStatus').textContent,/Starting in 5/);now=5000;timer();assert.match(node('touchStatus').textContent,/back toward your shoulder/);now=13000;timer();assert.equal(timer,null);assert.equal(node('touchProgress').value,8);assert.equal(node('touchSweep').disabled,false);node('touchSweep').onclick();api.cancel();assert.equal(timer,null);node('touchReset').onclick();assert.equal(api.active,false);console.log('PASS: no centimetres/anchor/validation, five-second preparation, eight-second deadline without tracking and cancellation');


// Use nondegenerate 3D palm geometry: the current fitter rejects coincident points.
const {pairFrame}=await import('./paired-sweep-fixture.mjs');
const {PalmSweepDepth,palmObservation}=await import('./palm-sweep-depth.mjs');
const head={face:{matrix:Array.from({length:16},(_,i)=>i===14?70:0)},seen:0,depth:.7};
let published=null;
const calibrated=installExperiment({container:{prepend(){}},getHead:()=>head,onReference:fit=>published=fit});
now=20000;node('touchSweep').onclick();
for(now=20000;now<33000;now+=100){
 head.seen=now;const z=now<25000?.3:.3+(now-25000)/7900*.35;
 const h=pairFrame(z,now)[0];
 calibrated.observe([h],{L:{result:{points:h.points.map(([x,y,z])=>({x,y,z}))}}},1);timer();
}
timer();assert.equal(calibrated.active,true);assert.equal(published.kind,'palm-sweep');
assert.match(node('touchStatus').textContent,/Sweep saved/);
const saved=JSON.stringify(published);head.depth=1.5;
assert.equal(JSON.stringify(calibrated.fit),saved,'Reference remains frozen after capture');
node('touchSweep').onclick();now+=13000;timer();assert.equal(calibrated.active,true,'Failed recapture keeps previous reference');
const twoHand=installExperiment({container:{prepend(){}},getHead:()=>null});
now=50000;node('pairedSweep').onclick();assert.equal(node('touchSweep').disabled,true);assert.equal(node('pairedSweep').disabled,true);
for(now=50000;now<63000;now+=100){
 const z=now<55000?.3:.3+(now-55000)/7900*.35,hands=pairFrame(z,now);
 const rendered=Object.fromEntries(hands.map(h=>[h.label==='Left'?'L':'R',{result:{points:h.points.map(([x,y,z])=>({x,y,z}))}}]));
 twoHand.observe(hands,rendered,1);timer();
}
timer();assert.equal(twoHand.active,true);assert.match(node('touchStatus').textContent,/Sweep saved/);
const depth=new PalmSweepDepth();
for(const [i,side] of ['L','R'].entries()){
 const h=pairFrame(.45,0)[i];
 const value=depth.update(side,palmObservation(h.landmarks,h.points,1,1),twoHand.fit,.9,0);
 assert.ok(Math.abs(value-.45)<.001,'Shared palm reference recovers the fixture depth for both hands');
}
node('touchReset').onclick();assert.equal(twoHand.active,false);
console.log('PASS: one/two-hand UI capture, frozen reference, failed recapture preservation and measured palm-depth consumer');
