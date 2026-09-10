import {HeadView} from '../head/HeadView.js';
import * as THREE from 'three';
import {setupUI} from './ui.mjs?v=12';
import {SwipeController,measurePointer,selectLeftHand} from './swipe.mjs?v=12';
const $=id=>document.getElementById(id);
const trackingUI=setupUI();
const swipe=new SwipeController();
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:false});renderer.setPixelRatio(1);
const scene=new THREE.Scene();scene.background=new THREE.Color('#25394a');scene.fog=new THREE.FogExp2('#25394a',.018);
const camera=new THREE.PerspectiveCamera(65,1,.05,200);camera.position.set(0,1.65,7);
const grid=new THREE.GridHelper(240,120,0xa6d2c3,0x52757e);scene.add(grid);
scene.add(new THREE.HemisphereLight(0xd5f0ec,0x14252c,2));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x263e49,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
for(let z=-70;z<=30;z+=10)for(const x of [-7,7]){
 const p=new THREE.Mesh(new THREE.BoxGeometry(.18,3,.18),new THREE.MeshStandardMaterial({color:0x799f94,roughness:.7}));p.position.set(x,1.5,z);scene.add(p);
 const dot=new THREE.Mesh(new THREE.BoxGeometry(.2,.06,.2),new THREE.MeshBasicMaterial({color:0xc6efd1}));dot.position.set(x,2.8,z);scene.add(dot);
}
const marker=new THREE.Mesh(new THREE.TorusGeometry(.75,.018,8,80),new THREE.MeshBasicMaterial({color:0xbbe7d0}));marker.position.set(0,1.65,-18);scene.add(marker);
function box(x,y,z,w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.85}));m.position.set(x,y,z);scene.add(m);}
function sign(text,x,y,z,color,size=5){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#11212e';ctx.fillRect(0,0,512,128);ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 42px system-ui';ctx.fillText(text,256,78);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));sprite.position.set(x,y,z);sprite.scale.set(size,size/4,1);scene.add(sprite);}
box(-3,2,-12,1,4,1,0x59d5ee);box(3,2,-12,1,4,1,0x59d5ee);box(0,4,-12,7,.5,1,0x59d5ee);sign('N · BLUE GATE',0,5.5,-12,'#59d5ee');
for(let i=0;i<4;i++)box(13, (i+1)*.45, -3+i*2,3,(i+1)*.9,1.7,0xffb64e);sign('E · GOLD STEPS',13,5,0,'#ffb64e');
box(0,3,22,3,6,3,0xd88eff);sign('S · VIOLET TOWER',0,7,22,'#d88eff');
for(let i=0;i<3;i++)box(-14,1.5,-3+i*4,2,3,2,0xff7f76);sign('W · RED BLOCKS',-14,5,0,'#ff7f76');
for(let z=-8;z<=16;z+=4){box(0,.025,z,.12,.05,1,0xf6f3c1);sign(String(7-z)+' m',3,.35,z,'#ffffff',1);}
sign('START',0,.5,7,'#a9edc7');
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
let head=null,lastHeadVideo=-1,lastFrameTime=0;
let worker=null,stream=null,running=false,busy=false,lastVideo=-1,lastResult=0,demo=false,demoRun=null;
function status(text,active=false){$('status').textContent=text;$('lamp').classList.toggle('on',active);}
function apply(sample,time){const r=swipe.update(sample,time);const yaw=camera.rotation.y;camera.position.x+=Math.cos(yaw)*r.dx+Math.sin(yaw)*r.dz;camera.position.z+=-Math.sin(yaw)*r.dx+Math.cos(yaw)*r.dz;$('gestureStats').textContent=r.active?'MOVE engaged · relax index to release':'Hands free · movement off';status(r.status,r.active);return r;}
function stop(){head?.worker?.terminate();if(head)clearTimeout(head.timer);head=null;$('headStatus').textContent='Head: camera off';running=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('cam').srcObject=null;swipe.reset();trackingUI.camera(false);$('start').textContent='Start camera';}
async function start(){
 if(running){stop();status('Paused · camera off');return;}
 stop();demo=false;demoRun=null;$('demoControls').classList.remove('visible');$('error').textContent='';$('start').disabled=true;status('Starting camera…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access needs HTTPS or localhost.');
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60}}});
  $('cam').srcObject=stream;await $('cam').play();trackingUI.camera(true);$('previewImage').style.aspectRatio=$('cam').videoWidth+'/'+$('cam').videoHeight;status('Loading motion tracking…');
  worker=new Worker(new URL('./tracker.mjs?v=12',import.meta.url),{type:'module'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tracker loading timed out. Check your connection and retry.')),45000);worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.postMessage({type:'init'});});
  worker.onerror=e=>{stop();status('Tracking stopped');$('error').textContent=e.message;};
  worker.onmessage=({data})=>{busy=false;if(data.type==='error'){stop();status('Tracking stopped');$('error').textContent=data.message;return;}if(data.type!=='result')return;
    lastResult=performance.now();if(lastResult-data.time>500){apply(null,lastResult);trackingUI.clear();status('Tracking is delayed · movement paused');return;}
    const handIndex=selectLeftHand(data);
    const sample=handIndex>=0?measurePointer(data.landmarks[handIndex],data.worldLandmarks[handIndex],$('cam').videoWidth/$('cam').videoHeight):null;
    const movement=apply(sample,data.time);$('gestureStats').textContent=`${movement.active?'LEFT · MOVE ON':'MOVE OFF'} · index ${Math.round((sample?.extension||0)*100)}% · tracker ${Math.round(data.inferenceMs||0)} ms · age ${Math.round(lastResult-data.time)} ms`;
    trackingUI.draw(handIndex>=0?[data.landmarks[handIndex]]:[],$('cam').videoWidth,$('cam').videoHeight,movement.active);
    if(handIndex<0)status('Show your LEFT hand · right hand does not move you');
    if(running&&head?.wantsFrame(lastResult)&&$('cam').currentTime!==lastHeadVideo){lastHeadVideo=$('cam').currentTime;head.capture($('cam'),lastResult);}
  };
  head=new HeadView({mode:$('headEnabled').checked?'first':'off',interval:50,widths:[384,288,512]});head.pose.sensitivity=+$('headGain').value;lastHeadVideo=-1;lastVideo=-1;running=true;lastResult=performance.now();$('start').textContent='Stop camera';status('Show one hand');
 }catch(e){stop();status('Camera not started');$('error').textContent=e.name==='NotAllowedError'?'Camera access was declined. Allow camera access in your browser, then retry.':e.message;}
 finally{$('start').disabled=false;}
}
$('start').onclick=start;
$('centerHead').onclick=()=>{head?.recenter();camera.rotation.set(0,0,0,'YXZ');swipe.reset();};
$('headEnabled').onchange=()=>{if(head)head.mode=$('headEnabled').checked?'first':'off';camera.rotation.set(0,0,0,'YXZ');head?.recenter();};
$('headGain').oninput=()=>{if(head)head.pose.sensitivity=+$('headGain').value;};
$('reset').onclick=()=>{head?.recenter();camera.position.set(0,1.65,7);camera.rotation.set(0,0,0);swipe.reset();demoRun=null;status('View reset · ready');};
function controlsChanged(){swipe.reset();demoRun=null;trackingUI.clear();$('hint').textContent='LEFT index out (a slight bend is fine): move your hand to move. Turn your head to look; tap Center head while facing forward. Other fingers can stay relaxed. sideways = strafe; push toward camera = forward; pull toward yourself = back. Combine them for diagonals. To reset your reach: bend index FIRST, return your hand, then point again. Returning with index out also moves you.';status('Hands free · point deliberately to move');}
$('gain').oninput=()=>swipe.gain=+$('gain').value;
$('reverse').onchange=()=>{swipe.reverse=$('reverse').checked;swipe.reset();};
$('demo').onclick=()=>{stop();demo=true;demoRun=null;$('demoControls').classList.add('visible');status('Demo · choose a movement below');};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{swipe.reset();demoRun={direction:b.dataset.demo,start:performance.now()};});
document.addEventListener('visibilitychange',()=>{swipe.reset();demoRun=null;if(document.hidden&&running)stop();});
addEventListener('pagehide',stop);
function frame(now){
 requestAnimationFrame(frame);
 const dt=lastFrameTime?Math.min(.1,(now-lastFrameTime)/1000):1/60;lastFrameTime=now;
 if(head){const pose=head.update(now,dt);if(pose.seen&&head.mode!=='off')camera.rotation.set(pose.pitch,pose.yaw,0,'YXZ');$('headStatus').textContent=head.status(now)+(head.ready&&!pose.seen&&head.mode!=='off'?' · face the camera':'');}
 if(demo&&demoRun){const elapsed=now-demoRun.start,t=Math.max(0,Math.min(1,(elapsed-180)/180));const d=demoRun.direction;apply({x:.5+(d.includes('right')?.25:d.includes('left')?-.25:0)*t,z:.5+(d.includes('forward')?-.18:d.includes('backward')?.18:0)*t,pinch:.8,extended:true,pointing:true},now);if(elapsed>1050){demoRun=null;apply(null,now);status('Demo complete · choose another movement');}}
 if(running){
  if(now-lastResult>500){swipe.update(null,now);trackingUI.clear();status('Waiting for tracking');}
  const v=$('cam');if(!busy&&!head?.busy&&v.readyState>=2&&v.currentTime!==lastVideo){lastVideo=v.currentTime;busy=true;const capture=now,owner=worker;createImageBitmap(v,{resizeWidth:384,resizeHeight:Math.round(384*v.videoHeight/v.videoWidth),resizeQuality:'low'}).then(bitmap=>{if(worker!==owner||!running){bitmap.close();return;}owner.postMessage({type:'frame',bitmap,time:capture},[bitmap]);}).catch(e=>{busy=false;status('Frame unavailable');$('error').textContent=e.message;});}
 }
 $('position').innerHTML=`${['N','NE','E','SE','S','SW','W','NW'][Math.round(((-camera.rotation.y*180/Math.PI)%360+360)%360/45)%8]} · ${((-camera.rotation.y*180/Math.PI%360+360)%360).toFixed(0)}°<br>X ${camera.position.x.toFixed(1)} · Z ${(camera.position.z-7).toFixed(1)}`;
 renderer.render(scene,camera);
}controlsChanged();requestAnimationFrame(frame);
