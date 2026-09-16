import test from 'node:test';
import assert from 'node:assert/strict';
import {BodyGunState} from './gun-state.mjs';
const cfg={pickMs:250,dropMs:200,aimEnabled:true,aimEnter:.24,aimExit:.32,depthEnter:.18,depthExit:.26};
function fixture(){const s=new BodyGunState();let time=0;return {s,send:o=>s.step({time:time+=100,valid:true,near:true,lookingDown:true,open:false,grip:true,indexFree:true,eyeDistance:1,eyeDepth:1,...o},cfg)};}
function pick(f){f.send({open:true,grip:false});for(let i=0;i<4;i++)f.send({});assert.equal(f.s.held,true);}
test('fist away from gun cannot pick up',()=>{const f=fixture();for(let i=0;i<10;i++)f.send({near:false});assert.equal(f.s.held,false);});
test('nearby fist picks up without open approach, head nod or free index',()=>{const f=fixture();for(let i=0;i<4;i++)f.send({lookingDown:false,indexFree:false});assert.equal(f.s.held,true);});
test('open hand does not pick up and leaving resets confirmation',()=>{const f=fixture();for(let i=0;i<8;i++)f.send({open:true,grip:false});assert.equal(f.s.held,false);f.send({});f.send({near:false});for(let i=0;i<3;i++)f.send({});assert.equal(f.s.held,false);f.send({});assert.equal(f.s.held,true);});

test('aim includes depth and hysteresis',()=>{const f=fixture();pick(f);f.send({eyeDistance:.2,eyeDepth:.3});assert.equal(f.s.aim,false);f.send({eyeDistance:.2,eyeDepth:.1});assert.equal(f.s.aim,true);f.send({eyeDistance:.28,eyeDepth:.2});assert.equal(f.s.aim,true);f.send({eyeDistance:.34,eyeDepth:.1});assert.equal(f.s.aim,false);});
test('release requires sustained loss of grip and regrab works with nearby fist',()=>{const f=fixture();pick(f);f.send({grip:false});f.send({});assert.equal(f.s.held,true);for(let i=0;i<3;i++)f.send({grip:false});assert.equal(f.s.held,false);for(let i=0;i<4;i++)f.send({});assert.equal(f.s.held,true);});
test('tracking loss cancels aim, then returns gun after grace period',()=>{const f=fixture();pick(f);f.send({eyeDistance:.2,eyeDepth:.1});f.send({valid:false});assert.equal(f.s.aim,false);assert.equal(f.s.held,true);for(let i=0;i<8;i++)f.send({valid:false});assert.equal(f.s.held,false);});
