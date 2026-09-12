const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1',base='https://storage.googleapis.com/mediapipe-models/';
const params=new URLSearchParams(self.location.search),task=params.get('task')||'hands',preferred=params.get('delegate')||'GPU';
let tracker;
const faceIds=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,33,133,362,263,1,168];
const round=n=>Math.round(n*100000)/100000;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  const api=await import(MP+'/vision_bundle.mjs'),files=await api.FilesetResolver.forVisionTasks(MP+'/wasm',true);
  const spec=task==='hands'?['HandLandmarker','hand_landmarker/hand_landmarker',{numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.45}]:task==='face'?['FaceLandmarker','face_landmarker/face_landmarker',{numFaces:1,outputFacialTransformationMatrixes:true,outputFaceBlendshapes:true}]:['PoseLandmarker','pose_landmarker/pose_landmarker_lite',{numPoses:1}];
  let delegate;for(delegate of preferred==='CPU'?['CPU']:['GPU','CPU']){try{tracker=await api[spec[0]].createFromOptions(files,{baseOptions:{modelAssetPath:base+spec[1]+'/float16/1/'+spec[1].split('/')[1]+'.task',delegate},runningMode:'VIDEO',...spec[2]});break;}catch(e){if(delegate==='CPU')throw e;}}
  self.postMessage({type:'ready',task,delegate});
 }else if(data.type==='frame'){
  const source=data.bitmap||data.image,start=performance.now();try{
   const r=tracker.detectForVideo(source,data.time),out={type:'result',task,time:data.time};
   if(task==='hands')Object.assign(out,{landmarks:r.landmarks,worldLandmarks:r.worldLandmarks,handedness:r.handedness});
   // Only the head outline, eyes and nose leave this worker. No lip landmarks.
   if(task==='face')out.face=r.faceLandmarks?.[0]&&r.facialTransformationMatrixes?.[0]?{matrix:Array.from(r.facialTransformationMatrixes[0].data),points:Object.fromEntries(faceIds.map(i=>[i,{x:round(r.faceLandmarks[0][i].x),y:round(r.faceLandmarks[0][i].y)}])),eyes:Object.fromEntries((r.faceBlendshapes?.[0]?.categories||[]).filter(c=>/^eyeLook|^eyeBlink/.test(c.categoryName)).map(c=>[c.categoryName,round(c.score)]))}:null;
   if(task==='pose')out.pose=r.landmarks?.[0]?{points:r.landmarks[0].slice(0,17).map(p=>({x:round(p.x),y:round(p.y),visibility:round(p.visibility)})),world:Object.fromEntries([11,12].map(i=>[i,r.worldLandmarks[0][i]]))}:null;
   out.inferenceMs=performance.now()-start;self.postMessage(out);
  }finally{source.close?.();}
 }
}catch(e){self.postMessage({type:'error',task,message:String(e)});}};
