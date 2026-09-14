import {observedPalmRotation,rotationDistance,fitTranslation} from './palm-orientation.mjs?v=rotation3';
// OpenCV EPnP initializes; solvePnP ITERATIVE refines rotation AND translation.
// Fixed model coordinates, never a per-frame palm-size multiplier.
export const PALM_IDS=[0,5,9,13,17];
export function solvePalmPose(cv,model,lm,aspect,focal,previous=null,world=null){
 if(model?.length!==5||!model.every(p=>p.length===3&&p.every(Number.isFinite))||!(aspect>0&&focal>0)||!PALM_IDS.every(i=>lm?.[i]&&Number.isFinite(lm[i].x)&&Number.isFinite(lm[i].y)))return null;
 const object=cv.matFromArray(5,1,cv.CV_64FC3,model.flat()),image=cv.matFromArray(5,1,cv.CV_64FC2,PALM_IDS.flatMap(i=>[lm[i].x,lm[i].y]));
 const K=cv.matFromArray(3,3,cv.CV_64F,[focal/aspect,0,.5,0,focal,.5,0,0,1]),D=cv.Mat.zeros(5,1,cv.CV_64F),candidates=[];
 try{
  const observed=observedPalmRotation(model,world);
  let worldSeed=null;
  if(observed){
   const translation=fitTranslation(model,lm,aspect,focal,observed);
   if(translation){const m=cv.matFromArray(3,3,cv.CV_64F,observed),v=new cv.Mat();try{cv.Rodrigues(m,v);worldSeed={translation,rotation:Array.from(v.data64F),matrix:observed};}finally{m.delete();v.delete();}}
  }
  for(const entry of [...(worldSeed?[{seed:worldSeed,refine:false},{seed:worldSeed}]:[]),{seed:previous,flag:cv.SOLVEPNP_EPNP},{seed:null,flag:cv.SOLVEPNP_IPPE}]){
   const {seed,flag}=entry;
   const r=seed?cv.matFromArray(3,1,cv.CV_64F,seed.rotation):new cv.Mat(),t=seed?cv.matFromArray(3,1,cv.CV_64F,seed.translation):new cv.Mat(),R=new cv.Mat(),projected=new cv.Mat();
   try{
    if(!seed&&!cv.solvePnP(object,image,K,D,r,t,false,flag))continue;
    if(entry.refine!==false&&!cv.solvePnP(object,image,K,D,r,t,true,cv.SOLVEPNP_ITERATIVE))continue;
    cv.Rodrigues(r,R);cv.projectPoints(object,r,t,K,D,projected);
    const translation=Array.from(t.data64F),rotation=Array.from(r.data64F),matrix=Array.from(R.data64F);
    if(![...translation,...rotation,...matrix].every(Number.isFinite)||translation[2]<.04||translation[2]>4)continue;
    if(model.some(p=>matrix[6]*p[0]+matrix[7]*p[1]+matrix[8]*p[2]+translation[2]<.02))continue;
    const error=Math.sqrt(PALM_IDS.reduce((sum,id,j)=>sum+(projected.data64F[j*2]-lm[id].x)**2+(projected.data64F[j*2+1]-lm[id].y)**2,0)/5);
    const angular=observed?rotationDistance(matrix,observed):0;
    if(entry.refine!==false&&(error>.015||angular>Math.PI/5))continue;
    candidates.push({translation,rotation,matrix,error,angular,method:entry.refine===false?'3D orientation + perspective position':'PnP'});
   }catch{}finally{r.delete();t.delete();R.delete();projected.delete();}
  }
  // The world frame distinguishes palm/back and the two planar PnP branches.
  // If the 2D fit degenerates, keep following this frame instead of freezing.
  candidates.sort((a,b)=>(a.error+.004*a.angular)-(b.error+.004*b.angular));
  if(!observed&&previous&&candidates.length>1&&Math.abs(candidates[0].error-candidates[1].error)<.0005){
   candidates.sort((a,b)=>rotationDistance(a.matrix,previous.matrix)-rotationDistance(b.matrix,previous.matrix));
  }
  return candidates[0]??null;
 }finally{object.delete();image.delete();K.delete();D.delete();}
}
