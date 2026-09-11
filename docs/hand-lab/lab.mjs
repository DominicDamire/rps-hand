import * as THREE from 'three';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/controls/OrbitControls.js';
import {DollRig} from '../doll/DollRig.js?v=hand-lab-1';
import {FINGERS,JOINTS,blankAngles,emptyProfile,features,matchPose,clampAngles,validateProfile} from './profile.mjs?v=1';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x)),RAD=Math.PI/180,KEY='hand-pose-lab-v1';
let profile=emptyProfile();try{const saved=localStorage.getItem(KEY);if(saved)profile=validateProfile(JSON.parse(saved));}catch{$('notice').textContent='Saved profile could not be read. Import your JSON backup to recover it.';}
let side='R',selected='Index1',editing=false,latest=null,editBase=null,frozenFeature=null,frozenCapture=null,savedId=null,angles=blankAngles(),epoch=0,stream=null,worker=null,workerReady=null,request=null,inflight=false,lastVideo=-1,sampleSource=null;
const palmQ=new THREE.Quaternion(),frozenPalm=new THREE.Quaternion(),basisCache={},jointDots={};
const notice=t=>$('notice').textContent=t;
const scene=new THREE.Scene();scene.background=new THREE.Color('#182331');
const camera=new THREE.PerspectiveCamera(38,1,.001,10);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.12;controls.maxDistance=1.4;
scene.add(new THREE.HemisphereLight(0xffffff,0x526980,2));const lamp=new THREE.DirectionalLight(0xffffff,2);lamp.position.set(1,2,1);scene.add(lamp);
const rig=new DollRig(scene,{url:new URL('../doll.glb?v=hand-lab-1',import.meta.url).href,report:new URL('../doll-report.json?v=hand-lab-1',import.meta.url).href,headLayer:false});
const markerGroup=new THREE.Group();scene.add(markerGroup);
const gizmo=new THREE.Group();scene.add(gizmo);
for(const [dir,color] of [[new THREE.Vector3(1,0,0),0xff676e],[new THREE.Vector3(0,1,0),0x61e599],[new THREE.Vector3(0,0,1),0x669eff]])gizmo.add(new THREE.ArrowHelper(dir,new THREE.Vector3(),.043,color,.009,.005));
function resize(){const c=$('scene');renderer.setSize(c.clientWidth,c.clientHeight,false);camera.aspect=c.clientWidth/c.clientHeight;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe($('scene'));
function frameBasis(wrist,index,middle,pinky){const y=middle.clone().sub(wrist).normalize(),x=index.clone().sub(pinky);x.addScaledVector(y,-x.dot(y)).normalize();const z=new THREE.Vector3().crossVectors(x,y).normalize();return new THREE.Matrix4().makeBasis(x,y,z);}
function restBasis(S){const r=rig.rest;return frameBasis(r[S+'Hand'].world,r[S+'Index1'].world,r[S+'Middle1'].world,r[S+'Pinky1'].world);}
function jointBasis(n){const key=side+n;if(basisCache[key])return basisCache[key];const r=rig.rest,k=+n.slice(-1),finger=n.slice(0,-1),here=r[key].world;
 const z=(k<3?r[side+finger+(k+1)].world.clone().sub(here):here.clone().sub(r[side+finger+(k-1)].world)).normalize();
 const x=r[side+'Index1'].world.clone().sub(r[side+'Pinky1'].world);x.addScaledVector(z,-x.dot(z)).normalize();const y=new THREE.Vector3().crossVectors(z,x).normalize();
 return basisCache[key]=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function solveRaw(world){const pts=world.map(p=>new THREE.Vector3(p.x,-p.y,-p.z));
 palmQ.setFromRotationMatrix(frameBasis(pts[0],pts[5],pts[9],pts[17]).multiply(restBasis(side).invert()));
 const hand=rig.joints[side+'Hand'];hand.quaternion.copy(palmQ);rig.root.updateMatrixWorld(true);const result=blankAngles();
 for(const [f,fi] of FINGERS.map((f,i)=>[f,i]))for(let k=1;k<=3;k++){
  const n=f+k,j=rig.joints[side+n],a=1+fi*4+k-1,b=a+1;rig.refresh(j);
  const here=rig.rest[side+n].world,rest=k<3?rig.rest[side+f+(k+1)].world.clone().sub(here):here.clone().sub(rig.rest[side+f+(k-1)].world);
  const dir=pts[b].clone().sub(pts[a]);if(dir.lengthSq()<1e-10)continue;
  dir.applyQuaternion(j.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();j.quaternion.setFromUnitVectors(rest.normalize(),dir);rig.refresh(j);
  const qb=jointBasis(n),q=qb.clone().invert().multiply(j.quaternion).multiply(qb),e=new THREE.Euler().setFromQuaternion(q,'XYZ');result[n]=[e.x/RAD,e.y/RAD,e.z/RAD];
 }
 return result;
}
function applyAngles(){if(!rig.loaded)return;angles=clampAngles(angles,profile.limits[side]);rig.joints[side+'Hand'].quaternion.copy(editing?frozenPalm:$('follow').checked?palmQ:new THREE.Quaternion());
 for(const n of JOINTS){const qb=jointBasis(n),v=angles[n];rig.joints[side+n].quaternion.copy(qb).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...v.map(x=>x*RAD),'XYZ'))).multiply(qb.clone().invert());}
 rig.root.updateMatrixWorld(true);
}
function configureSide(){for(const m of rig.parts)m.visible=m.name.startsWith(side)&&/^(R|L)(Hand|Thumb|Index|Middle|Ring|Pinky)/.test(m.name);angles=blankAngles();palmQ.identity();frozenPalm.identity();applyAngles();resetView();renderControls();}
function resetView(){if(!rig.loaded)return;const r=rig.rest,w=r[side+'Hand'].world,m=r[side+'Middle1'].world,b=restBasis(side),normal=new THREE.Vector3().setFromMatrixColumn(b,2);
 const q=rig.joints[side+'Hand'].getWorldQuaternion(new THREE.Quaternion()),along=m.clone().sub(w).applyQuaternion(q);normal.applyQuaternion(q);controls.target.copy(w).addScaledVector(along,.7);camera.up.copy(along).normalize();camera.position.copy(controls.target).addScaledVector(normal,.42);controls.update();}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(profile));return true;}catch{notice('Browser storage is full or unavailable. Your work is still open — export JSON now.');return false;}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function updateMode(){for(const id of ['save','undo','zero','saveLimits','clearLimits','resume'])$(id).disabled=!editing;$('edit').disabled=editing||!latest;$('side').disabled=editing;$('detected').disabled=editing;$('follow').disabled=editing;
 $('mode').textContent=editing?'FROZEN / EDITING':stream?'LIVE CAMERA':latest?'IMAGE PREVIEW':'LIVE PREVIEW';$('editHelp').textContent=editing?'Edit the selected joint. Saved corrections affect the fingers, not the wrist.':'Freeze a pose to edit. Values below show the current rotations.';renderControls();}
function drawPreview(source,landmarks){const c=$('preview');c.width=source.width||source.naturalWidth;c.height=source.height||source.naturalHeight;const ctx=c.getContext('2d');ctx.save();ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(source,0,0,c.width,c.height);ctx.restore();
 if(!landmarks)return;ctx.lineWidth=2;ctx.strokeStyle='#86edbb';ctx.fillStyle='#f0ffee';const point=i=>[(1-landmarks[i].x)*c.width,landmarks[i].y*c.height];
 for(let f=0;f<5;f++){let prev=0;for(let j=1;j<=4;j++){const idx=1+f*4+j-1;ctx.beginPath();ctx.moveTo(...point(prev));ctx.lineTo(...point(idx));ctx.stroke();prev=idx;}}
 for(let i=0;i<21;i++){ctx.beginPath();ctx.arc(...point(i),i%4===0?4:2.5,0,Math.PI*2);ctx.fill();}
}
function ensureWorker(){if(workerReady)return workerReady;worker=new Worker(new URL('../movement/tracker.mjs?v=90',import.meta.url),{type:'module'});
 workerReady=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Tracker loading timed out')),45000);worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);resolve();return;}if(data.type==='error'){if(request){request.reject(Error(data.message));request=null;}else{clearTimeout(timer);reject(Error(data.message));}return;}if(request&&data.type==='result'){request.resolve(data);request=null;}};worker.onerror=e=>{clearTimeout(timer);if(request){request.reject(Error(e.message));request=null;}reject(Error(e.message));};worker.postMessage({type:'init'});});return workerReady;}
async function detect(source){if(inflight||editing)return;inflight=true;const token=epoch;
 try{await ensureWorker();if(token!==epoch||editing)return;const frame=document.createElement('canvas'),w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;if(!w||!h)return;
 frame.width=480;frame.height=Math.round(h/w*480);frame.getContext('2d').drawImage(source,0,0,frame.width,frame.height);const bitmap=await createImageBitmap(frame);if(token!==epoch||editing){bitmap.close();return;}
 const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{request=null;reject(Error('Tracker response timed out'));},10000);request={resolve:d=>{clearTimeout(timer);resolve(d);},reject:e=>{clearTimeout(timer);reject(e);}};worker.postMessage({type:'frame',bitmap,time:performance.now()},[bitmap]);});
 if(token!==epoch||editing)return;const desired=$('detected').value,idx=desired==='first'?0:data.handedness?.findIndex(h=>h[0]?.categoryName===desired);
 const lm=data.landmarks?.[idx],world=data.worldLandmarks?.[idx];drawPreview(frame,lm);
 if(!world||world.length!==21){latest=null;$('captureState').textContent='No selected hand detected. Keep the hand in view.';$('matchState').textContent='No pose matched';updateMode();return;}
 const feature=features(world.map(p=>[p.x,p.y,p.z])),raw=solveRaw(world),match=$('usePoses').checked?matchPose(profile,feature,side):null;
 angles=clone(match?match.pose.angles:raw);latest={feature,raw,landmarks:lm,world};applyAngles();
 $('matchState').textContent=match?'Matched “'+match.pose.name+'” · distance '+match.distance.toFixed(3):'No saved match — tracker pose';$('captureState').textContent=(stream?'Live camera':'Image input')+' · '+data.landmarks.length+' hand(s) · '+Math.round(data.inferenceMs)+' ms inference';updateMode();
 }catch(e){notice(e.message);}finally{inflight=false;}
}
function stopCamera(){epoch++;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;if(!editing){latest=null;updateMode();}$('captureState').textContent=editing?'Frozen frame · camera disconnected':'Camera disconnected';}
async function startCamera(){try{stopCamera();editing=false;sampleSource=null;latest=null;notice('Opening camera…');const id=$('cameraSelect').value;stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(id?{deviceId:{exact:id}}:{}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:30}}});$('video').srcObject=stream;await $('video').play();lastVideo=-1;await listCameras();await ensureWorker();notice('Make a pose, then click Freeze & edit.');updateMode();}catch(e){stopCamera();notice('Camera could not start: '+e.message);}}
async function listCameras(){const current=$('cameraSelect').value,devices=await navigator.mediaDevices.enumerateDevices();$('cameraSelect').replaceChildren(new Option('Default camera',''));for(const d of devices.filter(d=>d.kind==='videoinput'))$('cameraSelect').add(new Option(d.label||'Camera '+($('cameraSelect').options.length),d.deviceId));$('cameraSelect').value=current;}
$('start').onclick=startCamera;$('stop').onclick=stopCamera;
async function loadImage(url){stopCamera();editing=false;latest=null;updateMode();const img=new Image();img.src=url;await img.decode();sampleSource=img;notice('Image input — edit it just like a camera pose.');await detect(img);}
$('sample').onclick=()=>loadImage(new URL('../test/count5.png',import.meta.url).href).catch(e=>notice(e.message));
$('imageInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;const url=URL.createObjectURL(file);try{await loadImage(url);}catch(e){notice(e.message);}finally{URL.revokeObjectURL(url);e.target.value='';}};
$('edit').onclick=()=>{if(!latest||editing)return;epoch++;editing=true;editBase=clone(angles);frozenFeature=[...latest.feature];frozenCapture=$('preview').toDataURL('image/jpeg',.82);frozenPalm.copy(rig.joints[side+'Hand'].quaternion);savedId=null;$('poseName').value='';notice('Pose frozen. Tracking is paused; edit any joint, name the pose, then save.');updateMode();};
$('resume').onclick=()=>{epoch++;editing=false;savedId=null;updateMode();notice('Live matching uses your saved examples and enabled limits.');if(sampleSource&&!stream)detect(sampleSource);};
$('undo').onclick=()=>{angles=clone(editBase);applyAngles();renderControls();notice('Restored the pose captured when editing began.');};
$('side').onchange=()=>{side=$('side').value;latest=null;configureSide();updateMode();if(sampleSource)detect(sampleSource);};
$('follow').onchange=()=>{applyAngles();};$('viewReset').onclick=resetView;
$('usePoses').onchange=()=>{if(!editing&&sampleSource)detect(sampleSource);};
$('tolerance').value=profile.tolerance;$('toleranceValue').textContent=profile.tolerance.toFixed(2);$('tolerance').oninput=()=>{profile.tolerance=+$('tolerance').value;$('toleranceValue').textContent=profile.tolerance.toFixed(2);persist();if(!editing&&sampleSource)detect(sampleSource);};
function renderLibrary(){const list=$('library');list.replaceChildren();$('poseCount').textContent=profile.poses.length;
 if(!profile.poses.length){const p=document.createElement('p');p.className='empty';p.textContent='No examples yet. Freeze a pose and save your correction.';list.append(p);}
 for(const pose of profile.poses){const row=document.createElement('div');row.className='saved';const button=document.createElement('button');button.textContent=pose.name+' · '+(pose.side==='R'?'Right':'Left');button.onclick=()=>loadPose(pose);const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Delete '+pose.name);del.onclick=()=>{profile.poses=profile.poses.filter(p=>p.id!==pose.id);if(savedId===pose.id)savedId=null;persist();renderLibrary();};row.append(button,del);list.append(row);}}
function loadPose(pose){epoch++;editing=true;side=pose.side;$('side').value=side;configureSide();savedId=pose.id;angles=clone(pose.angles);editBase=clone(angles);frozenFeature=[...pose.features];frozenCapture=pose.capture;frozenPalm.identity();$('poseName').value=pose.name;applyAngles();
 if(pose.capture){const img=new Image();img.onload=()=>{$('preview').getContext('2d').clearRect(0,0,$('preview').width,$('preview').height);$('preview').getContext('2d').drawImage(img,0,0,$('preview').width,$('preview').height);};img.src=pose.capture;}
 notice('Editing saved pose “'+pose.name+'”. Save updates this example.');updateMode();}
$('save').onclick=()=>{const name=$('poseName').value.trim();if(!editing||!frozenFeature)return notice('Freeze a tracked pose first.');if(!name)return notice('Give this pose a name, such as Fist.');if(!savedId&&profile.poses.length>=100)return notice('This profile already has 100 examples. Export it and remove an example first.');
 const pose={id:savedId||crypto.randomUUID(),name,side,features:[...frozenFeature],angles:clone(angles),capture:frozenCapture};const at=profile.poses.findIndex(p=>p.id===pose.id);if(at>=0)profile.poses[at]=pose;else profile.poses.push(pose);savedId=pose.id;if(persist())notice('Saved “'+name+'”. Resume live to test recognition, or export JSON.');renderLibrary();};
function renderControls(){if(!rig.loaded)return;
 $('jointName').textContent=selected.replace(/\d$/,'')+' · '+jointLabel(selected);for(const n of JOINTS){const b=$('joint-'+n);b.setAttribute('aria-pressed',String(n===selected));b.querySelector('small').textContent=angles[n].map(v=>Math.round(v)).join(' / ');}
 for(let i=0;i<3;i++){const v=angles[selected][i];$('angle'+i).value=v;$('number'+i).value=v.toFixed(1);$('angle'+i).disabled=$('number'+i).disabled=!editing;
 const l=profile.limits[side][selected][i];$('enabled'+i).checked=l.enabled;$('min'+i).value=l.min;$('max'+i).value=l.max;for(const id of ['enabled','min','max'])$(id+i).disabled=!editing;}
}
function jointLabel(n){const k=+n.slice(-1);return n.startsWith('Thumb')?['CMC','MCP','IP'][k-1]:['MCP','PIP','DIP'][k-1];}
for(const f of FINGERS){const label=document.createElement('div');label.className='finger';label.textContent=f;$('joints').append(label);for(let k=1;k<=3;k++){const n=f+k,b=document.createElement('button');b.id='joint-'+n;b.setAttribute('aria-label','Select '+f+' '+jointLabel(n));b.innerHTML=jointLabel(n)+'<small>0 / 0 / 0</small>';b.onclick=()=>{selected=n;renderControls();};$('joints').append(b);}}
for(let i=0;i<3;i++){const axis=['X · Bend','Y · Sideways','Z · Twist'][i],row=document.createElement('div');row.className='angleRow';row.innerHTML=`<label for="angle${i}">${axis}</label><input id="number${i}" type="number" min="-180" max="180" step="0.1" aria-label="${axis} degrees"><input id="angle${i}" type="range" min="-180" max="180" step="0.1" aria-label="${axis}">`;$('axes').append(row);
 const edit=e=>{if(!editing)return;const v=Number(e.target.value);if(!Number.isFinite(v))return;angles[selected][i]=Math.max(-180,Math.min(180,v));applyAngles();renderControls();};$('angle'+i).oninput=edit;$('number'+i).oninput=e=>{if(!editing||e.target.value===''||!Number.isFinite(e.target.valueAsNumber))return;angles[selected][i]=Math.max(-180,Math.min(180,e.target.valueAsNumber));applyAngles();$('angle'+i).value=angles[selected][i];};$('number'+i).onchange=edit;
 const limit=document.createElement('div');limit.className='limitRow';limit.innerHTML=`<label><input id="enabled${i}" type="checkbox" aria-label="Enable ${axis} limit">${'XYZ'[i]}</label><input id="min${i}" type="number" min="-180" max="180" aria-label="${axis} minimum"><span>to</span><input id="max${i}" type="number" min="-180" max="180" aria-label="${axis} maximum">`;$('limits').append(limit);
 const setLimit=()=>{const min=+$('min'+i).value,max=+$('max'+i).value;if(!Number.isFinite(min)||!Number.isFinite(max)||min< -180||max>180||min>max){notice('Limits must be between −180° and 180°, with minimum ≤ maximum.');renderControls();return;}profile.limits[side][selected][i]={enabled:$('enabled'+i).checked,min,max};applyAngles();renderControls();$('limitState').textContent='Limits changed. Click Save my limits to keep them.';};for(const id of ['enabled','min','max'])$(id+i).onchange=setLimit;
}
$('zero').onclick=()=>{angles[selected]=[0,0,0];applyAngles();renderControls();};$('saveLimits').onclick=()=>{if(persist())notice('Your joint limits are saved and will apply in live mode.');$('limitState').textContent='Limits saved for '+(side==='R'?'right':'left')+' hand.';};$('clearLimits').onclick=()=>{profile.limits[side][selected]=[0,1,2].map(()=>({enabled:false,min:-180,max:180}));renderControls();$('limitState').textContent='Selected limits cleared. Save my limits to keep this.';};
$('export').onclick=()=>{const json=JSON.stringify(profile,null,2);$('jsonText').value=json;$('jsonDetails').open=true;download(new Blob([json],{type:'application/json'}),'hand-poses.json');notice('Exported your poses and limits. Keep this JSON as a backup.');};
function importText(text){if(text.length>20000000)throw Error('Profile is too large');const incoming=validateProfile(JSON.parse(text));profile=incoming;$('tolerance').value=profile.tolerance;$('toleranceValue').textContent=profile.tolerance.toFixed(2);savedId=null;persist();applyAngles();renderLibrary();renderControls();notice('Imported '+profile.poses.length+' pose examples and joint limits.');if(!editing&&sampleSource)detect(sampleSource);}
$('import').onchange=async e=>{try{if(e.target.files[0])importText(await e.target.files[0].text());}catch(err){notice('Import rejected: '+err.message);}finally{e.target.value='';}};
$('importPaste').onclick=()=>{try{importText($('jsonText').value);}catch(e){notice('Import rejected: '+e.message);}};
$('png').onclick=()=>{renderer.render(scene,camera);const c=document.createElement('canvas');c.width=1400;c.height=850;const ctx=c.getContext('2d');ctx.fillStyle='#10151d';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#edf6ff';ctx.font='bold 25px system-ui';ctx.fillText('Hand Pose Lab — '+($('poseName').value||'Live comparison'),28,42);ctx.font='16px system-ui';ctx.fillText(editing?'Frozen input and corrected model':'Latest tracked frame and model',28,74);const fit=(img,x,y,w,h)=>{const a=img.width/img.height;let iw=w,ih=w/a;if(ih>h){ih=h;iw=h*a;}ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);};fit($('preview'),24,100,510,710);fit($('scene'),560,100,810,710);c.toBlob(blob=>{if(blob)download(blob,'hand-pose-comparison.png');});};
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointer=null;renderer.domElement.addEventListener('pointerdown',e=>pointer=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!pointer||Math.hypot(e.clientX-pointer[0],e.clientY-pointer[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(markerGroup.children)[0];if(hit){selected=hit.object.userData.joint;renderControls();}});
await rig.ready;
for(const n of JOINTS){const dot=new THREE.Mesh(new THREE.SphereGeometry(.003,10,8),new THREE.MeshBasicMaterial({color:0x8ee3bf,depthTest:false}));dot.userData.joint=n;dot.renderOrder=100;markerGroup.add(dot);jointDots[n]=dot;}
configureSide();renderLibrary();updateMode();resize();notice('Ready. Connect your camera, make a pose, then Freeze & edit.');
let lastPaint=0;function loop(now){requestAnimationFrame(loop);if(stream&&!editing&&$('video').readyState>=2&&!inflight&&$('video').currentTime!==lastVideo){lastVideo=$('video').currentTime;detect($('video'));}
 if(now-lastPaint<16)return;lastPaint=now;controls.update();rig.root.updateMatrixWorld(true);markerGroup.visible=gizmo.visible=$('dots').checked;
 for(const n of JOINTS){const dot=jointDots[n];dot.position.setFromMatrixPosition(rig.joints[side+n].matrixWorld);dot.material.color.setHex(n===selected?0xffc56e:0x8ee3bf);dot.scale.setScalar(n===selected?1.7:1);}
 const j=rig.joints[side+selected];gizmo.position.setFromMatrixPosition(j.matrixWorld);gizmo.quaternion.copy(j.parent.getWorldQuaternion(new THREE.Quaternion())).multiply(jointBasis(selected));renderer.render(scene,camera);
}requestAnimationFrame(loop);addEventListener('pagehide',()=>{stopCamera();worker?.terminate();});

