const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://gre.local')return u.hostname.endsWith('.tencentcloudapi.com')||u.hostname.endsWith('.tcloudbasegateway.com')||u.hostname.endsWith('.tcb-api.tencentcloudapi.com')?route.continue():route.abort();const relative=u.pathname.replace(/^\/project-preview\//,''),file=path.resolve(root,relative);if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();const ext=path.extname(file);return route.fulfill({path:file,contentType:ext==='.mjs'?'text/javascript':ext==='.json'?'application/json':ext==='.css'?'text/css':'text/html'});});
 await page.route('**/cloudbase-config.json',route=>{const c=JSON.parse(fs.readFileSync(path.join(root,'cloudbase-config.json'),'utf8'));c.enabled=true;return route.fulfill({json:c});});
 await page.goto('https://gre.local/project-preview/releases/0.1.0/index.html');
 await page.waitForTimeout(6000);console.log(JSON.stringify({loginDisabled:await page.locator('#gateLogin').isDisabled(),notice:await page.locator('#notice').textContent(),gateHint:await page.locator('#gateHint').textContent(),errors}));
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#gateLogin').isDisabled(),false);console.log('PASS: official CloudBase SDK initializes login UI; no email sent and no existing browser session used');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
