import assert from 'node:assert/strict';
import {phoneCameraURL} from './phone-url.mjs';
const id='handlab-00000000-0000-0000-0000-000000000000';
for(const base of ['http://127.0.0.1:8788/hand-video-depth/video-link.mjs','http://localhost:8776/hand-video-depth/video-link.mjs','https://d14life.github.io/rps-hand/hand-video-depth/video-link.mjs']){
 const u=phoneCameraURL(base,id,'1080');assert.equal(u.origin,'https://d14life.github.io');assert.equal(u.pathname,'/rps-hand/hand-video-depth/video-camera.html');assert.equal(u.searchParams.get('pair'),id);assert.equal(u.searchParams.get('quality'),'1080');
}
// Exercise the receiver's real event path: answering a phone call needs no
// getUserMedia call and delivers the same remote MediaStream to the consumer.
let peer,received,cameraRequests=0;
globalThis.window={Peer:true,QRCode:true};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia(){cameraRequests++;throw Error('PC webcam must not open');}}},configurable:true});
const nodes=new Map();const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',href:'',value:'720'});return nodes.get(selector);};
globalThis.document={getElementById:()=>({value:'720'}),body:{append(){}},createElement:()=>({querySelector:node,showModal(){},close(){},remove(){}})};
globalThis.Peer=class{constructor(){peer=this;this.events={};}on(n,fn){this.events[n]=fn;}destroy(){}};
globalThis.QRCode=class{static CorrectLevel={M:0};constructor(el,options){assert.ok(options.text.startsWith('https://'));}};
const {receivePhone}=await import('./video-link.mjs');
const close=receivePhone(s=>received=s,()=>{},()=>{});
// URL helper is independently tested above; import.meta.url here is a Node file.
const events={};let answered=false;
peer.events.call({answer(){answered=true;},on(n,fn){events[n]=fn;},close(){}});
const remote={getTracks:()=>[]};events.stream(remote);
assert.equal(answered,true);assert.equal(received,remote);assert.equal(cameraRequests,0);close();
console.log('PASS: local/public QR targets public HTTPS; phone stream received without PC camera access');
