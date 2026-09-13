import assert from 'node:assert/strict';
import {installExperiment} from './experiment.mjs';
let now=0,timer=null;
globalThis.performance={now:()=>now};globalThis.setInterval=fn=>(timer=fn,1);globalThis.clearInterval=()=>timer=null;
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='touchDistance'?35:0,checked:false,disabled:false,textContent:''});return elements.get(id);};
globalThis.document={createElement:()=>({style:{},querySelector:s=>el(s.slice(1))}),getElementById:el};
const api=installExperiment({container:{prepend(){}},getHead:()=>{throw Error('Face must not be required');}});
class V{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}clone(){return new V(this.x,this.y,this.z);}sub(p){this.x-=p.x;this.y-=p.y;this.z-=p.z;return this;}toArray(){return [this.x,this.y,this.z];}distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}}
const lm=Array.from({length:21},(_,i)=>({x:.4+(i%5)*.02,y:.4+Math.floor(i/5)*.02}));
const points=Array.from({length:21},(_,i)=>new V(i*.001,i*.002,-.4));const rendered={L:{result:{points}},R:{result:{points}}};
function good(){api.observe(['Left','Right'].map(label=>({label,time:now,seen:now,landmarks:lm})),rendered,1);}
el('touchAnchor').onclick();assert.match(el('touchStatus').textContent,/Starting in 5/);api.observe([],{},1);now=4999;timer();assert.match(el('touchStatus').textContent,/Starting in 1/);
now=5000;timer();for(let i=0;i<20;i++){now+=30;good();}assert.match(el('touchStatus').textContent,/Anchor recorded/);assert.equal(timer,null);
el('touchSweep').onclick();now+=5000;timer();assert.match(el('touchStatus').textContent,/TOWARD YOUR CHEST/);
api.observe([],{},1);now+=4000;timer();assert.match(el('touchStatus').textContent,/BACK TOWARD THE CAMERA/);
now+=4000;timer();assert.equal(timer,null);assert.match(el('touchStatus').textContent,/finished at 8 seconds: 0\/40/);assert.match(el('touchStatus').textContent,/Neither hand detected/);assert.equal(el('touchProgress').value,8);
el('touchSweep').onclick();assert.ok(timer);el('touchReset').onclick();assert.equal(timer,null);assert.equal(el('touchAnchor').disabled,false);
console.log('PASS: 5-second preparation, valid anchor without face, 4-second direction switch, exact 8-second stop without frames, rejection reason and reset cancellation');

// A usable sweep is applied immediately; no third validation capture is needed.
el('touchAnchor').onclick();now+=5000;timer();for(let i=0;i<20;i++){now+=30;good();}
assert.match(el('touchStatus').textContent,/Anchor recorded/);
el('touchSweep').onclick();now+=5000;timer();const sweepStart=now;
for(let i=0;i<100;i++){
 now=sweepStart+i*79;
 const scale=1+Math.abs(50-i)/35;
 const landmarks=lm.map(p=>({x:.4+(p.x-.4)*scale,y:.4+(p.y-.4)*scale}));
 api.observe(['Left','Right'].map(label=>({label,time:now,seen:now,landmarks})),rendered,1);
}
now=sweepStart+8000;timer();assert.equal(timer,null);assert.match(el('touchStatus').textContent,/Calibration applied after one sweep/);
assert.notEqual(api.depth('L',lm,null,.9,1),.9,'fitted depth is active immediately');
el('touchReset').onclick();assert.equal(api.depth('L',lm,null,.9,1),.9,'reset restores base depth');
console.log('PASS: one successful sweep immediately applies calibration, with no independent-validation step; reset restores base depth');
