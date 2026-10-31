// Executes the shipped inline application with deterministic DOM/storage/network fakes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(root, 'index.html'), 'utf8');
function app(fetcher) {
  const elements = new Map(), stored = new Map(), requests = [];
  function element(id) {
    if (!elements.has(id)) elements.set(id, {innerHTML:'', textContent:'', hidden:false, value:'', isConnected:true, classList:{toggle(){}}, addEventListener(){}, querySelectorAll(){return []}, querySelector(){return null}, focus(){}, select(){}});
    return elements.get(id);
  }
  const c = {console, setTimeout, clearTimeout, AbortController, URL, Blob,
    location:{protocol:'https:', hostname:'test.netlify.app', hash:''},
    document:{getElementById:element, addEventListener(){}},
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
    fetch: async url=>{requests.push(url);return fetcher(url)}, scrollTo(){}};
  c.window=c;
  vm.createContext(c);
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1],c);
  return {c,element,stored,requests};
}
const files = async url=> {
  assert.match(url, /^data\/v4\/[a-z]\.json$/,'lookup must use bundled assets only');
  return {ok:true,status:200,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url),'utf8'))};
};
(async()=>{
  const a=app(files);
  for (const word of ['appropriate','pragmatic','lull','miscellaneous','acclaimed','buttressing','bolstering','hello','went']) {
    await a.c.doSearch(word);
    assert.equal(a.element('result').hidden,false,word+' result visible');
    assert.equal(a.element('status').innerHTML,'',word+' has no warning');
    assert.match(a.element('result').innerHTML,/[\u4e00-\u9fff]/,word+' has Chinese');
    if (word==='lull') { assert(a.element('result').innerHTML.includes('respite')); assert(!a.element('result').innerHTML.includes('已收录等价词和例句')); }
  }
  assert(a.requests.every(u=>u.startsWith('data/v4/')),'no third-party request during lookup');
  const count=a.requests.length;
  await a.c.doSearch('appropriate'); assert.equal(a.requests.length,count,'dictionary shards are cached');
  await a.c.doSearch('zzzzunknownword'); assert(a.element('status').innerHTML.includes('暂未收录'));
  await a.c.doSearch('constructor'); assert(a.element('status').innerHTML!==undefined,'prototype-named input is safe');
  await a.c.doSearch('123'); assert(a.element('status').innerHTML.includes('请输入英文单词'));
  const b=app(async()=>{throw new Error('asset unavailable')});
  const qsOnly=Object.keys(b.c.QS).find(w=>/^[a-z][a-z '-]*$/.test(w)&&!b.c.localLookup(w));
  await b.c.doSearch(qsOnly);
  assert.equal(b.element('status').innerHTML,'');
  assert(b.element('result').innerHTML.includes('青山答案词释义'),'new QS content works when shards are unavailable');
  await b.c.doSearch('conjectural');
  assert.equal(b.element('result').hidden,false,'SE-only content does not dereference a missing local record');
  assert.equal(b.element('status').innerHTML,'');
  const shared=Object.keys(b.c.QS).find(w=>b.c.localLookup(w));
  await b.c.doSearch(shared);
  assert(b.element('result').innerHTML.includes('考纲释义'));
  assert(b.element('result').innerHTML.includes('青山答案词释义'),'overlapping materials remain visible');
  await b.c.doSearch('lull');
  assert(b.element('result').innerHTML.includes('六选二真题'));
  assert(b.element('result').innerHTML.includes('六选二模拟'),'generated examples stay visibly distinct');
  await b.c.doSearch('pragmatic'); assert.equal(b.element('result').hidden,false); assert.equal(b.element('status').innerHTML,'');
  await b.c.doSearch('lull'); assert(b.element('result').innerHTML.includes('respite'));
  await b.c.doSearch('hello'); assert(b.element('status').innerHTML.includes('再次点击查询'));
  const before=b.requests.length; await b.c.doSearch('hello'); assert(b.requests.length>before,'failed assets are retried');
  let release;
  const d=app(()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data/v4/p.json'),'utf8'))})}));
  const pending=d.c.doSearch('pragmatic'); assert.equal(d.element('result').hidden,false,'core content immediately visible');
  await d.c.doSearch('123'); release(); await pending; assert(d.element('status').innerHTML.includes('请输入英文单词'),'stale response cannot overwrite current search');
  console.log('PASS: bundled bilingual lookup, irregular/derived forms, SE-only words, no external lookup requests, asset caching/retry, local fallback, stale response');
})().catch(e=>{console.error(e);process.exitCode=1});
