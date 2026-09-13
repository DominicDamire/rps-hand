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
 return {points:p,landmarks,focal,aspect,face:{top:.25,bottom:.65,left:.33,right:.67}};
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
const {fit,error}=fitNeckSweep(samples);assert.ok(fit,error);assert.equal(fit.kind,'neck-sweep');assert.equal(fit.scale,undefined,'capture must not introduce an independently fitted scale');assert.ok(fit.endDepth>.79&&fit.endDepth<.81);assert.ok(Math.abs(fit.farDepth-fit.neckDepth-.30)<1e-12);assert.equal(fit.phoneTilt,10);
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
console.log('PASS: front-to-neck endpoint without upward movement, both hands, no free scale, 10-degree tilted rear plane, missing face/start/end, stationary path, framing change and fixed calibration');

const tilted={...fit,farDepth:.55};const atHigh=pose({depth:.56,centreY:.08});const o=palmObservation(atHigh.landmarks,atHigh.points,atHigh.aspect,atHigh.focal);assert.ok(Math.abs(new PalmSweepDepth().update('L',o,tilted,.4,1)-.56)<1e-9,'tilted plane must not also clamp raw camera Z');

const angle=10*Math.PI/180;
for(const height of [-.5,0,.5]){
 const depth=.9,p=[0,Math.cos(angle)*height-Math.sin(angle)*depth,-Math.sin(angle)*height-Math.cos(angle)*depth];
 assert.ok(Math.abs(roomDepth(p,10)-depth)<1e-12,'10-degree camera coordinates must recover a constant upright-room depth across heights');
}
console.log('PASS: assumed upward camera pitch transforms consistently across heights without image scaling');
