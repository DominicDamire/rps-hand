// Head yaw controls angular velocity; pitch remains an absolute look angle.
export class HeadLook {
 constructor(){this.heading=0;this.speed=0;this.gain=1.5;this.deadzoneDegrees=12;}
 update(yaw,dt,valid=true){
  const dead=this.deadzoneDegrees*Math.PI/180,full=Math.max(30,this.deadzoneDegrees+12)*Math.PI/180;
  const amount=valid&&Number.isFinite(yaw)?Math.max(0,Math.min(1,(Math.abs(yaw)-dead)/(full-dead))):0;
  this.speed=amount?Math.sign(yaw)*Math.pow(amount,1.6)*(Math.PI/2)*(this.gain/1.5):0;
  this.heading+=this.speed*Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
  return this.heading;
 }
}
