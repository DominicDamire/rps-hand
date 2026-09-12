// Fixed decorative face dots; no expression landmarks are drawn or transmitted.
export const faceIds=[10,152,234,454,33,133,263,362];
const template=Array.from({length:40},(_,i)=>{const t=i*Math.PI*2/40;return [Math.cos(t)*.5,Math.sin(t)*.5];});
// Fixed eyes, nose and closed mouth. These never use eye/lip expression positions.
for(const x of [-.23,-.18,-.13,.13,.18,.23])template.push([x,-.12]);
for(const p of [[0,-.05],[0,.02],[0,.09],[-.05,.12],[.05,.12],[-.15,.25],[-.075,.25],[0,.25],[.075,.25],[.15,.25]])template.push(p);
export function drawFace(ctx,points,w,h){
 const top=points?.[10],chin=points?.[152],left=points?.[234],right=points?.[454];if(!top||!chin||!left||!right)return;
 const cx=(top.x+chin.x)/2,cy=(top.y+chin.y)/2,dx=right.x-left.x,dy=right.y-left.y,vx=chin.x-top.x,vy=chin.y-top.y;
 ctx.fillStyle='#8ee3bf';for(const [x,y] of template)ctx.fillRect((1-(cx+dx*x+vx*y))*w-1,(cy+dy*x+vy*y)*h-1,2,2);
}
export function drawShoulders(ctx,pose,face,w,h){
 const a=pose?.points?.[11],b=pose?.points?.[12];if(!a||!b||a.visibility<.4||b.visibility<.4)return;
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},chin=face?.points?.[152];ctx.strokeStyle='#8ee3bf';ctx.fillStyle='#8ee3bf';ctx.lineWidth=1.5;
 const line=(a,b)=>{ctx.beginPath();ctx.moveTo((1-a.x)*w,a.y*h);ctx.lineTo((1-b.x)*w,b.y*h);ctx.stroke();};line(a,b);if(chin)line(mid,chin);
 for(const p of [a,b,mid]){ctx.beginPath();ctx.arc((1-p.x)*w,p.y*h,3,0,Math.PI*2);ctx.fill();}
}
export function encodeAux(data){if(!data.face)return data;const {points,...face}=data.face;return {...data,face:{...face,indexedPoints:Object.entries(points).flatMap(([id,p])=>[+id,Math.round(p.x*65535),Math.round(p.y*65535)])}};}
export function decodeAux(data){if(!data.face?.indexedPoints)return data;const {indexedPoints,...face}=data.face,points={};for(let i=0;i<indexedPoints.length;i+=3)points[indexedPoints[i]]={x:indexedPoints[i+1]/65535,y:indexedPoints[i+2]/65535};return {...data,face:{...face,points}};}
