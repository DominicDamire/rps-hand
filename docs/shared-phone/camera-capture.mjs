// Try a real 60 FPS mode before accepting the device/browser fallback.
export async function openCamera(video,media=navigator.mediaDevices){
 const fps=video.frameRate?.ideal??60;
 if(fps>=60){for(const size of [{width:video.width,height:video.height},{width:{ideal:640},height:{ideal:480}}]){
  try{return await media.getUserMedia({audio:false,video:{...video,...size,frameRate:{min:59,ideal:60,max:60}}});}
  catch(e){if(!['OverconstrainedError','ConstraintNotSatisfiedError'].includes(e.name))throw e;}
 }}
 return media.getUserMedia({audio:false,video});
}
