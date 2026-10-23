import assert from 'node:assert/strict';
import {phoneCameraURL} from '../shared-phone/phone-url.mjs';
const id='handlab-00000000-0000-0000-0000-000000000000';
for(const base of ['http://127.0.0.1:8788/shared-phone/video-link.mjs','http://localhost:8776/shared-phone/video-link.mjs','https://dominicdamire.github.io/rps-hand/shared-phone/video-link.mjs']){
 const u=phoneCameraURL(base,id,'1080');assert.equal(u.origin,'https://dominicdamire.github.io');assert.equal(u.pathname,'/rps-hand/hand-pnp-photo/video-camera.html');assert.equal(u.searchParams.get('pair'),id);assert.equal(u.searchParams.get('quality'),'1080');
}
let peer,received,cameraRequests=0,channel;
globalThis.window={Peer:true,QRCode:true};globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
globalThis.BroadcastChannel=class{constructor(){channel=this;}postMessage(){}close(){this.closed=true;}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia(){cameraRequests++;throw Error('PC webcam must not open');}}},configurable:true});
const nodes=new Map();const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',href:'',value:'720',style:{setProperty(){}}});return nodes.get(selector);};
globalThis.document={getElementById:()=>({value:'720'}),body:{append(){}},createElement:()=>({querySelector:node,showModal(){},close(){},remove(){}})};
globalThis.Peer=class{constructor(){peer=this;this.events={};}on(n,fn){this.events[n]=fn;}destroy(){this.destroyed=true;}};
globalThis.QRCode=class{static CorrectLevel={M:0};constructor(el,options){assert.ok(options.text.startsWith('https://'));}};
const {receivePhone,sendPhone}=await import('./video-link.mjs');
const close=receivePhone(s=>received=s,()=>{},()=>{});
await new Promise(r=>setTimeout(r,400));
const events={};let answered=false;
peer.events.call({answer(){answered=true;},on(n,fn){events[n]=fn;},close(){}});
const remote={getTracks:()=>[]};events.stream(remote);
assert.equal(answered,true);assert.equal(received,remote);assert.equal(cameraRequests,0);close();assert.equal(channel.closed,true);
let stopped=0,lastStatus='';
navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){stopped++;}}]});
const video={play:async()=>{}};const finish=await sendPhone(id,video,t=>lastStatus=t);
peer.events.error({type:'peer-unavailable'});
assert.equal(stopped,0,'Transient pairing loss retains camera for automatic reconnect');
assert.match(lastStatus,/reconnecting automatically/);
finish();finish();assert.equal(stopped,1);assert.equal(video.srcObject,null);assert.equal(peer.destroyed,true);
console.log('PASS: public HTTPS QR, receiving without local camera, transient reconnect and idempotent cleanup');
