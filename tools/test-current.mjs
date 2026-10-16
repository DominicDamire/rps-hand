// Current JavaScript logic tests; frozen history snapshots are not release tests.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const browserOnly='docs/hand-pnp-photo/alignment.test.mjs';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(e.isDirectory())return /^(history|archive|old)/.test(e.name)?[]:walk(resolve(dir,e.name));
 const path=relative(root,resolve(dir,e.name));
 return e.name.endsWith('.test.mjs')&&path!==browserOnly?[path]:[];
});}
const files=walk(resolve(root,'docs')).sort();
console.log(`${files.length} Node test files; ${browserOnly} requires the browser alignment check.`);
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
