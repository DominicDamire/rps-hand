import assert from 'node:assert/strict';
import {palmObservation,PalmSweepDepth} from './palm-sweep-depth.mjs';
const template=Array.from({length:21},()=>[0,0,0]);
template[5]=[.025,.065,0];template[9]=[0,.075,0];template[13]=[-.02,.07,0];template[17]=[-.04,.055,0];
const focal=.9,aspect=4/3;
function pose(depth,yaw=0,roll=0,x=.03){
 const p=template.map(([X,Y,Z])=>{const u=Math.cos(yaw)*X,v=Y,z=-Math.sin(yaw)*X;return [Math.cos(roll)*u-Math.sin(roll)*v+x,Math.sin(roll)*u+Math.cos(roll)*v-.035,z-depth];});
 const lm=p.map(([X,Y,Z])=>({x:.5+focal*X/-Z/aspect,y:.5-focal*Y/-Z}));
 return {p,lm,o:palmObservation(lm,p,aspect,focal)};
}
const fit={kind:'crown-sweep',farDepth:1,scale:.09253574734794362};const snapshot=JSON.stringify(fit),tracker=new PalmSweepDepth();let frame=0,count=0;
for(const depth of [.19,.28,.44,.61])for(const yaw of [0,.5,1.1,2,2.7,Math.PI])for(const roll of [0,.7,1.8,3.1]){
 const {o}=pose(depth,yaw,roll,depth*.2);assert.ok(o.reliable);const result=tracker.update('L',o,fit,.5,frame++);assert.ok(Math.abs(result-depth)<1e-10,`rotation/translation error ${result-depth}`);count++;
}
assert.equal(JSON.stringify(fit),snapshot,'live updates must not alter calibration');
const good=pose(.4).o;const held=tracker.update('R',good,fit,.5,frame++);assert.equal(tracker.update('R',pose(.4,Math.PI/2).o,fit,2,frame++),held,'edge-on observations hold last reliable depth');
assert.equal(tracker.update('R',null,fit,2,frame++),held,'missing geometry cannot jump depth');
assert.ok(Math.abs(tracker.update('R',pose(.3,Math.PI).o,fit,.5,frame++)-.3)<1e-10,'recover after flip');
assert.equal(tracker.update('L',pose(3).o,fit,.5,frame++),fit.farDepth,'rear boundary');
assert.equal(palmObservation([],[],aspect,focal),null);
console.log(`PASS: ${count} stationary/combined rotations and depths, inverse ratio, fixed coefficients, hold/recovery and rear boundary`);

const t=new PalmSweepDepth();const original=t.update('L',pose(.4).o,fit,.5,10);assert.equal(t.update('L',pose(.2).o,fit,.5,10),original,'same observation must not be updated at render FPS');
console.log('PASS: observation caching and legacy scale ignored');
