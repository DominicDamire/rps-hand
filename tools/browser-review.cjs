// Run against a separately started local static server. No camera is opened.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const mode = process.argv[2] || 'demo';
const base = process.env.RPS_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({headless:true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}),
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400 && !r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
    if(mode==='alignment') {
      await page.goto(base+'/hand-pnp-photo/');
      const result=await page.evaluate(async()=>{
        const {checkAlignment}=await import('./alignment.test.mjs');return checkAlignment();
      });
      console.log(JSON.stringify(result,null,2));
      assert.deepEqual(errors,[]);
      assert.equal(result.passed,true,'Alignment diagnostic failed; do not report a fully passing geometry lab');
    } else {
      await page.goto(base+'/?img=victory.jpg');
      assert.equal(await page.title(),'RPS Hand');
      await page.waitForFunction(()=>document.querySelector('#move')?.textContent.includes('SCISSORS'),{},{timeout:60000});
      await page.locator('#view').click();
      assert.match(await page.locator('#view').innerText(),/first person/);
      await page.setViewportSize({width:390,height:844});
      await page.locator('#view').click();
      const boxes=await page.evaluate(()=>{
        const view=document.querySelector('#view').getBoundingClientRect(),nav=document.querySelector('nav').getBoundingClientRect();
        return {separated:nav.top>=view.bottom||nav.bottom<=view.top,contained:nav.left>=0&&nav.right<=innerWidth};
      });
      assert.equal(boxes.separated,true,'Navigation must not obscure VIEW on mobile');
      assert.equal(boxes.contained,true,'Navigation must fit the mobile viewport');
      await page.setViewportSize({width:1280,height:800});
      assert.deepEqual(errors,[]);
      if(process.env.RPS_SCREENSHOT)await page.screenshot({path:process.env.RPS_SCREENSHOT});
      console.log('PASS: real still-image tracker recognizes SCISSORS; VIEW switches; no page/resource errors');
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
