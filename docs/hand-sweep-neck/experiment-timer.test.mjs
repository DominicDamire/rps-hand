import assert from 'node:assert/strict';import {installExperiment} from './experiment.mjs';let now=0,timer=null;globalThis.performance={now:()=>now};globalThis.setInterval=f=>(timer=f,1);globalThis.clearInterval=()=>timer=null;const nodes=new Map();let html='';const node=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,value:0,textContent:''});return nodes.get(id);};globalThis.document={createElement:()=>({style:{},set innerHTML(s){html=s;},querySelector:s=>node(s.slice(1))})};const api=installExperiment({container:{prepend(){}},getHead:()=>null});assert.ok(!html.includes('touchDistance')&&!html.includes('touchAnchor')&&!html.includes('touchValidate'));node('touchSweep').onclick();assert.match(node('touchStatus').textContent,/Starting in 5/);now=5000;timer();assert.match(node('touchStatus').textContent,/back toward your shoulder\/neck/);now=13000;timer();assert.equal(timer,null);assert.equal(node('touchProgress').value,8);assert.equal(node('touchSweep').disabled,false);node('touchSweep').onclick();api.cancel();assert.equal(timer,null);node('touchReset').onclick();assert.equal(api.active,false);console.log('PASS: no centimetres/anchor/validation, five-second preparation, eight-second deadline without tracking and cancellation');

// Exercise the real button -> observe -> capture -> activation path.
assert.ok(!html.includes('pairedSweep')&&!html.includes('neck endpoint'));
const head={face:{points:{10:{x:.5,y:.25},152:{x:.5,y:.65},234:{x:.33,y:.45},454:{x:.67,y:.45}}},seen:0};
const refs=[];
const calibrated=installExperiment({container:{prepend(){}},getHead:()=>head,getFocal:()=>1,onReference:fit=>refs.push(fit),getNeckReference:()=>({neck:[0,0,-.65],palm:[.01,-.02,-.8]})});
const template=Array.from({length:21},()=>[0,0,0]);template[5]=[.025,.065,0];template[9]=[0,.075,0];template[13]=[-.02,.07,0];template[17]=[-.04,.055,0];
now=20000;node('touchSweep').onclick();
for(now=20000;now<33000;now+=100){
 head.seen=now;const t=Math.max(0,Math.min(1,(now-25000)/6900)),depth=.35+.45*t,centreY=.68;
 const points=template.map(([x,y,z])=>({x,y:y+(.5-centreY)*depth-.05,z:z-depth})),landmarks=points.map(p=>({x:.5+p.x/depth,y:.5-p.y/depth,z:0}));
 calibrated.observe([{label:'Left',seen:now,time:now,confidence:.95,landmarks}],{L:{result:{points}}},1);timer();
}
timer();assert.equal(calibrated.active,true);assert.match(node('touchStatus').textContent,/Saved for both hands/);assert.equal(refs.length,1);assert.equal(refs[0].kind,'neck-sweep');assert.equal(refs[0].scale,undefined);
const locked=JSON.stringify(calibrated.fit);head.depth=1.5;assert.equal(JSON.stringify(calibrated.fit),locked,'head movement cannot change rear boundary');
node('touchSweep').onclick();now+=13000;timer();assert.equal(calibrated.active,true,'failed recapture retains previous reference');assert.equal(refs.length,1);assert.equal(timer,null);
node('touchReset').onclick();assert.equal(calibrated.active,false);assert.equal(refs.at(-1),null);
console.log('PASS: single capture UI path, endpoint activation for both hands, failed recapture retains reference, independent head movement and reset');

assert.ok(refs[0].headScale>1);assert.ok(refs[0].depthGain<1);assert.equal(refs[0].depthGain,refs[0].handScale);assert.ok(Math.abs(refs[0].headOffset[0]-.01*refs[0].handScale)<1e-9);
