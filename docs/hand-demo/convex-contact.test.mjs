import assert from 'node:assert/strict';import {convexPenetration} from './convex-contact.mjs';
function box(cx,cy,cz,r=.5,angle=0){const c=Math.cos(angle),s=Math.sin(angle),rotate=([x,y,z])=>[x*c-y*s,x*s+y*c,z];return {vertices:[-r,r].flatMap(x=>[-r,r].flatMap(y=>[-r,r].map(z=>rotate([x,y,z]).map((v,i)=>v+[cx,cy,cz][i])))),normals:[[1,0,0],[0,1,0],[0,0,1]].map(rotate)};}
for(const angle of [0,.2,.6,1.1])for(const center of [[.7,0,0],[0,.7,0],[.3,.3,.3],[0,0,0]]){const A=box(0,0,0,.5,angle),B=box(...center),hit=convexPenetration(A,B);assert.ok(hit,'overlapping solids detected');const moved={...A,vertices:A.vertices.map(p=>p.map((v,i)=>v+hit.delta[i]))};assert.equal(convexPenetration(moved,B),null,'correction separates the outer shells');}
assert.equal(convexPenetration(box(0,0,0),box(2,0,0)),null);
assert.equal(convexPenetration(box(0,0,0),box(1,0,0)),null,'touching is not penetration');
console.log('PASS: outer convex shells, rotated contact, containment, separation and touching boundary');
