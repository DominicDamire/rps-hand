import * as THREE from 'three';
import {MovementController,measureHand} from './controller.mjs?v=3';
import {setupUI} from './ui.mjs?v=3';
import {SwipeController,measurePointer} from './swipe.mjs?v=3';
const $=id=>document.getElementById(id), controller=new MovementController();
controller.mode='index';const trackingUI=setupUI();
const swipe=new SwipeController();let navigation='turn';
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
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
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
let worker=null,stream=null,running=false,busy=false,lastVideo=-1,lastResult=0,demo=false,demoRun=null;
function status(text,active=false){$('status').textContent=text;$('lamp').classList.toggle('on',active);}
function apply(sample,time){const r=navigation==='turn'?swipe.update(sample,time):controller.update(sample,time);if(navigation==='turn'){camera.rotation.y+=r.yaw;$('gestureStats').textContent=`Swipe ${Math.round((r.distance||0)*($('cam').videoWidth||640))} px · ${Math.round((r.speed||0)*($('cam').videoWidth||640))} px/s`;}else{camera.translateX(r.dx);camera.translateZ(r.dz);}status(r.status,r.active);return r;}
function stop(){running=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('cam').srcObject=null;controller.reset();swipe.reset();trackingUI.camera(false);$('start').textContent='Start camera';}
async function start(){
 if(running){stop();status('Paused · camera off');return;}
 stop();demo=false;demoRun=null;$('demoControls').classList.remove('visible');$('error').textContent='';$('start').disabled=true;status('Starting camera…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access needs HTTPS or localhost.');
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60}}});
  $('cam').srcObject=stream;await $('cam').play();trackingUI.camera(true);$('previewImage').style.aspectRatio=$('cam').videoWidth+'/'+$('cam').videoHeight;status('Loading motion tracking…');
  worker=new Worker(new URL('./tracker.mjs',import.meta.url),{type:'module'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tracker loading timed out. Check your connection and retry.')),45000);worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.postMessage({type:'init'});});
  worker.onerror=e=>{stop();status('Tracking stopped');$('error').textContent=e.message;};
  worker.onmessage=({data})=>{busy=false;if(data.type==='error'){stop();status('Tracking stopped');$('error').textContent=data.message;return;}if(data.type!=='result')return;
    lastResult=performance.now();if(lastResult-data.time>220){apply(null,lastResult);trackingUI.clear();status('Tracking is delayed · movement paused');return;}
    const sample=data.landmarks?.length===1?(navigation==='turn'?measurePointer(data.landmarks[0],data.worldLandmarks[0]):measureHand(data.landmarks[0],data.worldLandmarks[0],$('cam').videoWidth/$('cam').videoHeight)):null;
    const movement=apply(sample,data.time);trackingUI.draw(data.landmarks,$('cam').videoWidth,$('cam').videoHeight,movement.active);if(data.landmarks?.length>1)status('Use one hand to move');
  };
  lastVideo=-1;running=true;lastResult=performance.now();$('start').textContent='Stop camera';status('Show one hand');
 }catch(e){stop();status('Camera not started');$('error').textContent=e.name==='NotAllowedError'?'Camera access was declined. Allow camera access in your browser, then retry.':e.message;}
 finally{$('start').disabled=false;}
}
$('start').onclick=start;
$('reset').onclick=()=>{camera.position.set(0,1.65,7);camera.rotation.set(0,0,0);controller.reset();swipe.reset();demoRun=null;status('View reset · ready');};
function controlsChanged(){navigation=$('navigation').value;controller.mode=swipe.mode=$('mode').value;controller.reset();swipe.reset();demoRun=null;trackingUI.clear();$('hint').textContent=navigation==='turn'?(swipe.mode==='index'?'Extend your index like holding a button. Swipe horizontally to turn. Longer and faster swipes turn farther. Fold your finger to release and reposition.':'Pinch and swipe horizontally to turn. Longer and faster swipes turn farther. Release to stop and reposition.'):'Extend your index or pinch to drag. Slide left/right to strafe. Push toward camera = backward; pull = forward.';$('reverseLabel').hidden=navigation==='turn';document.querySelectorAll('[data-demo="forward"],[data-demo="backward"]').forEach(b=>b.hidden=navigation==='turn');status('Ready · '+(navigation==='turn'?'swipe to turn':'drag to move'));}
$('mode').onchange=controlsChanged;$('navigation').onchange=controlsChanged;
$('gain').oninput=()=>controller.gain=swipe.gain=+$('gain').value;
$('reverse').onchange=()=>{controller.reverse=$('reverse').checked;controller.reset();};
$('demo').onclick=()=>{stop();demo=true;demoRun=null;$('demoControls').classList.add('visible');status('Demo · choose a movement below');};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{controller.reset();swipe.reset();demoRun={direction:b.dataset.demo,start:performance.now()};});
document.addEventListener('visibilitychange',()=>{controller.reset();swipe.reset();demoRun=null;if(document.hidden&&running)stop();});
addEventListener('pagehide',stop);
function frame(now){
 requestAnimationFrame(frame);
 if(demo&&demoRun){const elapsed=now-demoRun.start,t=Math.max(0,Math.min(1,(elapsed-180)/650));const d=demoRun.direction;apply({x:.5+(d==='right'?.25:d==='left'?-.25:0)*t,z:.5+(d==='forward'?.18:d==='backward'?-.18:0)*t,pinch:.2,extended:true},now);if(elapsed>1050){demoRun=null;controller.reset();status('Demo complete · choose another movement');}}
 if(running){
  if(now-lastResult>220){controller.reset();swipe.reset();trackingUI.clear();status('Waiting for tracking');}
  const v=$('cam');if(!busy&&v.readyState>=2&&v.currentTime!==lastVideo){lastVideo=v.currentTime;busy=true;const capture=now,owner=worker;createImageBitmap(v).then(bitmap=>{if(worker!==owner||!running){bitmap.close();return;}owner.postMessage({type:'frame',bitmap,time:capture},[bitmap]);}).catch(e=>{busy=false;controller.reset();status('Frame unavailable');$('error').textContent=e.message;});}
 }
 $('position').innerHTML=`Turn ${(-camera.rotation.y*180/Math.PI).toFixed(1)}°<br>X ${camera.position.x.toFixed(1)} · Z ${(camera.position.z-7).toFixed(1)}`;
 renderer.render(scene,camera);
}controlsChanged();requestAnimationFrame(frame);
