import {faceIds} from './face-overlay.mjs?v=20';
const MP=new URL('../vendor/mediapipe',import.meta.url).href,base=new URL('../vendor/models/',import.meta.url).href;
const params=new URLSearchParams(self.location.search),task=params.get('task')||'hands',preferred=params.get('delegate')||'GPU',fullBody=params.get('fullBody')==='1';
let tracker;
const stage=message=>self.postMessage({type:'loading',task,message});
const round=n=>Math.round(n*100000)/100000;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  stage('Loading tracking runtime');
  const api=await import(MP+'/vision_bundle.mjs'),files=await api.FilesetResolver.forVisionTasks(MP+'/wasm',true);
  const spec=task==='hands'?['HandLandmarker','hand_landmarker/hand_landmarker',{numHands:2,minHandDetectionConfidence:params.get('partialHands')==='1'?.4:.6,minHandPresenceConfidence:params.get('partialHands')==='1'?.35:.6,minTrackingConfidence:.45}]:task==='face'?['FaceLandmarker','face_landmarker/face_landmarker',{numFaces:1,outputFacialTransformationMatrixes:true,outputFaceBlendshapes:false}]:['PoseLandmarker','pose_landmarker/pose_landmarker_'+(['lite','full','heavy'].includes(params.get('poseModel'))?params.get('poseModel'):'lite'),{numPoses:1}];
  stage('Downloading '+task+' model');
  const response=await fetch(base+spec[1]+'/float16/1/'+spec[1].split('/')[1]+'.task',{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw Error('Model download failed: HTTP '+response.status);
  const total=Number(response.headers.get('content-length')),reader=response.body?.getReader();let model;
  if(reader){const chunks=[];let received=0,last=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(performance.now()-last>500){stage('Downloading '+task+' model: '+(received/1048576).toFixed(1)+' MB'+(total?' / '+(total/1048576).toFixed(1)+' MB':''));last=performance.now();}}model=new Uint8Array(received);let offset=0;for(const c of chunks){model.set(c,offset);offset+=c.length;}}
  else model=new Uint8Array(await response.arrayBuffer());
  let delegate;for(delegate of preferred==='CPU'?['CPU']:['GPU','CPU']){try{stage('Starting '+delegate+' inference');tracker=await api[spec[0]].createFromOptions(files,{baseOptions:{modelAssetBuffer:model,delegate},runningMode:'VIDEO',...spec[2]});break;}catch(e){if(delegate==='CPU')throw e;stage('GPU unavailable; starting CPU inference');}}
  self.postMessage({type:'ready',task,delegate});
 }else if(data.type==='frame'){
  const source=data.bitmap||data.image,start=performance.now();try{
   const r=tracker.detectForVideo(source,data.time),out={type:'result',task,time:data.time};
   if(task==='hands')Object.assign(out,{landmarks:r.landmarks,worldLandmarks:r.worldLandmarks,handedness:r.handedness});
   // Keep only the outline and calibration anchors; no expression classifier.
   if(task==='face')out.face=r.faceLandmarks?.[0]&&r.facialTransformationMatrixes?.[0]?{matrix:Array.from(r.facialTransformationMatrixes[0].data),points:Object.fromEntries(faceIds.map(i=>[i,{x:round(r.faceLandmarks[0][i].x),y:round(r.faceLandmarks[0][i].y)}]))}:null;
   if(task==='pose')out.pose=r.landmarks?.[0]?{points:Object.fromEntries((fullBody?Array.from({length:33},(_,i)=>i):[0,11,12,13,14,15,16,17,18,19,20,21,22]).map(i=>{const p=r.landmarks[0][i];return [i,{x:round(p.x),y:round(p.y),z:round(p.z),visibility:round(p.visibility),presence:round(p.presence??1)}]})),world:Object.fromEntries((fullBody?Array.from({length:33},(_,i)=>i):[0,11,12,13,14,15,16,17,18,19,20,21,22]).map(i=>[i,r.worldLandmarks[0][i]]))}:null;
   out.inferenceMs=performance.now()-start;self.postMessage(out);
  }finally{source.close?.();}
 }
}catch(e){self.postMessage({type:'error',task,message:String(e)});}};
