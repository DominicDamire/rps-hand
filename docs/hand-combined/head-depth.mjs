// Shared metric depth reference. Calibration changes gains, never bone lengths.
export function faceReference(face){const z=Math.abs(face?.matrix?.[14]||0)/100;return Number.isFinite(z)&&z>.01?z:null;}
export function calibratedDepth(raw,reference,metres,gain=1){if(!(raw>0&&reference>0&&metres>0))return null;return Math.max(.08,Math.min(4,metres+(raw/reference*metres-metres)*gain));}
export function eyeCenter(points){if(!points?.[33]||!points?.[263])return null;const a=points[33],b=points[263];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
