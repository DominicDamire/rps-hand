// Preserve identity using palm motion rather than a single handedness label.
const ids=[0,5,9,13,17];
const distance=(a,b)=>ids.reduce((s,i)=>s+Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y),0)/ids.length;
export function stableHands(current,recent,now,grace){
 const previous=[...recent.values()].filter(h=>now-h.seen<Math.min(grace,350));
 const edges=[];current.forEach((h,i)=>previous.forEach(p=>{const d=distance(h.landmarks,p.landmarks);if(d<.18)edges.push({i,p,d});}));
 edges.sort((a,b)=>a.d-b.d);const assigned=new Set(),labels=new Set();
 for(const {i,p} of edges)if(!assigned.has(i)&&!labels.has(p.label)){current[i]={...current[i],label:p.label};assigned.add(i);labels.add(p.label);}
 const unique=[];
 for(const i of current.map((_,i)=>i).sort((a,b)=>Number(assigned.has(b))-Number(assigned.has(a)))){let h=current[i];if(unique.some(p=>distance(h.landmarks,p.landmarks)<.025))continue;
  if(!assigned.has(i)&&labels.has(h.label))h={...h,label:h.label==='Left'?'Right':'Left'};
  if(unique.some(p=>p.label===h.label))continue;labels.add(h.label);unique.push(h);
 }
 for(const h of unique)recent.set(h.label,h);
 for(const [label,h]of recent){if(now-h.seen>grace){recent.delete(label);continue;}
  if(!unique.some(p=>p.label===label)&&!unique.some(p=>distance(p.landmarks,h.landmarks)<.18))unique.push(h);
 }
 return unique.slice(0,2);
}
