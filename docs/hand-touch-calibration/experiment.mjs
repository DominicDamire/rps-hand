import {imagePalmSize} from './size-wall-depth.mjs';
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
function error(sample,k){const p=sample.A.map((a,i)=>a*k.L+sample.B[i]*k.R-sample.c[i]);return Math.hypot(...p);}
export function fitContact(samples,anchor){let aa=0,bb=0,ab=0,ac=0,bc=0;for(const s of samples)for(let i=0;i<3;i++){const a=s.A[i],b=s.B[i],c=s.c[i];aa+=a*a;bb+=b*b;ab+=a*b;ac+=a*c;bc+=b*c;}const ridge=(aa+bb)*.025;aa+=ridge;bb+=ridge;ac+=ridge*anchor.L;bc+=ridge*anchor.R;const det=aa*bb-ab*ab;if(det<1e-10)return null;const k={L:(ac*bb-bc*ab)/det,R:(bc*aa-ac*ab)/det};return ['L','R'].every(s=>k[s]>anchor[s]*.5&&k[s]<anchor[s]*1.5)?k:null;}
export function installExperiment({container}){
 const panel=document.createElement('section');panel.style.display='block';panel.innerHTML=`<h2>Hands-touching calibration</h2><p>Five seconds to get ready, then eight seconds recording: four seconds toward your chest, four seconds back toward the camera. Keep index fingertips touching, both hands visible and the camera fixed. After one sweep, the fitted depth values apply immediately. Reset restores the original depth.</p><label>Measured contact distance (cm)<input id="touchDistance" type="number" min="10" max="150" value="30"></label><button id="touchAnchor">1. Capture measured anchor</button> <button id="touchSweep">2. Record 8-second sweep</button> <button id="touchReset">Reset calibration</button><p id="touchStatus" role="status" aria-live="polite" style="font-size:18px;font-weight:600">No calibration. Base size-depth active.</p><progress id="touchProgress" max="8" value="0" aria-label="Calibration recording progress" style="width:100%"></progress><p id="touchQuality">No samples yet.</p>`;container.prepend(panel);
 const find=id=>panel.querySelector('#'+id),status=find('touchStatus'),quality=find('touchQuality'),progress=find('touchProgress');
 let mode=null,start=0,samples=[],anchor=null,candidate=null,active=null,last=null,timer=null,reason='Waiting for a fresh camera frame.',rejected={},lastObservation=0;
 const captureButtons=[find('touchAnchor'),find('touchSweep')];
 const blocked=()=>document.getElementById('relaxedPalm')?.checked||+document.getElementById('contactThreshold')?.value>0||+document.getElementById('handDistance')?.value!==0||+document.getElementById('handHeight')?.value!==0;
 function stop(){clearInterval(timer);timer=null;mode=null;for(const b of captureButtons)b.disabled=false;find('touchDistance').disabled=false;}
 function reject(text){reason=text;rejected[text]=(rejected[text]||0)+1;}
 function summary(){const top=Object.entries(rejected).sort((a,b)=>b[1]-a[1])[0];return top?' Most frequent issue: '+top[0]:'';}
 function updateQuality(){quality.textContent=samples.length+' accepted frames. '+reason;}
 function finish(){
  const phase=mode;stop();progress.value=8;
  if(phase==='anchor'){status.textContent='Anchor stopped: '+samples.length+'/20 accepted frames.'+summary();return;}
  if(samples.length<40){status.textContent='Sweep finished at 8 seconds: '+samples.length+'/40 accepted frames.'+summary();return;}
  const outward=samples.filter(s=>s.elapsed<4000).length,returning=samples.length-outward;
  if(outward<12||returning<12){status.textContent='Sweep finished: need visible touching hands in both halves. Toward chest: '+outward+' frames; toward camera: '+returning+'.'+summary();return;}
  const sizes=samples.map(s=>s.L.size).sort((a,b)=>a-b),range=sizes[Math.floor(sizes.length*.9)]/sizes[Math.floor(sizes.length*.1)];
  if(range<1.5){status.textContent='Sweep finished: near/far size change was '+range.toFixed(2)+'×; need at least 1.5×. Move through a larger distance while keeping hands visible.';return;}
  candidate=fitContact(samples,anchor);if(candidate){active=candidate;status.textContent='Calibration applied after one sweep. Test your hands now; Reset restores the original depth. Sweep fit error '+(median(samples.map(s=>error(s,candidate)))*1000).toFixed(1)+' mm.';}else status.textContent='Could not fit usable depth values. Repeat measured anchor and sweep.';
 }
 function begin(phase){
  if(blocked()){status.textContent='Switch relaxed palm off and set contact activation, hand distance and hand height to zero for calibration.';return;}
  const measured=+find('touchDistance').value/100;if(phase==='anchor'&&!(measured>=.1&&measured<=1.5)){status.textContent='Enter a measured distance from 10 to 150 cm.';return;}
  stop();samples=[];last=null;rejected={};reason='Waiting for a fresh camera frame.';progress.value=0;
  if(phase==='anchor')active=candidate=anchor=null;
  for(const b of captureButtons)b.disabled=true;find('touchDistance').disabled=true;
  const readyAt=performance.now()+5000;
  function tick(){const now=performance.now();
   if(blocked()){stop();status.textContent='Capture stopped: calibration fit settings changed.';return;}
   if(now<readyAt){status.textContent='Starting in '+Math.ceil((readyAt-now)/1000)+'… Put your index fingertips together.';updateQuality();return;}
   if(!mode){mode=phase;start=now;lastObservation=now;}
   const elapsed=now-start;progress.value=Math.min(8,elapsed/1000);
   if(elapsed>=8000){finish();updateQuality();return;}
   const seconds=(elapsed/1000).toFixed(1);
   status.textContent=mode==='anchor'?'Recording '+seconds+'/8.0 s — HOLD at your measured distance ('+samples.length+'/20 frames).':elapsed<4000?'Recording '+seconds+'/8.0 s — MOVE TOWARD YOUR CHEST.':'Recording '+seconds+'/8.0 s — MOVE BACK TOWARD THE CAMERA.';
   if(now-lastObservation>700)reason='No fresh tracking results. Check camera connection.';updateQuality();
  }
  timer=setInterval(tick,100);tick();
 }
 find('touchAnchor').onclick=()=>begin('anchor');find('touchSweep').onclick=()=>anchor?begin('sweep'):status.textContent='Capture the measured anchor first.';
 find('touchReset').onclick=()=>{stop();anchor=candidate=active=null;samples=[];progress.value=0;status.textContent='Calibration reset. Base depth active.';quality.textContent='No samples yet.';};
 return {depth(side,lm,world,base,aspect){const size=imagePalmSize(lm,aspect);return active&&size?active[side]/size:base;},observe(hands,rendered,aspect){
  if(!mode)return;const now=performance.now();if(now-start>=8000){finish();return;}
  if(blocked()){stop();status.textContent='Capture stopped: calibration fit settings changed.';return;}
  const L=hands.find(h=>h.label==='Left'),R=hands.find(h=>h.label==='Right');
  if(!L||!R){reject(!L&&!R?'Neither hand detected.':!L?'Left hand not detected.':'Right hand not detected.');return;}
  if(L.time!==R.time){reject('Hands are from different frames; one hand was lost.');return;}
  if(L.time===last)return;last=L.time;lastObservation=now;
  if((Number.isFinite(L.seen)&&now-L.seen>250)||(Number.isFinite(R.seen)&&now-R.seen>250)){reject('Hand tracking is stale.');return;}
  const l=L.landmarks[8],r=R.landmarks[8],gap=Math.hypot((l.x-r.x)*aspect,l.y-r.y);
  if(gap>.045){reject('Index fingertips do not meet in the tracked image.');return;}
  const data={};for(const [s,h] of [['L',L],['R',R]]){const p=rendered[s]?.result?.points;if(!p){reject('Hand model is not ready.');return;}const root=p[0],tip=p[8],z=-root.z,size=imagePalmSize(h.landmarks,aspect);if(!size||z<=0){reject('Palm size/depth is invalid.');return;}data[s]={size,ray:[root.x/z,root.y/z,-1],offset:tip.clone().sub(root).toArray()};}
  const A=data.L.ray.map(v=>v/data.L.size),B=data.R.ray.map(v=>-v/data.R.size),c=data.R.offset.map((v,i)=>v-data.L.offset[i]);samples.push({A,B,c,L:data.L,R:data.R,baseline:rendered.L.result.points[8].distanceTo(rendered.R.result.points[8]),elapsed:now-start});reason='Good — touching fingertips accepted.';
  if(mode==='anchor'&&samples.length>=20){const d=+find('touchDistance').value/100;anchor={};for(const s of ['L','R'])anchor[s]=median(samples.map(v=>(d+v[s].offset[2])*v[s].size));stop();status.textContent='Anchor recorded: 20 valid frames. Next: record the 8-second sweep.';updateQuality();}
 }};
}
