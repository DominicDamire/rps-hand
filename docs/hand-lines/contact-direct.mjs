export function reach(chain,lengths,target){
 const root=chain[0].clone(),total=lengths.reduce((a,b)=>a+b,0);
 if(root.distanceTo(target)>=total){const d=target.clone().sub(root).normalize();for(let i=1;i<4;i++)chain[i].copy(chain[i-1]).addScaledVector(d,lengths[i-1]);return;}
 for(let pass=0;pass<24;pass++){
  chain[3].copy(target);
  for(let i=2;i>=0;i--){const d=chain[i].clone().sub(chain[i+1]);if(d.lengthSq()<1e-12)d.copy(chain[Math.max(0,i-1)]).sub(chain[i+1]);if(d.lengthSq()<1e-12)d.set(0,1,0);chain[i].copy(chain[i+1]).addScaledVector(d.normalize(),lengths[i]);}
  chain[0].copy(root);
  for(let i=1;i<4;i++){const d=chain[i].clone().sub(chain[i-1]);if(d.lengthSq()<1e-12)d.set(0,1,0);chain[i].copy(chain[i-1]).addScaledVector(d.normalize(),lengths[i-1]);}
  if(chain[3].distanceTo(target)<1e-5)break;
 }
}

// Solve contact inside the finger's allowed plane, after its hinge constraints.
export function fitContact(thumb,finger,thumbLengths,fingerLengths,hinge){
 reach(thumb,thumbLengths,finger[3]);
 for(let pass=0;pass<24&&thumb[3].distanceTo(finger[3])>.0002;pass++){
  const target=thumb[3].clone().add(finger[3]).multiplyScalar(.5);
  if(hinge)target.addScaledVector(hinge,-target.clone().sub(finger[0]).dot(hinge));
  reach(finger,fingerLengths,target);reach(thumb,thumbLengths,finger[3]);
 }
 return thumb[3].distanceTo(finger[3]);
}

export class ContactLatch{
 constructor(){this.contact=null;this.pending=null;this.misses=0;this.observation=null;}
 update(observation,lm,width,height,enabled,palmFraction=.12,confirm=true){
  if(!enabled){this.contact=null;this.pending=null;this.misses=0;this.observation=null;return null;}
  if(observation===this.observation)return this.contact;this.observation=observation;
  // Restore v9's immediate, predictable fingertip cue: attach at 8 camera
  // pixels and release beyond 12. The connected fixed-length fitter below is
  // retained, so contact no longer separates joints or resizes the mesh.
  const distance=i=>Math.hypot((lm[4].x-lm[i].x)*width,(lm[4].y-lm[i].y)*height);
  if(this.contact&&distance(this.contact)>12)this.contact=null;
  if(!this.contact){const candidate=[8,12,16,20].sort((a,b)=>distance(a)-distance(b))[0];if(distance(candidate)<=8)this.contact=candidate;}
  return this.contact;
 }
}
