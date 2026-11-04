// Uses a mocked translation service. Does not submit feedback or contact real translation providers.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],translations=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='api.mymemory.translated.net'){
    translations.push(url.href);return route.fulfill({json:{responseData:{translatedText:'这是一条机器测试译文。'}}});
   }
   if(url.hostname!=='gre.local')return route.abort();
   const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file,contentType:file.endsWith('.json')?'application/json':'text/html'});
  });
  await page.goto('http://gre.local/#opaque');
  const wine=page.locator('.example').filter({hasText:'The wine arrived cloudy'});
  await wine.waitFor();
  assert((await wine.innerText()).includes('送来的葡萄酒浑浊不透光'));
  assert((await wine.innerText()).includes('已校对译文'));
  assert(!(await wine.innerText()).includes('多云'));
  assert.equal(await wine.locator('[data-translate-example]').count(),0);
  const report=new URL(await wine.locator('.translation-report').getAttribute('href'));
  assert(report.searchParams.get('body').includes('The wine arrived cloudy & opaque'));
  assert.equal(translations.length,0,'lookup and checked translation make no provider request');
  const machineButton=page.locator('[data-translate-example]').first();
  await machineButton.click();
  await page.getByText('这是一条机器测试译文。',{exact:true}).waitFor();
  assert((await page.locator('.translation-machine').first().innerText()).includes('未校对'));
  assert.equal(translations.length,1,'only explicit request contacts translator');
  await page.locator('#searchInput').fill('manifest');await page.locator('#searchBtn').click();
  const flagged=page.locator('.example').filter({hasText:'The injustice was manifest'});await flagged.waitFor();
  assert((await flagged.innerText()).includes('暂不提供译文'));
  assert.equal(await flagged.locator('[data-translate-example]').count(),0);
  await page.locator('#searchInput').fill('aback');await page.locator('#searchBtn').click();
  await page.locator('.translation-label').filter({hasText:'原书译文'}).first().waitFor();
  assert.equal(translations.length,1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/gre-translation-source-mobile.png'});
  await page.locator('#searchInput').fill('opaque');await page.locator('#searchBtn').click();
  await wine.waitFor();await wine.scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/gre-translation-wine-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS checked wine/source translations, no automatic provider requests, explicit machine labels, source issue suppression, prefilled feedback, and mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
