import {phoneCameraURL} from './phone-url.mjs?v=phone3';
import {phoneConnectionError} from './phone-errors.mjs?v=phone3';
// Separate lab pairing namespace; never shares the game's camera code.
const config={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},{urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}]};
export function receivePhone(onStream,onStatus,onEnd){
 if(!window.Peer||!window.QRCode)throw Error('Phone connection libraries could not load. Reload and try again.');
 const id='handlab-'+crypto.randomUUID(),peer=new Peer(id,{config});let call=null,closed=false;
 const box=document.createElement('dialog');box.className='phonePair';
 box.innerHTML='<h2>Use your phone camera</h2><p>Scan with your phone, then tap Start camera.<br>The phone sends video. This PC runs all tracking and rendering. Same Wi-Fi is recommended.</p><div class="qr"></div><p><a target="_blank" rel="noopener">Open phone camera page</a></p><p class="pairStatus">Creating connection…</p><button>Cancel connection</button>';
 const url=phoneCameraURL(import.meta.url,id,document.getElementById('phoneQuality')?.value||'720');
 box.querySelector('a').href=url.href;
 const status=t=>{if(closed)return;box.querySelector('.pairStatus').textContent=t;onStatus(t);};
 const close=()=>{if(closed)return;closed=true;call?.close();peer.destroy();box.close();box.remove();};
 const cancel=()=>{close();onEnd('Phone connection cancelled');};
 box.querySelector('button').onclick=cancel;box.oncancel=e=>{e.preventDefault();cancel();};document.body.append(box);box.showModal();
 peer.on('open',()=>{if(closed)return;new QRCode(box.querySelector('.qr'),{text:url.href,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});status('Ready to scan');});
 peer.on('call',incoming=>{if(closed||call){incoming.close();return;}call=incoming;status('Phone found. Connecting video…');incoming.answer();
  incoming.on('stream',s=>{if(closed){s.getTracks().forEach(t=>t.stop());return;}box.close();onStream(s);});
  incoming.on('close',()=>{if(!closed){close();onEnd('Phone disconnected. Click Phone camera · QR to reconnect.');}});
  incoming.on('error',e=>{if(!closed){close();onEnd('Phone connection failed: '+e.message);}});
  incoming.peerConnection?.addEventListener('iceconnectionstatechange',()=>{if(incoming.peerConnection.iceConnectionState==='failed')status('Video connection failed. Put both devices on the same Wi-Fi and reconnect.');});
 });
 peer.on('error',e=>status('Connection error: '+e.type+'. Cancel and try again.'));
 return close;
}
export async function sendPhone(id,video,status,facing='user',resolution='720',onEnd=()=>{}){
 if(!/^handlab-[a-f0-9-]{36}$/.test(id))throw Error('Scan a fresh QR code from the PC lab.');
 if(!window.Peer)throw Error('Connection library failed to load. Reload this page.');
 const sizes={'480':[854,480],'720':[1280,720],'1080':[1920,1080]},[width,height]=sizes[resolution]||sizes['720'];
 const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:width},height:{ideal:height},frameRate:{ideal:60,max:60}}});
 let peer,call,closed=false,wake,timer;
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);call?.close();peer?.destroy();stream.getTracks().forEach(t=>t.stop());video.srcObject=null;wake?.release().catch(()=>{});};
 const fail=e=>{if(closed)return;const message=typeof e==='string'?e:phoneConnectionError(e);stop();status(message);onEnd(message);};
 try{video.muted=true;video.srcObject=stream;await video.play();status('Camera ready. Connecting to the pairing server…');peer=new Peer(undefined,{config});
  timer=setTimeout(()=>fail('Pairing server did not respond within 20 seconds. Check internet access and retry. [signalling-timeout]'),20000);
  navigator.wakeLock?.request('screen').then(w=>{if(closed)w.release();else wake=w;}).catch(()=>{});
  peer.on('open',()=>{if(closed)return;clearTimeout(timer);status('Pairing server connected. Calling PC…');call=peer.call(id,stream);if(!call){fail('Could not call the PC. Scan its current QR and retry. [call-failed]');return;}
   const tune=async()=>{for(const sender of call.peerConnection?.getSenders()||[]){if(sender.track?.kind!=='video')continue;try{const params=sender.getParameters();if(!params.encodings?.length)continue;for(const encoding of params.encodings){encoding.maxBitrate=10000000;encoding.maxFramerate=60;encoding.scaleResolutionDownBy=1;}await sender.setParameters(params);}catch{}}};call.peerConnection?.addEventListener('connectionstatechange',()=>{if(call.peerConnection.connectionState==='connected')tune();});
   timer=setTimeout(()=>{if(!closed&&call.peerConnection?.connectionState!=='connected')fail('PC video did not connect within 20 seconds. Try the same Wi-Fi and scan the current QR. Different networks may require a working TURN relay. [video-timeout]');},20000);
   call.on('close',()=>fail('PC disconnected. Keep its receiver page open and scan the current QR. [call-closed]'));
   call.on('error',e=>fail(e));
   call.peerConnection?.addEventListener('connectionstatechange',()=>{const state=call.peerConnection.connectionState;if(state==='connected'){clearTimeout(timer);status('VIDEO ONLY — streaming to PC. No tracking runs on this phone. Keep this page open.');}if(state==='failed')status('Connection failed. Use the same Wi-Fi, then stop and reconnect.');if(state==='disconnected')status('Connection interrupted. Keep this page open or reconnect.');});
  });peer.on('error',e=>fail(e));return stop;
 }catch(e){stop();throw e;}
}
