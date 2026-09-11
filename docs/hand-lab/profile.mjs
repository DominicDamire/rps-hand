export const FINGERS=['Thumb','Index','Middle','Ring','Pinky'];
export const JOINTS=FINGERS.flatMap(n=>[1,2,3].map(i=>n+i));
export const blankAngles=()=>Object.fromEntries(JOINTS.map(n=>[n,[0,0,0]]));
export const blankLimits=()=>Object.fromEntries(JOINTS.map(n=>[n,[0,1,2].map(()=>({enabled:false,min:-180,max:180}))]));
export const emptyProfile=()=>({schema:'hand-pose-lab',version:1,rig:'ball-joint-doll-v80',axes:'anatomical-local-XYZ',tolerance:.18,limits:{R:blankLimits(),L:blankLimits()},poses:[]});
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=v=>{const n=Math.hypot(...v);if(n<1e-7)throw Error('Palm landmarks are degenerate');return v.map(x=>x/n);};
export function features(points){
 if(!Array.isArray(points)||points.length!==21||points.some(p=>!Array.isArray(p)||p.length!==3||p.some(x=>!Number.isFinite(x))))throw Error('Expected 21 finite world landmarks');
 const up=sub(points[9],points[0]),scale=Math.hypot(...up),y=unit(up),rawX=sub(points[5],points[17]),x=unit(rawX.map((v,i)=>v-dot(rawX,y)*y[i]));
 const z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
 return points.flatMap(p=>{const v=sub(p,points[0]);return [dot(v,x)/scale,dot(v,y)/scale,dot(v,z)/scale];});
}
export function matchPose(profile,feature,side){
 let best=null;
 for(const pose of profile.poses){if(pose.side!==side)continue;const distance=Math.sqrt(feature.reduce((s,v,i)=>s+(v-pose.features[i])**2,0)/60);if(distance<=profile.tolerance&&(!best||distance<best.distance))best={pose,distance};}
 return best;
}
export function clampAngles(angles,limits){return Object.fromEntries(JOINTS.map(n=>[n,angles[n].map((v,i)=>limits[n][i].enabled?Math.max(limits[n][i].min,Math.min(limits[n][i].max,v)):v)]));}
export function validateProfile(input){
 if(input?.schema!=='hand-pose-lab'||input.version!==1||input.rig!=='ball-joint-doll-v80'||input.axes!=='anatomical-local-XYZ')throw Error('This is not a compatible Hand Pose Lab profile');
 const out=emptyProfile();const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(!finite(input.tolerance,.03,.4))throw Error('Invalid match tolerance');out.tolerance=input.tolerance;
 for(const side of ['R','L'])for(const n of JOINTS)for(let a=0;a<3;a++){
  const l=input.limits?.[side]?.[n]?.[a];if(!l||typeof l.enabled!=='boolean'||!finite(l.min,-180,180)||!finite(l.max,-180,180)||l.min>l.max)throw Error('Invalid joint limits: '+side+n);
  out.limits[side][n][a]={enabled:l.enabled,min:l.min,max:l.max};
 }
 if(!Array.isArray(input.poses)||input.poses.length>100)throw Error('A profile can contain at most 100 poses');const ids=new Set();
 for(const p of input.poses){
  if(typeof p.id!=='string'||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!['R','L'].includes(p.side))throw Error('Invalid or duplicate pose');ids.add(p.id);
  if(!Array.isArray(p.features)||p.features.length!==63||!p.features.every(x=>finite(x,-20,20)))throw Error('Invalid pose signature');
  const angles=blankAngles();for(const n of JOINTS){if(!Array.isArray(p.angles?.[n])||p.angles[n].length!==3||!p.angles[n].every(x=>finite(x,-180,180)))throw Error('Invalid angles: '+n);angles[n]=[...p.angles[n]];}
  let capture=null;if(p.capture!=null){if(typeof p.capture!=='string'||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(p.capture)||p.capture.length>700000)throw Error('Invalid saved image');capture=p.capture;}
  out.poses.push({id:p.id,name:p.name.trim(),side:p.side,features:[...p.features],angles,capture});
 }
 return out;
}
