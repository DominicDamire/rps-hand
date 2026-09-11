import * as THREE from 'three';

// A palm mound covers the metacarpal without removing its underlying joint.
// Its root stays in the palm and its narrow end follows the thumb MCP.
export function buildThenar(rig){
 const records=[];
 for(const side of ['R','L']){
  const hand=rig.joints[side+'Hand'],rest=rig.rest,wrist=rest[side+'Hand'].world;
  const palm=rest[side+'Middle1'].world.clone().sub(wrist);
  const base=rest[side+'Thumb1'].world.clone().sub(wrist);
  const inside=palm.clone().multiplyScalar(base.dot(palm)/palm.lengthSq());
  base.copy(inside);
  const normal=new THREE.Vector3().crossVectors(rest[side+'Index1'].world.clone().sub(rest[side+'Pinky1'].world),palm).normalize();
  const rings=[[0,.002,.002],[.10,.020,.010],[.27,.022,.012],[.48,.019,.012],[.7,.015,.010],[.88,.010,.008],[1,.009,.008],[1.08,.002,.002]],sides=24;
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(rings.length*sides*3),indices=[];
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<sides;j++){const a=r*sides+j,b=r*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
  for(let j=1;j<sides-1;j++){indices.push(0,j+1,j);const a=(rings.length-1)*sides;indices.push(a,a+j,a+j+1);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  const source=rig.parts.find(m=>m.name.startsWith(side+'Hand__')),material=(Array.isArray(source.material)?source.material[0]:source.material).clone();material.side=THREE.DoubleSide;material.flatShading=false;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=side+'Hand__thumb_palm_mound';mesh.frustumCulled=false;hand.add(mesh);rig.parts.push(mesh);
  for(const m of rig.parts)if(m.name.startsWith(side+'Thumb1__'))m.userData.hiddenThumbBase=true;
  records.push({side,hand,base,normal,rings,sides,geometry,positions,end:new THREE.Vector3(),axis:new THREE.Vector3(),wide:new THREE.Vector3(),depth:new THREE.Vector3(),center:new THREE.Vector3()});
 }
 return ()=>{for(const r of records){
  r.hand.worldToLocal(rig.joints[r.side+'Thumb2'].getWorldPosition(r.end));r.axis.copy(r.end).sub(r.base);const length=r.axis.length();r.axis.normalize();
  r.wide.crossVectors(r.normal,r.axis).normalize();if(r.wide.lengthSq()<.01)r.wide.set(1,0,0);
  r.depth.crossVectors(r.axis,r.wide).normalize();let offset=0;
  for(const [t,width,thickness] of r.rings){r.center.copy(r.base).addScaledVector(r.axis,length*t);for(let j=0;j<r.sides;j++){const angle=j/r.sides*Math.PI*2,c=Math.cos(angle)*width,s=Math.sin(angle)*thickness;for(let k=0;k<3;k++)r.positions[offset++]=r.center.getComponent(k)+r.wide.getComponent(k)*c+r.depth.getComponent(k)*s;}}
  r.geometry.attributes.position.needsUpdate=true;r.geometry.computeVertexNormals();
 }};
}
