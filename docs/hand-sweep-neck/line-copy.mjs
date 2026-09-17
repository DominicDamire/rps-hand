import {cameraPosition,cameraUV,projectCamera} from './projection.mjs';

// Sweep supplies one wrist depth. Every joint stays on its observed camera ray.
export function copyImageLines(landmarks,depth,sourceAspect,viewAspect){
 return landmarks.map(point=>cameraPosition(cameraUV(point,sourceAspect,viewAspect),depth,viewAspect));
}

export function lineCopyError(points,landmarks,sourceAspect,viewAspect,width,height){
 let sum=0,max=0;
 for(let i=0;i<landmarks.length;i++){
  const target=cameraUV(landmarks[i],sourceAspect,viewAspect),actual=projectCamera(points[i],viewAspect);
  const error=Math.hypot((actual.x-target.x)*width,(actual.y-target.y)*height);
  sum+=error*error;max=Math.max(max,error);
 }
 return {rms:Math.sqrt(sum/landmarks.length),max};
}
