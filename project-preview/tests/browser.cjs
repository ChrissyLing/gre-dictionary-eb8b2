const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://gre.local')return route.abort();const relative=u.pathname.replace(/^\/project-preview\//,''),file=path.resolve(root,relative);if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.abort();const ext=path.extname(file);return route.fulfill({path:file,contentType:ext==='.mjs'?'text/javascript':ext==='.json'?'application/json':ext==='.css'?'text/css':'text/html'});});
 await page.route('**/cloudbase-config.json',route=>{const c=JSON.parse(fs.readFileSync(path.join(root,'cloudbase-config.json'),'utf8'));c.enabled=false;return route.fulfill({json:c});});
 await page.goto('https://gre.local/project-preview/index.html');await page.waitForURL('**/releases/0.1.0/index.html');
 await page.locator('#localPreview').waitFor({state:'visible'});assert(await page.locator('#gateLogin').isDisabled());
 await page.locator('#localPreview').click();await page.locator('#workspace').waitFor({state:'visible'});
 await page.locator('[data-tab="favorites"]').click();await page.locator('#newWord').fill('elusive');await page.locator('#newMeaning').fill('难以捉摸的');await page.locator('#addForm button').click();assert.equal(await page.locator('.favorite-row').count(),1);
 await page.locator('[data-tab="dictionary"]').click();const frame=page.frameLocator('#dictionaryFrame');await frame.locator('#searchInput').fill('opaque');await frame.locator('#searchBtn').click();await frame.locator('#starBtn').waitFor();await frame.locator('#starBtn').click();await page.locator('[data-tab="favorites"]').click();await page.waitForFunction(()=>document.querySelectorAll('.favorite-row').length===2);await page.locator('.favorite-row').filter({hasText:'opaque'}).getByRole('button',{name:'移除',exact:true}).click();assert.equal(await page.locator('.favorite-row').count(),1);
 await page.locator('[data-tab="review"]').click();await page.locator('#startReview').click();assert.equal(await page.locator('.review-word').textContent(),'elusive');await page.getByRole('button',{name:'显示释义',exact:true}).click();assert.equal(await page.locator('.review-meaning').textContent(),'难以捉摸的');await page.getByRole('button',{name:'记住了',exact:true}).click();
 await page.reload();await page.locator('#localPreview').click();await page.locator('[data-tab="favorites"]').click();assert.equal(await page.locator('.favorite-row').count(),1);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/tmp/gre-account-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS: unconfigured gate, local favorites persistence, review, desktop/mobile layout; no external requests');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
