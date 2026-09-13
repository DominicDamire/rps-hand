import assert from 'node:assert/strict';
import {fitExtendedFinger} from './finger-image-fit.mjs';
const norm=v=>Math.hypot(...v),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const f=.866,aspect=9/16;
function fixture(sign,turn){
 const base=[sign*.095,0,-.6],correct=[base,...[.04,.07,.095].map(length=>[base[0]-sign*length,0,-.6])];
 const angle=turn*Math.PI/180,chain=correct.map(p=>{const dx=p[0]-base[0];return [base[0]+Math.cos(angle)*dx,0,-.6-Math.sin(angle)*dx];});
 const lm=Array.from({length:21},()=>({x:.5,y:.5}));
 const project=p=>({x:.5+f*p[0]/-p[2]/aspect,y:.5-f*p[1]/-p[2]});
 for(let i=0;i<4;i++)lm[5+i]=project(correct[i]);
 lm[0]=project([base[0],-.08,-.6]);lm[9]=project(base);
 return {chain,lm,correct};
}
let count=0;
for(const sign of [-1,1])for(const turn of [-20,-10,10,20]){
 const {chain,lm,correct}=fixture(sign,turn),fit=fitExtendedFinger(chain,lm,5,aspect,f);assert.ok(fit);
 assert.ok(fit.after<fit.before*.01);assert.ok(norm(sub(fit.points[3],correct[3]))<1e-8,'separate hands recover touching image tips without a contact constraint');
 assert.ok(norm(sub(fit.points[0],chain[0]))<1e-12,'MCP attachment fixed');
 for(let k=0;k<3;k++)assert.ok(Math.abs(norm(sub(fit.points[k+1],fit.points[k]))-norm(sub(chain[k+1],chain[k])))<1e-12);
 count++;
}
const {chain,lm}=fixture(-1,10);
const bent=chain.map(p=>[...p]);bent[2]=[bent[1][0],.025,-.6];bent[3]=[bent[1][0]-.02,.025,-.6];
assert.equal(fitExtendedFinger(bent,lm,5,aspect,f),null,'do not refit a fist');
const unreachable=lm.map(p=>({...p}));unreachable[8]={x:2,y:.5};assert.equal(fitExtendedFinger(chain,unreachable,5,aspect,f),null,'no stretching to impossible target');
assert.equal(fitExtendedFinger(chain,[],5,aspect,f),null);
console.log(`PASS: ${count} independently fitted extended fingers, unchanged lengths/MCPs, fist preservation and unreachable target`);
