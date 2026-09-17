// Request and verify 60 FPS; some camera/browser paths accept constraints but
// silently deliver 30. Keep a supported fallback instead of reporting a fake 60.
export async function openCamera(video,media=navigator.mediaDevices){
 if(!media?.getUserMedia)throw Error('Camera access requires HTTPS and a browser with camera support. Open this page directly in Safari or Chrome.');
 const fps=video.frameRate?.ideal??60;
 if(fps>=60){for(const size of [{width:video.width,height:video.height},{width:{ideal:640},height:{ideal:480}}]){
  try{
   const constraints={...video,...size,frameRate:{min:59,ideal:60,max:60}};
   const stream=await media.getUserMedia({audio:false,video:constraints});
   const track=stream.getVideoTracks?.()[0];
   let actual=track?.getSettings?.().frameRate;
   if(actual&&actual<59&&track.applyConstraints){
    try{await track.applyConstraints(constraints);}catch(e){if(!['OverconstrainedError','ConstraintNotSatisfiedError'].includes(e.name)){stream.getTracks().forEach(t=>t.stop());throw e;}}
    actual=track.getSettings?.().frameRate;
   }
   if(!actual||actual>=59)return stream;
   stream.getTracks().forEach(t=>t.stop());
  }catch(e){if(e.name==='NotFoundError'&&video.deviceId)break;if(!['OverconstrainedError','ConstraintNotSatisfiedError'].includes(e.name))throw e;}
 }}
 try{return await media.getUserMedia({audio:false,video});}catch(e){if(video.deviceId&&['NotFoundError','OverconstrainedError'].includes(e.name)){const {deviceId,...fallback}=video;return media.getUserMedia({audio:false,video:fallback});}throw e;}
}
