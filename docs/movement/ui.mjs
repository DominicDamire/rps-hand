export function setupUI(){
 const $=id=>document.getElementById(id),panel=$('panel'),preview=$('preview');
 const keepInside=el=>{const r=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(r.left,innerWidth-r.width-8))+'px';el.style.top=Math.max(8,Math.min(r.top,innerHeight-r.height-8))+'px';el.style.right='auto';el.style.bottom='auto';};
 function draggable(el,handle){let drag;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=el.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};handle.setPointerCapture(e.pointerId);e.preventDefault();});
  handle.addEventListener('pointermove',e=>{if(!drag)return;el.style.left=drag.left+e.clientX-drag.x+'px';el.style.top=drag.top+e.clientY-drag.y+'px';el.style.right='auto';el.style.bottom='auto';keepInside(el);});
  const done=()=>{drag=null;};handle.addEventListener('pointerup',done);handle.addEventListener('pointercancel',done);handle.addEventListener('lostpointercapture',done);
  handle.addEventListener('keydown',e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!d)return;e.preventDefault();const r=el.getBoundingClientRect();el.style.left=r.left+d[0]+'px';el.style.top=r.top+d[1]+'px';keepInside(el);});
 }
 draggable(panel,$('panelHandle'));draggable(preview,$('previewHandle'));
 $('collapse').onclick=()=>{const collapsed=panel.classList.toggle('collapsed');$('collapse').textContent=collapsed?'Show controls':'Hide controls';$('collapse').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(()=>keepInside(panel));};
 $('hidePreview').onclick=()=>{preview.hidden=true;$('showPreview').hidden=false;};
 $('showPreview').onclick=()=>{preview.hidden=false;$('showPreview').hidden=true;keepInside(preview);};
 $('resetLayout').onclick=()=>{panel.removeAttribute('style');preview.removeAttribute('style');panel.classList.remove('collapsed');$('collapse').textContent='Hide controls';$('collapse').setAttribute('aria-expanded','true');preview.hidden=false;$('showPreview').hidden=true;};
 addEventListener('resize',()=>{if(panel.style.left)keepInside(panel);if(preview.style.left&&!preview.hidden)keepInside(preview);});
 const canvas=$('tracking'),ctx=canvas.getContext('2d');
 const edges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
 return {clear(){ctx.clearRect(0,0,canvas.width,canvas.height);},camera(on){$('previewNote').hidden=on;this.clear();},draw(hands,w,h,active=false){
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;$('previewImage').style.aspectRatio=w+'/'+h;}
  ctx.clearRect(0,0,w,h);if(preview.hidden)return;
  const point=p=>[(1-p.x)*w,p.y*h];
  for(const hand of hands??[]){if(hand.length!==21)continue;
   ctx.lineWidth=Math.max(2,w/240);ctx.lineCap='round';
   for(const [a,b]of edges){ctx.strokeStyle=a>=5&&b<=8?'#ffdf75':'#67ffbb';ctx.beginPath();ctx.moveTo(...point(hand[a]));ctx.lineTo(...point(hand[b]));ctx.stroke();}
   for(let i=0;i<21;i++){ctx.fillStyle=i===8?'#ffdf75':'#e5fff3';ctx.beginPath();ctx.arc(...point(hand[i]),i===8?w/65:w/160,0,Math.PI*2);ctx.fill();}
   const [x,y]=point(hand[8]);ctx.strokeStyle=active?'#ffdf75':'#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,w/38,0,Math.PI*2);ctx.stroke();
  }
 }};
}
