const clamp=v=>Math.max(-1,Math.min(1,v));
export function measureThumb(image,world,aspect=4/3){
 if(image?.length!==21||world?.length!==21||!world.every(p=>[p.x,p.y,p.z].every(Number.isFinite))||!image.every(p=>[p.x,p.y].every(Number.isFinite)))return null;
 const d=(a,b)=>Math.hypot(world[a].x-world[b].x,world[a].y-world[b].y,world[a].z-world[b].z);
 const reach=m=>d(m,m+3)/(d(m,m+1)+d(m+1,m+2)+d(m+2,m+3)||1);
 if([5,9,13,17].filter(m=>reach(m)>.82).length>=2)return null;
 // Track thumb base (2) to tip (4).
 const span=(Math.hypot(image[0].x-image[9].x,(image[0].y-image[9].y)/aspect)+Math.hypot(image[5].x-image[17].x,(image[5].y-image[17].y)/aspect))/2;
 if(span<.015)return null;
 const palm=(d(0,9)+d(5,17))/2;if(palm<.005)return null;
 const a=['x','y','z'].map(k=>world[3][k]-world[2][k]),b=['x','y','z'].map(k=>world[4][k]-world[3][k]);
 const length=Math.hypot(...a)*Math.hypot(...b);if(length<1e-8)return null;
 const straight=clamp(a.reduce((sum,v,i)=>sum+v*b[i],0)/length);
 // Thumb travel relative to its own base. No index-knuckle target or fixed bend threshold.
 const chain=d(2,3)+d(3,4);
 return {axes:[(image[2].x-image[4].x)/span,(image[2].y-image[4].y)/(aspect*span),(world[4].z-world[2].z)/chain,straight]};
}
const valid=s=>s?.axes?.length===4&&s.axes.every(Number.isFinite);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const failure=(message,retryIndex)=>Object.assign(new Error(message),{retryIndex});
const noise=s=>s.noise?.length===4?s.noise.map(v=>Number.isFinite(v)?Math.max(0,v):0):[0,0,0,0];
export function fitThumbDirections(samples){
 if(samples.length!==5||!samples.every(valid))throw Error('Capture centre and four directions.');
 const origin=samples[0].axes.slice(),rows=samples.slice(1,5).map(s=>s.axes.map((v,i)=>v-origin[i]));
 const targets=[[-1,0],[1,0],[0,-1],[0,1]];
 const names=['left','right','forward','backward'];
 rows.forEach((r,i)=>{const uncertainty=Math.hypot(...noise(samples[0]).map((v,k)=>v+noise(samples[i+1])[k]));
  if(Math.hypot(...r)<Math.max(.008,uncertainty*3))throw failure('The '+names[i]+' capture looks like centre. Retry only '+names[i]+', holding your thumb there until capture finishes.',i+1);
 });
 // Fit in units of this user's measured travel, not a fixed minimum thumb size.
 const scales=[0,1,2,3].map(i=>Math.max(.005,...rows.map(r=>Math.abs(r[i]))));
 const normalized=rows.map(r=>r.map((v,i)=>v/scales[i]));
 // Regularized least squares fits continuous travel, including cross-axis coupling.
 const a=Array.from({length:4},(_,i)=>Array.from({length:6},(_,j)=>j<4?normalized.reduce((sum,r)=>sum+r[i]*r[j],0)+(i===j?.0001:0):normalized.reduce((sum,r,k)=>sum+r[i]*targets[k][j-4],0)));
 for(let i=0;i<4;i++){
  let pivot=i;for(let k=i+1;k<4;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;
  [a[i],a[pivot]]=[a[pivot],a[i]];const scale=a[i][i];for(let j=i;j<6;j++)a[i][j]/=scale;
  for(let k=0;k<4;k++)if(k!==i){const f=a[k][i];for(let j=i;j<6;j++)a[k][j]-=f*a[i][j];}
 }
 const weights=[a.map((r,i)=>r[4]/scales[i]),a.map((r,i)=>r[5]/scales[i])];
 const errors=rows.map((r,i)=>Math.hypot(...weights.map((w,j)=>dot(w,r)-targets[i][j])));
 const worst=errors.indexOf(Math.max(...errors));
 if(weights.some(w=>!w.every(Number.isFinite))||errors[worst]>.25)throw failure('The '+names[worst]+' direction overlaps another direction. Retry only '+names[worst]+'.',worst+1);
 for(let i=0;i<samples.length;i++)if(weights.some(w=>Math.hypot(...w.map((v,k)=>v*noise(samples[i])[k]))>.18))throw failure('Tracking varied too much during '+(i?names[i-1]:'centre')+'. Hold still and retry this capture.',i);

 return {origin,weights};
}
export function fitThumbCalibration(samples){
 if(samples.length!==6||!samples.every(valid))throw Error('Capture centre, four directions and your resting fist.');
 const {origin,weights}=fitThumbDirections(samples.slice(0,5));
 const rest=samples[5].axes.slice();
 const separation=Math.min(...samples.slice(0,5).map(s=>Math.hypot(...s.axes.map((v,i)=>v-rest[i]))));
 if(separation<Math.max(.012,Math.hypot(...noise(samples[5]))*4))throw failure('Resting fist looks too similar to a walking position. Retry Rest with your thumb wrapped around your fingers.',5);
 return {origin,weights,rest,restRadius:Math.min(.24,separation*.4)};
}
export class ThumbJoystick {
 constructor(){this.speed=4.5;this.calibration=null;this.reset();}
 reset(){this.x=0;this.z=0;this.seen=-Infinity;this.reason=this.calibration?'SHOW THUMB':'SET UP THUMB';this.armed=false;}
 configure(samples){this.calibration=fitThumbCalibration(samples);this.reset();}
 receive(sample,time){
  if(!valid(sample)){this.reset();return;}
  this.seen=time;
  if(!this.calibration){this.reason='SET UP THUMB';return;}
  if(this.calibration.rest&&Math.hypot(...sample.axes.map((v,i)=>v-this.calibration.rest[i]))<this.calibration.restRadius){this.reset();this.seen=time;this.reason='FIST REST';return;}
  const delta=sample.axes.map((v,i)=>v-this.calibration.origin[i]);
  const [x,z]=this.calibration.weights.map(w=>dot(w,delta));
  if(!this.armed){this.x=this.z=0;this.reason='RETURN THUMB TO CENTRE';if(Math.hypot(x,z)<.3)this.armed=true;else return;}
  const dead=v=>Math.sign(v)*Math.max(0,(Math.abs(clamp(v))-.22)/.78);
  this.x=dead(x);this.z=dead(z);
  // A small secondary signal near a main direction is usually tracking cross-talk.
  // Deliberate diagonals retain both axes outside this narrow cone.
  if(Math.abs(this.x)<Math.abs(this.z)*.2)this.x=0;
  if(Math.abs(this.z)<Math.abs(this.x)*.2)this.z=0;
  const length=Math.hypot(this.x,this.z);if(length>1){this.x/=length;this.z/=length;}
  this.reason=length>.01?'MOVING':'THUMB CENTRED';
 }
 get direction(){return Math.hypot(this.x,this.z)>.01?[this.z<-.05?'FORWARD':this.z>.05?'BACKWARD':'',this.x<-.05?'LEFT':this.x>.05?'RIGHT':''].filter(Boolean).join(' '):null;}
 step(now,dt){if(now-this.seen>350)this.reset();const distance=this.speed*Math.min(.05,Math.max(0,dt));return {dx:this.x*distance,dz:this.z*distance};}
}
