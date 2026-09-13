import assert from 'node:assert/strict';import {installExperiment} from './experiment.mjs';let now=0,timer=null;globalThis.performance={now:()=>now};globalThis.setInterval=f=>(timer=f,1);globalThis.clearInterval=()=>timer=null;const nodes=new Map();let html='';const node=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,value:0,textContent:''});return nodes.get(id);};globalThis.document={createElement:()=>({style:{},set innerHTML(s){html=s;},querySelector:s=>node(s.slice(1))})};const api=installExperiment({container:{prepend(){}},getHead:()=>null});assert.ok(!html.includes('touchDistance')&&!html.includes('touchAnchor')&&!html.includes('touchValidate'));node('touchSweep').onclick();assert.match(node('touchStatus').textContent,/Starting in 5/);now=5000;timer();assert.match(node('touchStatus').textContent,/back toward your shoulder/);now=13000;timer();assert.equal(timer,null);assert.equal(node('touchProgress').value,8);assert.equal(node('touchSweep').disabled,false);node('touchSweep').onclick();api.cancel();assert.equal(timer,null);node('touchReset').onclick();assert.equal(api.active,false);console.log('PASS: no centimetres/anchor/validation, five-second preparation, eight-second deadline without tracking and cancellation');

// Capture with a nonzero manual offset must not apply it twice after fitting.
const imageHand=scale=>Array.from({length:21},(_,i)=>({x:.4+(i%5)*.02*scale,y:.4+Math.floor(i/5)*.02*scale,z:0}));
const head={face:{matrix:Array.from({length:16},(_,i)=>i===14?70:0)},seen:0,depth:.7};
const calibrated=installExperiment({container:{prepend(){}},getHead:()=>head,getHandDistance:()=>10});
now=20000;node('touchSweep').onclick();
for(now=20000;now<33000;now+=100){
 head.seen=now;const scale=now<25000?2:2-(now-25000)/7900;
 calibrated.observe([{label:'Left',seen:now,time:now,confidence:.95,landmarks:imageHand(scale)}],{L:{result:{points:Array.from({length:21},()=>({z:-.4}))}}},1);timer();
}
timer();assert.equal(calibrated.active,true);assert.match(node('touchStatus').textContent,/ACTIVE for both hands/);
assert.ok(Math.abs(calibrated.depth('L',imageHand(2),null,.5,1)+.1-.4)<1e-9,'capture preserves displayed start with manual offset applied once');
const locked=calibrated.depth('R',imageHand(1.5),null,.5,1);head.depth=1.5;
assert.equal(calibrated.depth('R',imageHand(1.5),null,.5,1),locked,'head movement after capture cannot change either hand depth');
node('touchSweep').onclick();now+=13000;timer();assert.equal(calibrated.active,true,'failed recapture keeps previous valid mapping');
console.log('PASS: capture activation, shared mapping, independent head movement and no double manual offset');
