import {ThumbJoystick,measureThumb} from './thumb-joystick.mjs?v=41';
import {setupThumbstick} from './thumbstick.mjs?v=41';

import {HeadLook,bodyDisplacement} from './head-look.mjs?v=41';
import {DustMap} from './map.mjs?v=41';
import {HeadView} from '../head/HeadView.js';
import * as THREE from 'three';
import {setupUI} from './ui.mjs?v=41';
import {SwipeController,measurePointer,selectLeftHand} from './swipe.mjs?v=41';
const $=id=>document.getElementById(id);
const trackingUI=setupUI();const stick=setupThumbstick($('thumbstick'),$('stickKnob'));
const held=new ThumbJoystick();let inputMode='poses',trackedHand=null,resting=false;
const swipe=new SwipeController();const headLook=new HeadLook();let lookDemo=0;
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:false});renderer.setPixelRatio(1);
const scene=new THREE.Scene();scene.background=new THREE.Color('#25394a');scene.fog=new THREE.FogExp2('#25394a',.018);
const camera=new THREE.PerspectiveCamera(65,1,.05,200);camera.position.set(0,1.65,7);
scene.background=new THREE.Color('#abc9d9');scene.fog=new THREE.Fog('#abc9d9',90,180);
const dustMap=new DustMap(scene);
dustMap.load().then(()=>{camera.position.copy(dustMap.spawn);$('mapStatus').textContent='Dust II · auto-step on';}).catch(e=>{$('mapStatus').textContent='Map failed to load';$('error').textContent=e.message;});
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
let head=null,lastHeadVideo=-1,lastFrameTime=0,handsSinceHead=0;let walkReason='START CAMERA';
let worker=null,stream=null,running=false,busy=false,lastVideo=-1,lastResult=0,demo=false,demoRun=null;
function status(text,active=false){$('status').textContent=text;$('lamp').classList.toggle('on',active);}
function apply(sample,time){const r=swipe.update(sample,time);const step=bodyDisplacement(r.dx,r.dz,headLook.heading);dustMap.move(camera.position,step.x,step.z);$('gestureStats').textContent=r.active?'MOVE engaged · relax index to release':'Hands free · movement off';status(r.status,r.active);return r;}
function stop(){stick.reset();held.reset();trackedHand=null;lookDemo=0;headLook.resetLook();head?.worker?.terminate();if(head)clearTimeout(head.timer);head=null;$('headStatus').textContent='Head: camera off';running=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('cam').srcObject=null;swipe.reset();trackingUI.camera(false);$('start').textContent='Start camera';}
async function start(){
 if(running){stop();status('Paused · camera off');return;}
 stop();demo=false;demoRun=null;$('demoControls').classList.remove('visible');$('error').textContent='';$('start').disabled=true;status('Starting camera…');
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access needs HTTPS or localhost.');
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:60}}});
  $('cam').srcObject=stream;await $('cam').play();trackingUI.camera(true);$('previewImage').style.aspectRatio=$('cam').videoWidth+'/'+$('cam').videoHeight;status('Loading motion tracking…');
  worker=new Worker(new URL('./tracker.mjs?v=41',import.meta.url),{type:'module'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tracker loading timed out. Check your connection and retry.')),45000);worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();}else if(data.type==='error'){clearTimeout(timer);reject(Error(data.message));}};worker.postMessage({type:'init'});});
  worker.onerror=e=>{stop();status('Tracking stopped');$('error').textContent=e.message;};
  worker.onmessage=({data})=>{busy=false;if(data.type==='error'){stop();status('Tracking stopped');$('error').textContent=data.message;return;}if(data.type!=='result')return;
    lastResult=performance.now();if(lastResult-data.time>750){held.reset();apply(null,lastResult);trackingUI.clear();walkReason='TRACKING TOO OLD · '+Math.round(lastResult-data.time)+' ms';status(walkReason);return;}
    let handIndex=inputMode==='index'?selectLeftHand(data):data.landmarks?.length===1?0:-1;
    if(resting){held.reset();swipe.reset();walkReason='RESTING';return;}
    const label=handIndex>=0?data.handedness?.[handIndex]?.[0]?.categoryName:null;
    trackedHand=label;
    if(inputMode==='index'){
      const sample=handIndex>=0?measurePointer(data.landmarks[handIndex],data.worldLandmarks[handIndex],$('cam').videoWidth/$('cam').videoHeight):null;
      const result=apply(sample,data.time);trackingUI.draw(handIndex>=0?[data.landmarks[handIndex]]:[],$('cam').videoWidth,$('cam').videoHeight,result.active);
    }else if(inputMode==='poses'){
      const sample=handIndex>=0?measureThumb(data.landmarks[handIndex],data.worldLandmarks[handIndex],$('cam').videoWidth/$('cam').videoHeight):null;
      held.receive(sample,lastResult);
      const active=!!held.direction;walkReason=handIndex<0?'SHOW ONE HAND':held.reason;
      $('gestureStats').textContent=`THUMB X ${held.x.toFixed(2)} · Y ${(-held.z).toFixed(2)} · raw X ${held.raw.x.toFixed(2)} Y ${(-held.raw.z).toFixed(2)} · depth ${sample?.tilt?.[2]?.toFixed(2)??"?"} · tracker ${Math.round(data.inferenceMs||0)} ms`;
      trackingUI.draw(handIndex>=0?[data.landmarks[handIndex]]:[],$('cam').videoWidth,$('cam').videoHeight,active);
      status(active?'THUMB · '+held.direction:walkReason,active);
    }
    handsSinceHead++;if(running&&handsSinceHead>=2&&head?.wantsFrame(lastResult)&&$('cam').currentTime!==lastHeadVideo){handsSinceHead=0;lastHeadVideo=$('cam').currentTime;head.capture($('cam'),lastResult);}
  };
  head=new HeadView({mode:$('headEnabled').checked?'first':'off',interval:100,widths:[384,288,512]});head.pose.sensitivity=1.5;headLook.gain=+$('headGain').value;lastHeadVideo=-1;lastVideo=-1;handsSinceHead=0;running=true;lastResult=performance.now();$('start').textContent='Stop camera';status('Show one hand');
 }catch(e){stop();status('Camera not started');$('error').textContent=e.name==='NotAllowedError'?'Camera access was declined. Allow camera access in your browser, then retry.':e.message;}
 finally{$('start').disabled=false;}
}
$('start').onclick=start;
$('rest').onclick=()=>{resting=!resting;held.reset();stick.reset();swipe.reset();demoRun=null;lookDemo=0;headLook.resetLook();head?.recenter();$('rest').textContent=resting?'Resume':'Rest';$('rest').setAttribute('aria-pressed',String(resting));walkReason=resting?'RESTING':'THUMB READY';status(walkReason);};
$('centerHead').onclick=()=>{head?.recenter();headLook.resetLook();swipe.reset();};
$('headEnabled').onchange=()=>{if(head)head.mode=$('headEnabled').checked?'first':'off';headLook.resetLook();head?.recenter();camera.rotation.y=headLook.heading;};
$('turnMode').onchange=()=>{headLook.mode=$('turnMode').value;headLook.resetLook();head?.recenter();};
$('headThreshold').oninput=()=>{headLook.deadzoneDegrees=+$('headThreshold').value;$('thresholdValue').textContent=$('headThreshold').value+'°';};
$('headGain').oninput=()=>{if(head)head.pose.sensitivity=1.5;headLook.gain=+$('headGain').value;};
$('reset').onclick=()=>{stick.reset();held.reset();headLook.heading=0;headLook.resetLook();lookDemo=0;head?.recenter();camera.position.copy(dustMap.spawn);camera.rotation.set(0,0,0);swipe.reset();demoRun=null;status('View reset · ready');};
function controlsChanged(){held.reset();swipe.reset();demoRun=null;trackingUI.clear();$('hint').textContent='On camera start, hold your thumb upright briefly. This becomes your live centre. Return there to stop. Tilt in any direction and hold to keep walking. More tilt means more speed. Small wobbles are ignored. Close your fist to rest. No calibration.';status('Start camera · thumb joystick ready');}
$('movementMode').onchange=()=>{inputMode=$('movementMode').value;stick.reset();held.reset();trackedHand=null;swipe.reset();demo=false;demoRun=null;$('demoControls').classList.remove('visible');$('stickZone').hidden=inputMode!=='touch';$('hint').textContent=inputMode==='touch'?'Drag thumbstick to walk; release to stop.':inputMode==='poses'?'Tilt and hold your thumb to walk. Upright or closed fist stops.':'Left index out: move your hand to walk. Bend index to release.';};
$('gain').oninput=()=>held.speed=+$('gain').value;
$('demo').onclick=()=>{stop();demo=true;demoRun=null;$('demoControls').classList.add('visible');status('Demo · choose a movement below');};
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{lookDemo=+b.dataset.look;if(!lookDemo)headLook.speed=0;});
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>{swipe.reset();demoRun={direction:b.dataset.demo,start:performance.now()};});
document.addEventListener('visibilitychange',()=>{held.reset();swipe.reset();demoRun=null;if(document.hidden&&running)stop();});
addEventListener('pagehide',stop);
function frame(now){
 requestAnimationFrame(frame);
 const dt=lastFrameTime?Math.min(.1,(now-lastFrameTime)/1000):1/60;lastFrameTime=now;
 if(head&&!resting){const pose=head.update(now,dt),valid=head.mode!=='off'&&!!head.lastResult?.pose&&now-head.pose.seen<250;const rawYaw=valid&&head.pose.neutral?-(head.pose.latest.yaw-head.pose.neutral.yaw):0;const viewYaw=headLook.update(rawYaw,dt,valid,head.lastResult?.ts);if(valid)camera.rotation.set(pose.pitch,viewYaw,0,'YXZ');$('headStatus').textContent=head.status(now)+(valid?` · ${headLook.state}${headLook.state==='HOLD TO TURN'?' '+Math.round(headLook.progress*100)+'%':''}`:' · turn stopped');}
 if(demo&&!resting){camera.rotation.set(0,headLook.update(lookDemo*.35,dt),0,'YXZ');}

 if(demo&&demoRun&&!resting){const elapsed=now-demoRun.start,t=Math.max(0,Math.min(1,(elapsed-180)/180));const d=demoRun.direction;apply({x:.5+(d.includes('right')?.25:d.includes('left')?-.25:0)*t,z:.5+(d.includes('forward')?-.18:d.includes('backward')?.18:0)*t,pinch:.8,extended:true,pointing:true},now);if(elapsed>1050){demoRun=null;apply(null,now);status('Demo complete · choose another movement');}}
 if(inputMode==='touch'&&!document.hidden&&!demo&&!resting){const v=stick.vector,step=bodyDisplacement(v.x*held.speed*Math.min(.05,dt),v.z*held.speed*Math.min(.05,dt),headLook.heading);dustMap.move(camera.position,step.x,step.z);const moving=Math.hypot(v.x,v.z)>.001;status(moving?'WALKING · release to stop':'Thumbstick ready · drag to walk',moving);$('gestureStats').textContent=moving?'Walking '+Math.round(Math.hypot(v.x,v.z)*100)+'%':'Stopped';}
 if(running&&!resting){
  const movement=held.step(now,dt),world=bodyDisplacement(movement.dx,movement.dz,headLook.heading),beforeX=camera.position.x,beforeZ=camera.position.z;dustMap.move(camera.position,world.x,world.z);if(held.direction){walkReason=!dustMap.ready?'MAP LOADING':Math.hypot(camera.position.x-beforeX,camera.position.z-beforeZ)<.00001?'BLOCKED BY MAP':'MOVING';}
  if(inputMode!=='touch'&&now-lastResult>350){held.reset();swipe.update(null,now);trackingUI.clear();walkReason='WAITING FOR TRACKING';status(walkReason);}
  const v=$('cam');if(inputMode==='touch'&&head?.wantsFrame(now)&&v.currentTime!==lastHeadVideo){lastHeadVideo=v.currentTime;head.capture(v,now);}
  if(inputMode!=='touch'&&!busy&&!head?.busy&&v.readyState>=2&&v.currentTime!==lastVideo){lastVideo=v.currentTime;busy=true;const capture=now,owner=worker;createImageBitmap(v,{resizeWidth:640,resizeHeight:Math.round(640*v.videoHeight/v.videoWidth),resizeQuality:'low'}).then(bitmap=>{if(worker!==owner||!running){bitmap.close();return;}owner.postMessage({type:'frame',bitmap,time:capture},[bitmap]);}).catch(e=>{busy=false;status('Frame unavailable');$('error').textContent=e.message;});}
 }
 $('position').innerHTML=`${['N','NE','E','SE','S','SW','W','NW'][Math.round(((-camera.rotation.y*180/Math.PI)%360+360)%360/45)%8]} · ${((-camera.rotation.y*180/Math.PI%360+360)%360).toFixed(0)}°<br>X ${camera.position.x.toFixed(1)} · Z ${camera.position.z.toFixed(1)}`;
 $('turnIndicator').textContent=(running||demo)?headLook.state+(headLook.state==='HOLD TO TURN'?' '+Math.round(headLook.progress*100)+'%':''):'Head control paused';
 $('walkIndicator').textContent=resting?'RESTING · TAP RESUME':inputMode==='poses'?(!running?'START CAMERA':held.direction?'THUMB '+held.direction+' · '+walkReason:'STOP · '+walkReason):inputMode==='index'?'INDEX STROKES':'SCREEN THUMBSTICK';
 $('turnIndicator').style.color=headLook.state.includes('BODY')?'#ffdf75':'#b8ebd1';
 const dot=$('joystickDot');dot.style.transform=`translate(${held.x*30}px,${held.z*30}px)`;$('joystickState').textContent=resting?'REST':held.direction||held.reason;
 renderer.render(scene,camera);
}controlsChanged();requestAnimationFrame(frame);
