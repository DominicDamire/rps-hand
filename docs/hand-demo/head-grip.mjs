import * as T from 'three';
export function fitHeadGrip(points,chains,lengths,hinges,targets,strength=1){
 const delta=new T.Vector3();let count=0;for(let f=0;f<5;f++)if(targets[f]){delta.add(targets[f].clone().sub(chains[f][3]));count++;}if(!count)return;
 delta.multiplyScalar(strength/count);if(delta.length()>.10)delta.setLength(.10);points[0].add(delta);for(const chain of chains)for(const p of chain)p.add(delta);
 for(let f=0;f<5;f++){if(!targets[f])continue;const changes=[0,0,0],chain=chains[f],hinge=hinges.get(f),goal=chain[3].clone().lerp(targets[f],strength);
 for(let pass=0;pass<8;pass++)for(let k=2;k>=0;k--){const toTip=chain[3].clone().sub(chain[k]).normalize(),toGoal=goal.clone().sub(chain[k]).normalize();let q;
 if(hinge){const a=toTip.clone().addScaledVector(hinge,-toTip.dot(hinge)).normalize(),b=toGoal.clone().addScaledVector(hinge,-toGoal.dot(hinge)).normalize(),angle=Math.atan2(new T.Vector3().crossVectors(a,b).dot(hinge),a.dot(b));const step=T.MathUtils.clamp(angle,Math.max(-.08,-.4-changes[k]),Math.min(.08,.4-changes[k]));changes[k]+=step;q=new T.Quaternion().setFromAxisAngle(hinge,step);}
 else{q=new T.Quaternion().setFromUnitVectors(toTip,toGoal);q=new T.Quaternion().slerp(q,.3);}
 for(let j=k+1;j<4;j++)chain[j].sub(chain[k]).applyQuaternion(q).add(chain[k]);
 }
 }
}
