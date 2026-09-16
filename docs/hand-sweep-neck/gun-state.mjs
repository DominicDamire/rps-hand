// Stateful gates use fresh tracking samples, never render-frame counts.
export class BodyGunState {
 constructor(){this.reset();}
 reset(){this.held=false;this.armed=false;this.since=null;this.last=null;this.aim=false;}
 step({time,valid,near,lookingDown,open,grip,indexFree,eyeDistance,eyeDepth},c){
  let picked=false,dropped=false;
  if(!valid||this.last!==null&&(time-this.last>350||time<=this.last)){this.armed=false;this.since=null;this.aim=false;if(!valid){if(this.last!==null&&time-this.last>700){dropped=this.held;this.held=false;}return {picked,dropped,held:this.held,aim:false};}}
  this.last=time;
  if(!this.held){
   this.aim=false;if(!near||!lookingDown){this.armed=false;this.since=null;}
   else if(open){this.armed=true;this.since=null;}
   else if(this.armed&&grip&&indexFree){this.since??=time;if(time-this.since>=c.pickMs){this.held=true;picked=true;this.armed=false;this.since=null;}}
   else this.since=null;
  }else{
   if(!grip){this.since??=time;if(time-this.since>=c.dropMs){this.held=false;this.aim=false;dropped=true;this.since=null;}}else this.since=null;
   if(this.held)this.aim=c.aimEnabled&&eyeDistance<(this.aim?c.aimExit:c.aimEnter)&&Math.abs(eyeDepth)<(this.aim?c.depthExit:c.depthEnter);
  }
  return {picked,dropped,held:this.held,aim:this.aim};
 }
}
