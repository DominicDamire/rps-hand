import assert from 'node:assert/strict';
import {fitVideoCalibration,videoDepth} from './video-calibration.mjs';
const rows=Array.from({length:80},(_,i)=>{const size=.05+i*.001;return {sizeL:size,sizeR:size*1.03,zL:.1+.04/size,zR:.09+.041/(size*1.03),neckRatio:1.4};});
const fit=fitVideoCalibration(rows);assert.ok(fit);assert.equal(fit.headScale,1.4);assert.ok(Math.abs(videoDepth(fit,'L',.08,0)-.6)<1e-8);assert.equal(fitVideoCalibration(rows.slice(0,10)),null);assert.equal(videoDepth(null,'L',.1,.7),.7);console.log('PASS: frozen inverse-size curves and head reference');
