import * as THREE from 'three';
import {MovementController,measureHand} from './controller.mjs';
const $=id=>document.getElementById(id), controller=new MovementController();
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
const scene=new THREE.Scene();scene.background=new THREE.Color('#111b25');scene.fog=new THREE.FogExp2('#111b25',.025);
const camera=new THREE.PerspectiveCamera(65,1,.05,200);camera.position.set(0,1.65,7);
const grid=new THREE.GridHelper(240,120,0x688b83,0x2a4147);scene.add(grid);
scene.add(new THREE.HemisphereLight(0xd5f0ec,0x14252c,2));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x17272e,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
for(let z=-70;z<=30;z+=10)for(const x of [-7,7]){
 const p=new THREE.Mesh(new THREE.BoxGeometry(.18,3,.18),new THREE.MeshStandardMaterial({color:0x799f94,roughness:.7}));p.position.set(x,1.5,z);scene.add(p);
 const dot=new THREE.Mesh(new THREE.BoxGeometry(.2,.06,.2),new THREE.MeshBasicMaterial({color:0xc6efd1}));dot.position.set(x,2.8,z);scene.add(dot);
}
const marker=new THREE.Mesh(new THREE.TorusGeometry(.75,.018,8,80),new THREE.MeshBasicMaterial({color:0xbbe7d0}));marker.position.set(0,1.65,-18);scene.add(marker);
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
let worker=null,stream=null,running=false,busy=false,lastVideo=-1,lastResult=0,demo=false,demoRun=null;
function status(text,active=false){$('status').textContent=text;$('lamp').classList.toggle('on',active);}
function apply(sample,time){const r=controller.update(sample,time);camera.position.x+=r.dx;camera.position.z+=r.dz;status(r.status,r.active);return r;}
function stop(){running=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('cam').srcObject=null;controller.reset();$('start').textContent='Start camera';}
async function start(){
 if(running){stop();status('Paused · camera off');return;}
 stop();demo=false;demoRun=null;$('demoControls').classList.remove('visible');$('error').textContent='';$('start').disabled=true;status('Starting camera…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access needs HTTPS or localhost.');
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60}}});
  $('cam').srcObject=stream;await $('cam').play();status('Loading motion tracking…');
  worker=new Worker(new URL('./tracker.mjs',import.meta.url),{type:'module'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tracker loading timed out. Check your connection and retry.')),45000);worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.postMessage({type:'init'});});
  worker.onerror=e=>{stop();status('Tracking stopped');$('error').textContent=e.message;};
  worker.onmessage=({data})=>{busy=false;if(data.type==='error'){stop();status('Tracking stopped');$('error').textContent=data.message;return;}if(data.type!=='result')return;
    lastResult=performance.now();if(lastResult-data.time>220){apply(null,lastResult);status('Tracking is delayed · movement paused');return;}
    const sample=data.landmarks?.length===1?measureHand(data.landmarks[0],data.worldLandmarks[0],$('cam').videoWidth/$('cam').videoHeight):null;
    apply(sample,data.time);if(data.landmarks?.length>1)status('Use one hand to move');
  };
  lastVideo=-1;running=true;lastResult=performance.now();$('start').textContent='Stop camera';status('Show one hand');
 }catch(e){stop();status('Camera not started');$('error').textContent=e.name==='NotAllowedError'?'Camera access was declined. Allow camera access in your browser, then retry.':e.message;}
 finally{$('start').disabled=false;}
}
$('start').onclick=start;
$('reset').onclick=()=>{camera.position.set(0,1.65,7);controller.reset();demoRun=null;status('Position reset · grab again');};
$('mode').onchange=()=>{controller.mode=$('mode').value;controller.reset();$('hint').textContent=controller.mode==='pinch'?'Pinch to grab. Slide left or right. Push toward the camera to go backward; pull toward you to go forward. Release to stop and reposition.':'Extend your index finger to move. Slide left or right. Push toward the camera to go backward; pull toward you to go forward. Fold the finger to stop and reposition.';};
$('gain').oninput=()=>controller.gain=+$('gain').value;
$('reverse').onchange=()=>{controller.reverse=$('reverse').checked;controller.reset();};
$('demo').onclick=()=>{stop();demo=true;demoRun=null;$('demoControls').classList.add('visible');status('Demo · choose a movement below');};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{controller.reset();demoRun={direction:b.dataset.demo,start:performance.now()};});
document.addEventListener('visibilitychange',()=>{controller.reset();demoRun=null;if(document.hidden&&running)stop();});
addEventListener('pagehide',stop);
function frame(now){
 requestAnimationFrame(frame);
 if(demo&&demoRun){const elapsed=now-demoRun.start,t=Math.max(0,Math.min(1,(elapsed-180)/650));const d=demoRun.direction;apply({x:.5+(d==='right'?.25:d==='left'?-.25:0)*t,z:.5+(d==='forward'?.18:d==='backward'?-.18:0)*t,pinch:.2,extended:true},now);if(elapsed>1050){demoRun=null;controller.reset();status('Demo complete · choose another movement');}}
 if(running){
  if(now-lastResult>220){controller.reset();status('Waiting for tracking');}
  const v=$('cam');if(!busy&&v.readyState>=2&&v.currentTime!==lastVideo){lastVideo=v.currentTime;busy=true;const capture=now,owner=worker;createImageBitmap(v).then(bitmap=>{if(worker!==owner||!running){bitmap.close();return;}owner.postMessage({type:'frame',bitmap,time:capture},[bitmap]);}).catch(e=>{busy=false;controller.reset();status('Frame unavailable');$('error').textContent=e.message;});}
 }
 $('position').innerHTML=`X ${camera.position.x.toFixed(2)} m<br>Z ${(camera.position.z-7).toFixed(2)} m`;
 renderer.render(scene,camera);
}requestAnimationFrame(frame);
