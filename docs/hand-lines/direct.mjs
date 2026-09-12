import * as T from 'three';
const FINGERS=['Thumb','Index','Middle','Ring','Pinky'];
export function directDriver(rig,tips){
 const matrices=new Map(rig.parts.map(m=>{m.userData.directRestMatrix??=m.matrix.clone();return [m,m.userData.directRestMatrix];}));let contact=null,lastSide=null,lastShape='';
 return function(points,side,palmQ,dt,{contactPixels=0,thickness=1,tipInset=0,lm,width,height}){
  if(lastSide!==side){contact=null;lastSide=side;lastShape='';}
  const p=points.map(v=>v.clone());
  const distance=i=>Math.hypot((lm[4].x-lm[i].x)*width,(lm[4].y-lm[i].y)*height);
  if(!contactPixels)contact=null;else if(contact&&distance(contact)>contactPixels*1.5)contact=null;
  if(!contact&&contactPixels){const i=[8,12,16,20].sort((a,b)=>distance(a)-distance(b))[0];if(distance(i)<=contactPixels)contact=i;}
  if(contact){const midpoint=p[4].clone().add(p[contact]).multiplyScalar(.5);p[4].copy(midpoint);p[contact].copy(midpoint);}
  rig.root.position.set(0,0,0);rig.root.updateMatrixWorld(true);const hand=rig.joints[side+'Hand'];hand.position.copy(hand.parent.worldToLocal(p[0].clone()));rig.setWorldQuat(side+'Hand',palmQ);rig.refresh(hand);
  const shape=side+':'+thickness+':'+tipInset,shapeChanged=shape!==lastShape;
  for(let f=0;f<5;f++)for(let k=1;k<=3;k++){
   const name=side+FINGERS[f]+k,j=rig.joints[name],i=1+4*f+k-1,rest=k<3?rig.rest[side+FINGERS[f]+(k+1)].world.clone().sub(rig.rest[name].world):tips[side+FINGERS[f]].clone(),axis=rest.clone().normalize();
   const target=p[i+1].clone().sub(p[i]);j.position.copy(j.parent.worldToLocal(p[i].clone()));const facing=axis.clone().applyQuaternion(palmQ),q=new T.Quaternion().setFromUnitVectors(facing,target.normalize()).multiply(palmQ);rig.setWorldQuat(name,q);rig.refresh(j);
   // Geometry transforms are changed ONLY by the user's thickness/inset controls.
   if(shapeChanged){const rot=new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis));const shapeMatrix=rot.clone().multiply(new T.Matrix4().makeScale(thickness,thickness,1+(k===3?tipInset/1000/rest.length():0))).multiply(rot.clone().invert());for(const m of rig.parts)if(m.parent===j){m.matrixAutoUpdate=false;m.matrix.copy(shapeMatrix).multiply(matrices.get(m));m.matrixWorldNeedsUpdate=true;}}
  }
  lastShape=shape;rig.root.updateMatrixWorld(true);return {points:p,contact};
 };
}
