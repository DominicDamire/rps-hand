import * as THREE from 'three';
import {OBJLoader} from 'https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/loaders/OBJLoader.js';
import {MTLLoader} from 'https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/loaders/MTLLoader.js';
export class DustMap {
 constructor(scene){this.scene=scene;this.ready=false;this.meshes=[];this.ray=new THREE.Raycaster();this.spawn=new THREE.Vector3();this.eye=1.65;}
 async load(){
  const base=new URL('./dust2/',import.meta.url).href;
  const materials=await new MTLLoader().setPath(base).loadAsync('de_dust2.mtl');materials.preload();
  const obj=await new OBJLoader().setMaterials(materials).setPath(base).loadAsync('de_dust2.obj');
  obj.rotation.x=-Math.PI/2;obj.scale.setScalar(.0254);this.scene.add(obj);obj.updateMatrixWorld(true);
  obj.traverse(m=>{if(m.isMesh){const many=Array.isArray(m.material),mats=many?m.material:[m.material];const basic=mats.map(old=>new THREE.MeshBasicMaterial({map:old.map,color:old.color,side:THREE.DoubleSide}));m.material=many?basic:basic[0];this.meshes.push(m);}});
  for(const [x,z] of [[-38,20],[-30,20],[-20,20],[0,0],[-10,-20]]){const y=this.floor(x,z,12);if(y!==null){this.spawn.set(x,y+this.eye,z);this.ready=true;return;}}
  throw Error('No walkable spawn found');
 }
 floor(x,z,top){this.ray.set(new THREE.Vector3(x,top,z),new THREE.Vector3(0,-1,0));this.ray.far=25;for(const h of this.ray.intersectObjects(this.meshes,false)){const normal=h.face.normal.clone().transformDirection(h.object.matrixWorld);if(normal.y>.5)return h.point.y;}return null;}
 blocked(position,dx,dz){const length=Math.hypot(dx,dz);if(!length)return false;const direction=new THREE.Vector3(dx/length,0,dz/length);for(const height of [.45,1.25]){this.ray.set(new THREE.Vector3(position.x,position.y-this.eye+height,position.z),direction);this.ray.far=length+.25;if(this.ray.intersectObjects(this.meshes,false).length)return true;}return false;}
 move(position,dx,dz){if(!this.ready)return;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));for(let i=0;i<steps;i++)for(const [sx,sz] of [[dx/steps,0],[0,dz/steps]]){if(!sx&&!sz)continue;if(this.blocked(position,sx,sz))continue;const x=position.x+sx,z=position.z+sz,oldFloor=position.y-this.eye,y=this.floor(x,z,oldFloor+.4);if(y===null||y<oldFloor-1.5)continue;position.set(x,y+this.eye,z);}}
}
