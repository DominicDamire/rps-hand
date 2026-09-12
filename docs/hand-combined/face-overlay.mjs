// Sparse orange face guide; expression classification is disabled in the tracker.
export const outline=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
export const faceIds=Array.from({length:468},(_,i)=>i);
export function drawFace(ctx,points,w,h){if(!points)return;ctx.fillStyle='#8ee3bf';for(const p of Object.values(points))ctx.fillRect((1-p.x)*w-1,p.y*h-1,2,2);}
export function drawShoulders(ctx,pose,face,w,h){
 const a=pose?.points?.[11],b=pose?.points?.[12];if(!a||!b||a.visibility<.4||b.visibility<.4)return;
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},chin=face?.points?.[152];ctx.strokeStyle='#8ee3bf';ctx.fillStyle='#8ee3bf';ctx.lineWidth=1.5;
 const line=(a,b)=>{ctx.beginPath();ctx.moveTo((1-a.x)*w,a.y*h);ctx.lineTo((1-b.x)*w,b.y*h);ctx.stroke();};line(a,b);if(chin)line(mid,chin);
 for(const p of [a,b,mid]){ctx.beginPath();ctx.arc((1-p.x)*w,p.y*h,3,0,Math.PI*2);ctx.fill();}
}
export function encodeAux(data){if(!data.face)return data;const {points,...face}=data.face;return {...data,face:{...face,indexedPoints:Object.entries(points).flatMap(([id,p])=>[+id,Math.round(p.x*65535),Math.round(p.y*65535)])}};}
export function decodeAux(data){if(!data.face?.indexedPoints)return data;const {indexedPoints,...face}=data.face,points={};for(let i=0;i<indexedPoints.length;i+=3)points[indexedPoints[i]]={x:indexedPoints[i+1]/65535,y:indexedPoints[i+2]/65535};return {...data,face:{...face,points}};}
