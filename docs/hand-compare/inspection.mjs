import * as T from 'three';
export function installInspection({controls,getCamera,reset,points}){
 const bar=document.querySelector('.toolbar'),state={active:false};const help=document.createElement('span');help.textContent='Drag to rotate · right-drag to pan · scroll/pinch to zoom';help.hidden=true;
 const center=()=>{const p=points();return p.length?new T.Box3().setFromPoints(p).getCenter(new T.Vector3()):new T.Vector3(0,0,-.5);};
 function inspect(side=false){state.active=true;const camera=getCamera(),target=center();controls.enabled=true;controls.enableDamping=false;controls.enableRotate=true;controls.enablePan=true;controls.enableZoom=true;controls.minDistance=.03;controls.maxDistance=10;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;controls.target.copy(target);if(side)camera.position.copy(target).add(new T.Vector3(.45,0,0));else camera.position.copy(target).add(new T.Vector3(.18,.1,.45));camera.up.set(0,1,0);camera.lookAt(target);camera.updateProjectionMatrix();controls.update();document.querySelector('#scene').style.transform='none';document.querySelector('#cameraFrame').style.display='none';help.hidden=false;}
 function mirror(){state.active=false;controls.enabled=false;help.hidden=true;reset();}
 for(const [name,fn]of [['Mirror view',mirror],['3D view — rotate',()=>inspect()],['Side view',()=>inspect(true)]]){const b=document.createElement('button');b.textContent=name;b.onclick=fn;bar.append(b);}bar.append(help);
 document.querySelector('#viewReset').onclick=mirror;return state;
}
