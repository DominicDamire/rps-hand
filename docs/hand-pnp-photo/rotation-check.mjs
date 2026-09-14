import * as T from 'three';
import {solvePalmPose} from './palm-pnp.mjs?v=rotation3';
import {loadCV} from './opencv-core.mjs';
import {rotationDistance} from './palm-orientation.mjs?v=rotation3';
export async function checkRotation(solve=solvePalmPose){
 const cv=await loadCV(),ids=[0,5,9,13,17],rows=[];let worst=0,step=0,fallbacks=0;
 for(const side of [1,-1])for(const aspect of [.7,4/3,1.8])for(const distorted of [false,true]){
  const model=[[0,0,0],[-.035,.07,0],[-.006,.078,0],[.021,.076,0],[.048,.069,0]].map(p=>[p[0]*side,p[1],p[2]]);
  let previous=null;
  for(let degrees=0;degrees<=360;degrees+=5){
   const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(.2,degrees*Math.PI/180,.15)),e=m.elements,R=[e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]],translation=new T.Vector3(.015,-.04,.45),focal=.8660254;
   const world=Array.from({length:21},()=>({x:0,y:0,z:0})),lm=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
   model.forEach((p,j)=>{let v=new T.Vector3(...p).applyMatrix4(m);world[ids[j]]={x:v.x,y:v.y,z:v.z};if(distorted&&j===3)v.add(new T.Vector3(.026,-.019,.008));v.add(translation);lm[ids[j]]={x:.5+focal/aspect*v.x/v.z,y:.5+focal*v.y/v.z};});
   const fit=solve(cv,model,lm,aspect,focal,previous,world);if(!fit)throw Error(`Missing pose ${side}/${aspect}/${degrees}`);
   const error=rotationDistance(R,fit.matrix)*180/Math.PI,change=previous?rotationDistance(previous.matrix,fit.matrix)*180/Math.PI:0;
   worst=Math.max(worst,error);step=Math.max(step,change);if(fit.method!=='PnP')fallbacks++;
   if(error>36.01||change>40)throw Error(`Rotation error ${error}, step ${change} at ${degrees}`);
   previous=fit;
  }
  rows.push({side,aspect,distorted,completed:true});
 }
 return {passed:true,frames:rows.length*73,worstDegrees:worst,maxStepDegrees:step,fallbacks,scenarios:rows};
}
