// Requires Playwright and Chrome. Optional PLAYWRIGHT_MODULE may point to an installed module.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
      if (!file.startsWith(root+path.sep)||!fs.existsSync(file)) return route.abort();
      return route.fulfill({path:file,contentType:file.endsWith('.json')?'application/json':'text/html'});
    });
    await page.goto('http://gre.local/');
    await page.locator('#meaningGroupsBtn').click();
    for (const viewport of [{width:1100,height:850},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for (const id of ['basic','acerbic','scarce','fair','all']) {
        const more=page.locator('.meaning-more');
        if (!await more.evaluate(el=>el.open)) await more.locator(':scope > summary').click();
        await page.locator('[data-meaning-group="'+id+'"]').click();
        const card=page.locator(id==='all'?'.meaning-group':'.meaning-group[open]').first();
        const top=await card.evaluate(el=>el.getBoundingClientRect().top);
        assert(top>=0&&top<100,'selection must bring the requested group into view: '+id);
        if(id==='all') await card.locator(':scope > summary').click();
        await card.locator('[data-meaning-index]').click();
        const indexTop=await page.locator('.meaning-overview').evaluate(el=>el.getBoundingClientRect().top);
        assert(indexTop>=0&&indexTop<100,'return must bring the directory into view');
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scrolling');
    }
    await page.locator('[data-meaning-group=acerbic]').click();
    await page.locator('.meaning-group[open] [data-word=acerbic]').first().click();
    await page.locator('#result').getByText('acerbic',{exact:true}).first().waitFor();
    assert.equal(await page.locator('#englishModeBtn').getAttribute('aria-pressed'),'true');
    for (const viewport of [{width:1100,height:850},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await page.locator('[data-return-meaning]').click();
      await page.waitForFunction(()=>document.getElementById('meaningGroupsBtn').getAttribute('aria-pressed')==='true');
      await page.locator('#searchInput').fill('陈腐');await page.locator('#searchBtn').click();
      await page.locator('.meaning-more > summary').click();
      await page.locator('.meaning-group[open] .meaning-evidence > summary').last().click();
      const word=page.locator('.meaning-group[open] .meaning-word').first();
      await word.scrollIntoViewIfNeeded();
      const saved=await page.evaluate(()=>({html:document.getElementById('result').innerHTML,y:scrollY,input:document.getElementById('searchInput').value}));
      await word.click();await page.locator('[data-return-meaning]').waitFor();
      await page.locator('[data-return-meaning]').click();
      await page.waitForFunction(()=>document.getElementById('meaningGroupsBtn').getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('#result').innerHTML(),saved.html,'restore exact list and all expanded details');
      assert.equal(await page.locator('#searchInput').inputValue(),saved.input,'restore filter');
      assert(Math.abs(await page.evaluate(()=>scrollY)-saved.y)<3,'restore original scroll position');
      await page.locator('.meaning-group[open] .meaning-word').first().click();
      await page.locator('[data-return-meaning]').waitFor();
      await page.goBack();
      await page.waitForFunction(()=>document.getElementById('meaningGroupsBtn').getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('#result').innerHTML(),saved.html,'browser Back restores origin');
      await page.goForward();await page.locator('[data-return-meaning]').waitFor();
      await page.locator('#meaningGroupsBtn').click();
      await page.waitForFunction(()=>document.getElementById('meaningGroupsBtn').getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('#result').innerHTML(),saved.html,'mode tab also returns to origin');
      // Start the next viewport with a word screen so the return button can be exercised again.
      await page.locator('.meaning-group[open] .meaning-word').first().click();
      await page.locator('[data-return-meaning]').waitFor();
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: actual More click, group selection scrolls visibly, return to directory, desktop/mobile, word lookup, exact origin restore, browser Back/Forward, and mode-tab return');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
