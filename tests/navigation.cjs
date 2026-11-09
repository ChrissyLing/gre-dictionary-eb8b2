// Requires Playwright and Chrome; uses only bundled files and never contacts external services.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const u=new URL(route.request().url()),file=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));
   if(u.hostname!=='gre.local'||!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file,contentType:file.endsWith('.json')?'application/json':'text/html'});
  });
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.goto('http://gre.local/#groups');
   await page.locator('.meaning-tile').first().waitFor();
   assert.equal(await page.locator('.meaning-tile').count(),80);
   assert.equal(await page.locator('.meaning-group').count(),0,'directory has no group content underneath');
   const tiles=page.locator('.meaning-tile'),a=await tiles.nth(0).boundingBox(),b=await tiles.nth(1).boundingBox();
   assert(a.height>=145&&a.width>280,'spacious rectangular cards');
   if(viewport.width>700){assert(Math.abs(a.y-b.y)<2);assert(b.x-a.x-a.width>=16);assert((await page.locator('#dictionaryPage').boundingBox()).width>1000);}
   else{assert(b.y-a.y-a.height>=14);assert(Math.abs(a.x-b.x)<2);}
   await page.screenshot({path:viewport.width>700?'/tmp/gre-cards-desktop.png':'/tmp/gre-cards-mobile.png'});
   // A whole-card click must open an independent view, not content below a long directory.
   const tile=page.locator('[data-meaning-group=fair]');await tile.scrollIntoViewIfNeeded();
   const directory=await page.evaluate(()=>({html:document.getElementById('result').innerHTML,y:scrollY,input:document.getElementById('searchInput').value}));
   const box=await tile.boundingBox();await tile.click({position:{x:box.width-22,y:box.height-22}});
   await page.waitForURL('**/#groups/fair');
   assert.equal(await page.locator('.meaning-detail').count(),1);
   assert.equal(await page.locator('.meaning-overview').count(),0);
   assert.equal(await page.evaluate(()=>scrollY),0);
   await page.locator('[data-meaning-index]').click();
   await page.waitForURL('**/#groups');await page.locator('.meaning-tile').first().waitFor();
   assert.equal(await page.locator('#result').innerHTML(),directory.html);
   assert(Math.abs(await page.evaluate(()=>scrollY)-directory.y)<3,'return restores directory scroll');
   // Filtered directory → detail → word → detail → directory, with browser Back/Forward too.
   await page.locator('#searchInput').fill('陈腐');await page.locator('#searchBtn').click();
   assert.equal(await tiles.count(),1);
   await tiles.first().scrollIntoViewIfNeeded();
   const filtered=await page.evaluate(()=>({html:document.getElementById('result').innerHTML,y:scrollY,input:document.getElementById('searchInput').value}));
   await tiles.first().click();await page.waitForURL('**/#groups/trite');
   assert.equal(await page.locator('.meaning-detail-heading').innerText().then(t=>t.includes('陈腐')),true);
   await page.locator('.meaning-evidence > summary').last().click();
   const word=page.locator('.meaning-detail .meaning-word').first();await word.scrollIntoViewIfNeeded();
   const detail=await page.evaluate(()=>({html:document.getElementById('result').innerHTML,y:scrollY,input:document.getElementById('searchInput').value}));
   await word.click();await page.locator('[data-return-meaning]').waitFor();
   await page.locator('[data-return-meaning]').click();await page.waitForURL('**/#groups/trite');
   assert.equal(await page.locator('#result').innerHTML(),detail.html,'word return restores expanded group');
   assert(Math.abs(await page.evaluate(()=>scrollY)-detail.y)<3);
   await page.goBack();await page.waitForURL('**/#groups');
   assert.equal(await page.locator('#result').innerHTML(),filtered.html,'browser Back restores filtered directory');
   assert.equal(await page.locator('#searchInput').inputValue(),'陈腐');
   assert(Math.abs(await page.evaluate(()=>scrollY)-filtered.y)<3);
   await page.goForward();await page.waitForURL('**/#groups/trite');
   assert.equal(await page.locator('#result').innerHTML(),detail.html,'browser Forward restores detail state');
   await page.goForward();await page.locator('[data-return-meaning]').waitFor();
   await page.locator('#meaningGroupsBtn').click();await page.waitForURL('**/#groups/trite');
   await page.locator('[data-meaning-index]').click();await page.waitForURL('**/#groups');
   assert.equal(await page.locator('#result').innerHTML(),filtered.html,'both navigation levels return correctly');
   await page.locator('[data-meaning-clear]').click();assert.equal(await tiles.count(),80);
   assert.equal(await page.locator('#searchInput').inputValue(),'');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scrolling');
   // A shared child URL also works after a reload, with a usable return link.
   await page.goto('http://gre.local/#groups/acerbic');await page.locator('.meaning-detail').waitFor();
   assert((await page.locator('.meaning-detail').innerText()).includes('↔'));
   await page.screenshot({path:viewport.width>700?'/tmp/gre-group-detail-desktop.png':'/tmp/gre-group-detail-mobile.png'});
   await page.locator('[data-meaning-index]').click();await page.waitForURL('**/#groups');assert.equal(await tiles.count(),80);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: spacious wide cards; whole-card entry; independent group URL; two-level Back/Forward; exact filter, expansion and scroll restoration; shared links; desktop/mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
