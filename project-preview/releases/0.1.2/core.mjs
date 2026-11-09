export const STORE_SCHEMA=1;
export function cleanWord(value){const word=String(value||'').normalize('NFKC').trim().toLowerCase();if(!/^[a-z][a-z\s'’\-é]*$/i.test(word)||word.length>100)throw Error('请输入有效英文词');return word;}
export function selectRelease(catalog,pinned){
 if(catalog.schemaVersion!==1||!Array.isArray(catalog.releases))throw Error('版本目录格式不兼容');
 const available=catalog.releases.filter(r=>r.available!==false&&r.dataSchema===STORE_SCHEMA&&/^\d+\.\d+\.\d+$/.test(r.id));
 if(pinned&&!available.some(r=>r.id===pinned))throw Error('你选定的版本暂不可用，请明确选择其他版本；不会自动升级');
 const chosen=available.find(r=>r.id===pinned)||available.find(r=>r.id===catalog.defaultRelease)||available[0];
 if(!chosen)throw Error('没有兼容的可用版本');return chosen;
}
export function safeReleaseUrl(catalogUrl,release,origin){const url=new URL(release.path,catalogUrl);if(url.origin!==origin||!url.pathname.includes('/project-preview/releases/')||!url.pathname.endsWith('/index.html'))throw Error('版本地址无效');return url;}
export class LearningStore{
 constructor(storage,{uid='local',now=()=>Date.now(),onChange=()=>{}}={}){this.storage=storage;this.now=now;this.onChange=onChange;this.generation=0;this.activate(uid);}
 activate(uid){this.uid=uid||'local';this.generation++;this.key='gre-project:v1:'+this.uid;let saved;try{saved=JSON.parse(this.storage.getItem(this.key)||'{}')}catch{saved={}};this.rows=saved.schema===STORE_SCHEMA&&saved.rows&&typeof saved.rows==='object'?Object.assign(Object.create(null),saved.rows):Object.create(null);this.pending=saved.schema===STORE_SCHEMA&&saved.pending&&typeof saved.pending==='object'?Object.assign(Object.create(null),saved.pending):Object.create(null);this.onChange();}
 save(){this.storage.setItem(this.key,JSON.stringify({schema:STORE_SCHEMA,rows:this.rows,pending:this.pending}));this.onChange();}
 favorites(){return Object.values(this.rows).filter(r=>r.favorite).sort((a,b)=>b.addedAt-a.addedAt);}
 change(word,patch){word=cleanWord(word);const old=this.rows[word]||{word,favorite:false,zh:'',phonetic:'',addedAt:this.now(),review:{seen:0,streak:0,dueAt:0}};const row={...old,...patch,word,updatedAt:this.now()};this.rows[word]=row;this.pending[word]={row,opId:globalThis.crypto?.randomUUID?.()||String(this.now())+Math.random()};this.save();return row;}
 favorite(word,active=true,info={}){return this.change(word,{favorite:active,...(info.zh?{zh:String(info.zh).slice(0,1000)}:{}),...(info.phonetic?{phonetic:String(info.phonetic).slice(0,200)}:{})});}
 rate(word,remembered){word=cleanWord(word);const old=this.rows[word];if(!old||!old.favorite)throw Error('请先收藏这个词');const streak=remembered?(old.review?.streak||0)+1:0;const days=[1,3,7,14,30][Math.min(Math.max(streak-1,0),4)];return this.change(word,{review:{seen:(old.review?.seen||0)+1,streak,lastAt:this.now(),dueAt:this.now()+(remembered?days*86400000:600000)}});}
 due(){return this.favorites().filter(r=>(r.review?.dueAt||0)<=this.now());}
 importLegacy(values){if(!Array.isArray(values))throw Error('旧收藏格式无效');let added=0;for(const item of values){try{const word=cleanWord(item.word);if(this.rows[word]?.favorite)continue;this.favorite(word,true,item);added++;}catch{}}return added;}
 mergeCloud(rows){for(const record of rows){let word;try{word=cleanWord(record.word)}catch{continue;}if(this.pending[word])continue;const p=record.payload;if(!p||p.schema!==STORE_SCHEMA||typeof p.favorite!=='boolean')continue;this.rows[word]={word,favorite:p.favorite,zh:String(p.zh||'').slice(0,1000),phonetic:String(p.phonetic||'').slice(0,200),addedAt:Number(p.addedAt)||this.now(),review:{seen:Math.max(0,Number(p.review?.seen)||0),streak:Math.max(0,Number(p.review?.streak)||0),dueAt:Math.max(0,Number(p.review?.dueAt)||0)}};}this.save();}
 async sync(provider){
  if(this.uid==='local')return {local:true};const uid=this.uid,generation=this.generation;const batch=Object.entries(this.pending).map(([word,p])=>({word,opId:p.opId,row:p.row}));
  if(batch.length)await provider.putRows(batch.map(p=>({word:p.word,payload:{...p.row,schema:STORE_SCHEMA}})),uid);
  if(generation!==this.generation)return {stale:true};
  for(const item of batch)if(this.pending[item.word]?.opId===item.opId)delete this.pending[item.word];this.save();
  const rows=await provider.getRows(uid);if(generation!==this.generation)return {stale:true};this.mergeCloud(rows);return {synced:true,count:rows.length};
 }
}
