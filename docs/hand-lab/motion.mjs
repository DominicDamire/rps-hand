import {FINGERS,JOINTS,blankAngles,constrainAngles} from './profile.mjs?v=5';
export const FIST={Thumb1:[-9,10,1],Thumb2:[1,-20,0],Thumb3:[-27,-47,-12],Index1:[80,0,0],Index2:[90,-7,0],Index3:[90,0,0],Middle1:[80,0,0],Middle2:[90,-2,0],Middle3:[90,0,0],Ring1:[80,0,0],Ring2:[90,0,0],Ring3:[80,0,0],Pinky1:[80,0,0],Pinky2:[90,8,0],Pinky3:[90,7,0]};
export function alignment(n){return [0,FIST[n][1],FIST[n][2]];}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
function bend(a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-b[i]);return Math.acos(clamp(u.reduce((s,x,i)=>s+x*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)||1),-1,1))*180/Math.PI;}
export function closure(points){return [5,9,13,17].map(i=>smooth((bend(points[i],points[i+1],points[i+2])-35)/40));}
export function referencePose(raw,curls){const out=structuredClone(raw);for(let f=1;f<5;f++){const t=curls[f-1],name=FINGERS[f];for(let k=1;k<=3;k++){const n=name+k;out[n][0]=clamp(raw[n][0],0,FIST[n][0])*(1-t)+FIST[n][0]*t;out[n][1]=k===1?raw[n][1]*(1-t):0;out[n][2]=0;}}return out;}
export class Settler{
 constructor(){this.reset();}reset(){this.value=null;this.last=null;this.quiet=0;this.anchor=null;}
 step(input,dt,threshold=1.5){if(!this.value){this.value=[...input];this.last=[...input];return [...input];}const diff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));dt=clamp(dt,.001,.1);if(threshold<=0){this.anchor=null;this.quiet=0;}
 if(threshold>0&&this.anchor){if(diff(input,this.anchor)<=threshold*2.5)return [...this.anchor];this.anchor=null;this.quiet=0;}
 this.quiet=threshold>0&&diff(input,this.last)<threshold?this.quiet+dt:0;this.last=[...input];const error=diff(input,this.value),alpha=1-Math.exp(-dt/(error>threshold*3?.025:.08));this.value=this.value.map((v,i)=>v+alpha*(input[i]-v));
 if(this.quiet>=.3){this.anchor=[...this.value];return [...this.anchor];}return [...this.value];}
}
export function depthEstimate(lm,world,aspect=1){const pairs=[[0,5],[0,9],[0,17],[5,17]],values=[];for(const [a,b] of pairs){const projected=Math.hypot((lm[b].x-lm[a].x)*aspect,lm[b].y-lm[a].y),physical=Math.hypot(world[b].x-world[a].x,world[b].y-world[a].y);if(projected>.015&&physical>.015)values.push(physical/projected);}if(!values.length)return null;values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)]/(2*Math.tan(Math.PI/6));}
export function positionAt(lm,depth,aspect,mirror=true){const h=2*depth*Math.tan(Math.PI/6);return [(lm[0].x-.5)*h*aspect*(mirror?-1:1),(.5-lm[0].y)*h,-depth];}

export function straightJoints(points,previous={},tolerance=10){const out={};for(const [f,i] of [['Index',5],['Middle',9],['Ring',13],['Pinky',17]])for(const [k,a,b,c] of [[2,i,i+1,i+2],[3,i+1,i+2,i+3]]){const n=f+k,angle=bend(points[a],points[b],points[c]);out[n]=tolerance>0&&angle<(previous[n]?tolerance+6:tolerance);}return out;}
export function pinchDistance(points){const a=points[4],b=points[8],w=points[5],p=points[17];return Math.hypot(...a.map((v,i)=>v-b[i]))/Math.max(.001,Math.hypot(...w.map((v,i)=>v-p[i])));}
