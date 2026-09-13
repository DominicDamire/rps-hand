import {fitWholeHand} from './whole-hand-placement.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitNeckSweep,rearPlaneCorrection,roomDepth} from './neck-sweep.mjs';
import {palmObservation,PalmSweepDepth} from './palm-sweep-depth.mjs';
import {cameraFrame} from './projection.mjs';
const report=JSON.parse(readFileSync(new URL('../doll-report.json',import.meta.url),'utf8'));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),unit=a=>a.map(v=>v/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const ids=[0,5,9,13,17];
function pose({side='L',depth=.6,yaw=0,roll=0,aspect=9/16,viewAspect=16/9,centreY=.5,centreX=.5}={}){
 const at=n=>report.joints[side+n].rest,w=at('Hand'),y=unit(sub(at('Middle1'),w));let x=sub(at('Index1'),at('Pinky1'));x=unit(x.map((v,i)=>v-y[i]*dot(x,y)));const z=cross(x,y);
 const rest=[w];for(const finger of ['Thumb','Index','Middle','Ring','Pinky']){for(let k=1;k<=3;k++)rest.push(at(finger+k));const tip=sub(at(finger+'3'),at(finger+'2'));rest.push(at(finger+'3').map((v,i)=>v+tip[i]*.7));}
 const p=rest.map(r=>{const a=sub(r,w),X=dot(a,x),Y=dot(a,y),Z=dot(a,z),u=Math.cos(yaw)*X+Math.sin(yaw)*Z,v=Y,t=-Math.sin(yaw)*X+Math.cos(yaw)*Z;return [Math.cos(roll)*u-Math.sin(roll)*v,Math.sin(roll)*u+Math.cos(roll)*v,t-depth];});
 const focal=1/(2*Math.tan(Math.PI/6)*cameraFrame(aspect,viewAspect).height),mean=fn=>ids.reduce((a,i)=>a+fn(p[i])/5,0),inv=mean(q=>1/-q[2]);
 const dx=((centreX-.5)*aspect/focal-mean(q=>q[0]/-q[2]))/inv,dy=((.5-centreY)/focal-mean(q=>q[1]/-q[2]))/inv;
 for(const q of p){q[0]+=dx;q[1]+=dy;}
 const landmarks=p.map(([X,Y,Z])=>({x:.5+focal*X/-Z/aspect,y:.5-focal*Y/-Z,z:0}));
 const palm=ids.reduce((a,i)=>a.map((v,k)=>v+p[i][k]/5),[0,0,0]);const neck=palm.map((v,k)=>(v-[.01,-.02,0][k])/1.2);return {points:p,landmarks,focal,aspect,face:{top:.25,bottom:.65,left:.33,right:.67,neckContact:{palm,neck}}};
}
let checks=0,maxError=0;const tracker=new PalmSweepDepth();
for(const side of ['L','R'])for(const aspect of [9/16,4/3,16/9])for(const viewAspect of [16/9,9/16])for(const yaw of [0,.5,1,2.7,Math.PI])for(const roll of [0,Math.PI/2,Math.PI])for(const depth of [.3,.6,1.2]){
 const s=pose({side,aspect,viewAspect,yaw,roll,depth,centreX:.7,centreY:.3});
 // Recreate the bad placement with the correct fixed mesh, then recover depth.
 const p=s.points.map(q=>q.map((v,k)=>v+s.points[0][k]*(.8122656356-1)));
 const o=palmObservation(s.landmarks,p,aspect,s.focal);assert.ok(o.reliable);
 const got=tracker.update(side,o,{scale:.09253574734794362,farDepth:4},.5,checks++);
 maxError=Math.max(maxError,Math.abs(got-depth));assert.ok(Math.abs(got-depth)<1e-9);
 const base=-p[0][2],moved=p.map(q=>q.map((v,k)=>v+p[0][k]*(got-base)/base));
 for(const i of ids){const q=moved[i],actual={x:.5+s.focal*q[0]/-q[2]/aspect,y:.5-s.focal*q[1]/-q[2]};assert.ok(Math.hypot(actual.x-s.landmarks[i].x,actual.y-s.landmarks[i].y)<1e-9,'wrist and four MCPs must reproject without the old 23% oversize');}
}
const samples=Array.from({length:90},(_,i)=>{const t=Math.max(0,Math.min(1,(i-10)/69));return {...pose({depth:.35+.45*t,centreY:.68}),elapsed:(i-10)*100,label:'Left'};});
const {fit,error}=fitNeckSweep(samples);assert.ok(fit,error);assert.equal(fit.kind,'neck-sweep');assert.ok(Math.abs(fit.headScale-Math.sqrt(1.2))<1e-9);assert.ok(Math.abs(fit.depthGain-1/Math.sqrt(1.2))<1e-9);assert.ok(Math.abs(fit.endDepth-.8*fit.handScale)<1e-9);assert.ok(Math.hypot(...fit.headOffset.map((v,k)=>v-[.01,-.02,0][k]*fit.handScale))<1e-9);assert.ok(Math.abs(fit.farDepth-fit.neckDepth-.30)<1e-12);assert.equal(fit.phoneTilt,10);
for(const centreY of [.1,.5,.9])for(const roll of [0,Math.PI/2]){
 const farPoints=pose({depth:1.5,centreY,roll}).points,correction=rearPlaneCorrection(farPoints,fit.farDepth,fit.phoneTilt);assert.ok(correction>0);
 const moved=farPoints.map(p=>p.map((v,i)=>v-farPoints[0][i]*correction/-farPoints[0][2]));
 assert.ok(Math.abs(Math.max(...moved.map(p=>roomDepth(p,fit.phoneTilt)))-fit.farDepth)<1e-12);
 assert.ok(Math.abs(moved[0][0]/moved[0][2]-farPoints[0][0]/farPoints[0][2])<1e-12,'clamp preserves wrist image X');
 assert.ok(Math.abs(moved[0][1]/moved[0][2]-farPoints[0][1]/farPoints[0][2])<1e-12,'clamp preserves wrist image Y');
}
const farPoints=pose({depth:1.2}).points;
assert.equal(rearPlaneCorrection(farPoints,null),0);
const saved=JSON.stringify(fit);
for(const side of ['L','R']){const s=pose({side,depth:.5});assert.ok(Math.abs(new PalmSweepDepth().update(side,palmObservation(s.landmarks,s.points,s.aspect,s.focal),fit,.4,1)-.5)<1e-9);}
assert.equal(JSON.stringify(fit),saved,'live movement never refits calibration');
assert.match(fitNeckSweep(samples.map(s=>({...s,face:null}))).error,/face visible/);
assert.match(fitNeckSweep(samples.map(s=>({...pose({depth:.4,centreY:.5}),elapsed:s.elapsed}))).error,/farther/);
assert.match(fitNeckSweep(samples.filter(s=>s.elapsed<7000)).error,/endpoints/);
assert.match(fitNeckSweep(samples.filter(s=>s.elapsed>=1000)).error,/endpoints/);
assert.match(fitNeckSweep(samples.map(s=>s.elapsed>=7000?{...s,aspect:4/3}:s)).error,/framing changed/);
console.log(`PASS: ${checks} real-doll geometry cases, upright/sideways/flipped, portrait/landscape, max depth error ${maxError}; saved scale regression and wrist/MCP reprojection`);
console.log('PASS: front-to-neck endpoint without upward movement, both hands, frozen neck depth gain, 10-degree tilted rear plane, missing face/start/end, stationary path, framing change and fixed calibration');

const tilted={...fit,farDepth:.55};const atHigh=pose({depth:.56,centreY:.08});const o=palmObservation(atHigh.landmarks,atHigh.points,atHigh.aspect,atHigh.focal);assert.ok(Math.abs(new PalmSweepDepth().update('L',o,tilted,.4,1)-.56)<1e-9,'tilted plane must not also clamp raw camera Z');

const angle=10*Math.PI/180;
for(const height of [-.5,0,.5]){
 const depth=.9,p=[0,Math.cos(angle)*height-Math.sin(angle)*depth,-Math.sin(angle)*height-Math.cos(angle)*depth];
 assert.ok(Math.abs(roomDepth(p,10)-depth)<1e-12,'10-degree camera coordinates must recover a constant upright-room depth across heights');
}
console.log('PASS: assumed upward camera pitch transforms consistently across heights without image scaling');

assert.ok(Math.abs(fit.depthGain-1/Math.sqrt(1.2))<1e-9);assert.match(fitNeckSweep(samples.map(s=>({...s,face:{...s.face,neckContact:null}}))).error,/neck observations/);

const endSample=samples.at(-1),endObservation=palmObservation(endSample.landmarks,endSample.points,endSample.aspect,endSample.focal);
assert.ok(Math.abs(new PalmSweepDepth().update('L',endObservation,fit,.5,1)-.8)<1e-9,'finishing wrist preserves geometry depth');
for(const yaw of [0,.4,1,Math.PI])for(const side of ['L','R']){
 const a=pose({side,depth:.4,yaw}),b=pose({side,depth:.8,yaw});const t=new PalmSweepDepth();
 const near=t.update(side,palmObservation(a.landmarks,a.points,a.aspect,a.focal),fit,.5,1),far=t.update(side,palmObservation(b.landmarks,b.points,b.aspect,b.focal),fit,.5,2);
 assert.ok(Math.abs(far/near-2)<1e-9,'frozen neck anchor preserves the inverse-size distance ratio across hands and rotations');
}
console.log('PASS: full-bust contact fit recovers depth/XY while jointly scaling hand depth and geometry to preserve projection');

for(const row of samples.slice(-10)){const {neck,palm}=row.face.neckContact;const placed=neck.map((v,k)=>v*fit.headScale+fit.headOffset[k]);assert.ok(Math.hypot(...placed.map((v,k)=>v-fit.handScale*palm[k]))<1e-9,'neck must meet palm in all three axes without moving hands');}

const unstable=samples.map((s,i)=>({...s,face:{...s.face,neckContact:{...s.face.neckContact,palm:s.face.neckContact.palm.map((v,k)=>v+(k===0?(i%2?.1:-.1):0))}}}));
assert.match(fitNeckSweep(unstable).error,/moved too much/);

assert.ok(fit.handScale!==1&&fit.headScale!==1,'both hands and head must participate in calibration');
for(const side of ['L','R'])for(const depth of [.3,.8])for(const yaw of [0,.8,Math.PI]){
 const row=pose({side,depth,yaw});for(const p of row.points){const q=p.map(v=>v*fit.handScale);assert.ok(Math.abs(q[0]/q[2]-p[0]/p[2])<1e-12&&Math.abs(q[1]/q[2]-p[1]/p[2])<1e-12,'joint depth/geometry scale preserves every fingertip projection');}
}

let wholeCases=0;
for(const side of ['L','R'])for(const depth of [.4,.8,1.2])for(const yaw of [0,.5,1,Math.PI])for(const roll of [0,Math.PI/2]){
 const row=pose({side,depth,yaw,roll,aspect:4/3}),wrong=row.points.map(p=>p.map((v,k)=>v+[.02,-.03,0][k]));
 const delta=fitWholeHand(wrong,row.landmarks,row.aspect,row.focal);assert.ok(delta,'whole hand fit must be solvable');
 assert.ok(Math.hypot(...delta.map((v,k)=>v+[.02,-.03,0][k]))<1e-8,'recover XYZ from all hand landmarks');wholeCases++;
}
const whole=pose({aspect:4/3,depth:.7}),altered=whole.landmarks.map((p,i)=>i===8?{...p,x:p.x+.1}:p);
assert.ok(Math.hypot(...fitWholeHand(whole.points,altered,whole.aspect,whole.focal))<.02,'single bad tip must not move the whole hand over 2 cm in this fixture');
assert.equal(fitWholeHand(whole.points,whole.landmarks.slice(0,10),whole.aspect,whole.focal),null);
console.log('PASS: '+wholeCases+' whole-hand fixed-depth XY fits, invalid-input fallback and fingertip outlier handling');

// Gesture mismatch: keep wrist/base knuckles fixed while observed distal
// fingers collapse into a fist. Their changing image extent cannot alter Z.
const stable=pose({aspect:4/3,depth:.7}),palmIds=new Set([0,5,9,13,17]);
for(const amount of [0,.25,.5,.75,1]){const landmarks=stable.landmarks.map((p,i)=>{if(palmIds.has(i))return p;const base=stable.landmarks[1+4*Math.floor((i-1)/4)];return {...p,x:p.x*(1-amount)+base.x*amount,y:p.y*(1-amount)+base.y*amount};});
 const correction=fitWholeHand(stable.points,landmarks,stable.aspect,stable.focal);assert.ok(correction);assert.equal(correction[2],0,'finger curl cannot move whole-hand depth');
 const obs=palmObservation(landmarks,stable.points,stable.aspect,stable.focal);assert.ok(Math.abs(new PalmSweepDepth().update('L',obs,fit,.5,amount)-.7)<1e-9,'unchanged palm preserves depth despite finger extent changes');
}
console.log('PASS: open-to-fist landmark mismatch cannot change depth when palm input is fixed');
