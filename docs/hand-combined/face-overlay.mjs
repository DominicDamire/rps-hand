// Sparse orange face guide; expression classification is disabled in the tracker.
export const outline=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
export const faceIds=[...new Set([...outline,33,133,263,362,1])];
export function drawFace(ctx,points,w,h){
 if(!points)return;ctx.strokeStyle='#ffad55';ctx.lineWidth=1.5;
 const path=pts=>{ctx.beginPath();pts.forEach((p,i)=>ctx[i?'lineTo':'moveTo']((1-p.x)*w,p.y*h));ctx.stroke();};
 if(outline.every(i=>points[i]))path(outline.map(i=>points[i]));
 // Nose and closed mouth are a schematic attached to the face, not tracked expressions.
 const a=points[10],b=points[152],left=points[234],right=points[454];if(!a||!b||!left||!right)return;
 const at=(x,y)=>({x:a.x+(b.x-a.x)*y+(right.x-left.x)*x,y:a.y+(b.y-a.y)*y+(right.y-left.y)*x});
 path([at(-.3,.36),at(-.13,.36)]);path([at(.13,.36),at(.3,.36)]);
 path([at(0,.38),at(-.06,.61),at(.07,.61)]);path([at(-.17,.76),at(0,.79),at(.17,.76)]);
}
export function encodeAux(data){if(!data.face)return data;const {points,...face}=data.face;return {...data,face:{...face,indexedPoints:Object.entries(points).flatMap(([id,p])=>[+id,Math.round(p.x*65535),Math.round(p.y*65535)])}};}
export function decodeAux(data){if(!data.face?.indexedPoints)return data;const {indexedPoints,...face}=data.face,points={};for(let i=0;i<indexedPoints.length;i+=3)points[indexedPoints[i]]={x:indexedPoints[i+1]/65535,y:indexedPoints[i+2]/65535};return {...data,face:{...face,points}};}
