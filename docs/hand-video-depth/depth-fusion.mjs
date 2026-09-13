// Optional map correction uses a frozen reference for each hand. Never infer
// distance from finger curl. Reject stale maps and maps of a previous hand pose.
export class DepthFusion {
 constructor(){this.reset();}
 reset(){this.samples=new Map();this.references=new Map();}
 accept(samples,time){for(const s of samples)this.samples.set(s.label,{...s,time});}
 correct(label,base,uv,now,enabled){
  if(!enabled||!(base>0)||!uv)return base;
  const s=this.samples.get(label);
  if(!s||now-s.time>2500||s.spread>.25||!(s.meters>.03&&s.meters<20)||Math.hypot(uv[0]-s.uv[0],uv[1]-s.uv[1])>.045)return base;
  if(!this.references.has(label))this.references.set(label,{meters:s.meters,base});
  const r=this.references.get(label),target=r.base*s.meters/r.meters;
  // Large disagreement is insufficient evidence to override palm geometry.
  if(target/base<.7||target/base>1.3)return base;
  return base*.75+target*.25;
 }
}
