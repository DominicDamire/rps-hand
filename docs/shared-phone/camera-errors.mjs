export function cameraError(e){
const messages={NotAllowedError:'Camera permission was denied. Allow Camera in the browser site settings, then reconnect.',NotFoundError:'No available camera was found. Select Default camera and check the camera connection.',NotReadableError:'The camera is busy or unavailable. Close other apps or tabs using it, then reconnect.',OverconstrainedError:'This camera cannot provide the selected settings. Try Default camera or lower resolution.',SecurityError:'Camera access is blocked by browser security settings.'};
return messages[e.name]||e.message||String(e);
}
