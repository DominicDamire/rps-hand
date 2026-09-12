import * as T from 'three';
export function directDriver(rig,tips){
 const matrices=new Map(rig.parts.map(m=>{m.userData.directRestMatrix??=m.matrix.clone();return [m,m.userData.directRestMatrix];}));let held=null,lastSide=null,contact=null;const calibrated={};
 const fingers=['Thumb','Index','Middle','Ring','Pinky'];
 return function(points,side,palmQ,dt,{smooth=0,threshold=0,contactPixels=0,coupling=0,fixedLengths=false,thickness=1,tipInset=0,lm,width,height}){
  if(lastSide!==side){held=null;contact=null;lastSide=side;}
  let p=points.map(v=>v.clone());
  if(fixedLengths&&!calibrated[side])calibrated[side]=Array.from({length:5},(_,f)=>Array.from({length:3},(_,k)=>Math.max(.005,p[2+f*4+k].distanceTo(p[1+f*4+k]))));
  const raw=p.map(v=>v.clone());
  if(fixedLengths)for(let f=0;f<5;f++)for(let k=0;k<3;k++){const i=1+f*4+k,dir=raw[i+1].clone().sub(raw[i]);if(dir.lengthSq()>1e-10)p[i+1].copy(p[i]).addScaledVector(dir.normalize(),calibrated[side][f][k]);}

  if(!held)held=p.map(v=>v.clone());
  const alpha=smooth>0?1-Math.exp(-dt/(smooth/1000)):1;
  p=p.map((v,i)=>{if(v.distanceTo(held[i])>threshold/1000)held[i].lerp(v,alpha);return held[i].clone();});
  // Optional distal coupling. Zero leaves every tracked segment untouched.
  if(coupling>0)for(const base of [5,9,13,17]){
   const a=p[base+1].clone().sub(p[base]).normalize(),b=p[base+2].clone().sub(p[base+1]).normalize(),c=p[base+3].clone().sub(p[base+2]);
   const bend=new T.Quaternion().setFromUnitVectors(a,b),linked=b.clone().applyQuaternion(bend).multiplyScalar(c.length()).add(p[base+2]);p[base+3].lerp(linked,coupling);
  }
  const distance=i=>Math.hypot((lm[4].x-lm[i].x)*width,(lm[4].y-lm[i].y)*height);
  if(!contactPixels)contact=null;
  else if(contact&&distance(contact)>contactPixels*1.5)contact=null;
  if(!contact&&contactPixels){const nearest=[8,12,16,20].sort((a,b)=>distance(a)-distance(b))[0];if(distance(nearest)<=contactPixels)contact=nearest;}
  if(contact){const mid=p[4].clone().add(p[contact]).multiplyScalar(.5);p[4].copy(mid);p[contact].copy(mid);}
  rig.root.position.set(0,0,0);rig.root.updateMatrixWorld(true);
  const hand=rig.joints[side+'Hand'];hand.position.copy(hand.parent.worldToLocal(p[0].clone()));rig.setWorldQuat(side+'Hand',palmQ);rig.refresh(hand);
  for(let fi=0;fi<5;fi++)for(let k=1;k<=3;k++){
   const name=side+fingers[fi]+k,j=rig.joints[name],index=1+fi*4+k-1;
   const rest=k<3?rig.rest[side+fingers[fi]+(k+1)].world.clone().sub(rig.rest[name].world):tips[side+fingers[fi]].clone();
   const target=p[index+1].clone().sub(p[index]),axis=rest.clone().normalize(),length=rest.length();
   if(target.length()<1e-6||length<1e-6)continue;
   j.position.copy(j.parent.worldToLocal(p[index].clone()));
   const facing=axis.clone().applyQuaternion(palmQ),q=new T.Quaternion().setFromUnitVectors(facing,target.clone().normalize()).multiply(palmQ);
   rig.setWorldQuat(name,q);rig.refresh(j);
   const basis=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis),rot=new T.Matrix4().makeRotationFromQuaternion(basis);
   const stretch=rot.clone().multiply(new T.Matrix4().makeScale(thickness,thickness,(target.length()+(k===3?tipInset/1000:0))/length)).multiply(rot.clone().invert());
   for(const m of rig.parts)if(m.parent===j){m.matrixAutoUpdate=false;m.matrix.copy(stretch).multiply(matrices.get(m));m.matrixWorldNeedsUpdate=true;}
  }
  rig.root.updateMatrixWorld(true);return {points:p,contact};
 };
}
