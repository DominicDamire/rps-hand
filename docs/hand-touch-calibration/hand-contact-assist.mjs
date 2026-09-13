import {findTouchPair,solveTouchDepth} from './hand-pair-depth.mjs?v=touch2.2';
// Temporary per-frame correction: never write to the captured sweep mapping.
export class HandContactAssist {
 constructor(){this.reset();}
 reset(){this.key=null;this.since=0;this.lastTime=null;this.observations=0;}
 update({left,right,aspect=1,now,enabled}){
  if(!enabled||!left||!right||now-left.seen>=250||now-right.seen>=250||left.time!==right.time||left.confidence<.5||right.confidence<.5){this.reset();return null;}
  const pair=findTouchPair(left,right,aspect,this.key);
  if(!pair){this.reset();return null;}
  if(!this.key){this.since=now;this.observations=0;}this.key=pair.key;
  if(left.time!==this.lastTime){this.lastTime=left.time;this.observations++;}
  if(now-this.since<100||this.observations<2)return null;
  const fit=solveTouchDepth(pair.a,pair.b,left.points[0],right.points[0],{surfaceGap:pair.surfaceGap});
  return fit?{...fit,key:pair.key}:null;
 }
}
