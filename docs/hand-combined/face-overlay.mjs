// Full MediaPipe face points, matching the original face app's point overlay.
export function drawFace(ctx,points,w,h){
 if(!points)return;ctx.fillStyle='#8ee3bf';
 for(const p of Object.values(points)){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;ctx.fillRect((1-p.x)*w-1,p.y*h-1,2,2);}
}
export function encodeAux(data){
 if(!data.face)return data;
 const packedPoints=[];for(const p of data.face.points)packedPoints.push(Math.round(p.x*65535),Math.round(p.y*65535));
 const {points,...face}=data.face;return {...data,face:{...face,packedPoints}};
}
export function decodeAux(data){
 if(!data.face?.packedPoints)return data;
 const {packedPoints,...face}=data.face,points=[];for(let i=0;i<packedPoints.length;i+=2)points.push({x:packedPoints[i]/65535,y:packedPoints[i+1]/65535});
 return {...data,face:{...face,points}};
}
