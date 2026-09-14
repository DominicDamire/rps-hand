import assert from 'node:assert/strict';
import {straightenReference,neutralDirections,applyNeutral} from './straight-reference.mjs';
const p=[[0,0,0]];for(let f=0;f<5;f++)for(let k=0;k<4;k++)p.push([.5-f*.2+k*.01,.4+k*.22,.01*k*k]);
const target=straightenReference(p.map(v=>v.slice(0,2))).map(v=>[...v,0]);
const ref=neutralDirections(p,'R'),desired=neutralDirections(target,'R'),fixed=applyNeutral(p,'R',ref,desired);
const near=(a,b)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-9);
for(const base of [1,5,9,13,17]){near(fixed[base],p[base]);for(let k=1;k<3;k++){const a=fixed[base+k].map((v,i)=>v-fixed[base+k-1][i]),b=fixed[base+k+1].map((v,i)=>v-fixed[base+k][i]);near(a.map(v=>v/Math.hypot(...a)),b.map(v=>v/Math.hypot(...b)));}}
for(let i=0;i<15;i++)near(neutralDirections(fixed,'R')[i],desired[i]);
const mirror=p.map(([x,y,z])=>[-x,y,z]),mirrorTarget=target.map(([x,y,z])=>[-x,y,z]);const mirrored=applyNeutral(mirror,'L',ref,neutralDirections(mirrorTarget,'L'));mirrored.forEach((v,i)=>near(v,[-fixed[i][0],fixed[i][1],fixed[i][2]]));
// Palm-space offsets commute with camera rotation and translation.
const move=([x,y,z])=>[z+3,y-2,-x-4],moved=applyNeutral(p.map(move),'R',ref,desired);moved.forEach((v,i)=>near(v,move(fixed[i])));
const bent=p.map(v=>[...v]);bent[8][2]+=.15;const response=neutralDirections(applyNeutral(bent,'R',ref,desired),'R');assert.ok(Math.abs(response[5][2]-desired[5][2])>.1);
assert.equal(applyNeutral(p,'R',null,desired),p);
for(const base of [1,5,9,13,17])for(let k=0;k<3;k++){const length=a=>Math.hypot(...a[base+k+1].map((v,i)=>v-a[base+k][i]));assert.ok(Math.abs(length(p)-length(fixed))<1e-9);}
console.log('PASS: all five fingers straight, fixed roots/lengths, mirrored hands, camera-pose invariance, subsequent bending, disabled identity.');
