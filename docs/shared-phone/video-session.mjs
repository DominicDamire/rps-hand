// One tracker session for the newest received stream, even if playback resolves out of order.
export function videoSession({video,start,onConnected=()=>{},onError=()=>{}}){
 let generation=0,current=null,pending=null,end=null;
 function stop(){generation++;end?.();end=null;current=pending=null;}
 async function attach(stream,{restart=false}={}){
  if(!restart&&(stream===current||stream===pending))return;
  const token=++generation;end?.();end=null;current=null;pending=stream;
  video.srcObject=stream;video.muted=true;video.playsInline=true;
  onConnected('Video connected · starting playback');
  try{await video.play();if(token!==generation)return;current=stream;pending=null;end=start(stream);onConnected('Video connected · tracking starting');}
  catch(e){if(token===generation){pending=null;current=null;onError(e);}}
 }
 return {attach,stop,restart(){const stream=current||pending||video.srcObject;return stream?attach(stream,{restart:true}):Promise.resolve();}};
}
