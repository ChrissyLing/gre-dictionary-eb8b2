const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/’/g,"'").trim().toLowerCase();
const tokens=s=>normalize(s).match(/[a-z]+(?:['-][a-z]+)*/g)||[];
let legacyPromise,bankPromise;
async function json(path){const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw Error('语文资料加载失败，请重试');return r.json();}
export function loadLegacyBank(){return legacyPromise||=(json('../0.3.0/data/questions-v1.json').catch(e=>{legacyPromise=null;throw e;}));}
export function legacyText(q){return q.kind==='fill'?q.stem+' '+q.options.map(o=>o.text).join(' '):q.text;}
export function loadVerbalBank(){return bankPromise||=(Promise.all([json('../0.3.1/verbal-v1.json'),loadLegacyBank()]).then(([bank,legacy])=>{
 const originals=new Map(legacy.questions.map(q=>[q.id,q]));bank.aliases=legacy.aliases;
 for(const q of bank.questions)if(q.legacyId){q.legacy=originals.get(q.legacyId);if(!q.legacy)throw Error('原题记录缺失');q.searchText=legacyText(q.legacy);}
 bank.wordIndex=new Map();
 for(const q of bank.questions){const terms=new Set(tokens(q.searchText).flatMap(t=>[t,legacy.aliases[t]||t]));for(const t of terms){if(!bank.wordIndex.has(t))bank.wordIndex.set(t,[]);bank.wordIndex.get(t).push(q);}}
 return bank;
}).catch(e=>{bankPromise=null;throw e;}));}
export function findVerbalQuestions(bank,word){const key=normalize(word),root=bank.aliases[key]||key;if(!key)return[];
 if(/\s/.test(root)){const esc=root.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'),re=new RegExp('(^|[^a-z])'+esc+'(?=$|[^a-z])','i');return bank.questions.filter(q=>re.test(normalize(q.searchText)));}
 return [...new Set([...(bank.wordIndex.get(key)||[]),...(bank.wordIndex.get(root)||[])])];
}
export function questionTitle(bank,q){return bank.sources.find(s=>s.id===q.source).short+' · '+(q.section?q.section+' · ':'')+'第 '+(q.displayNumber||q.number)+' '+(q.unit||'题');}
export function appendMarked(node,text,word='',aliases={}){const key=normalize(word),root=aliases[key]||key;for(const part of String(text||'').split(/([A-Za-z]+(?:['’\-][A-Za-z]+)*)/g)){const t=normalize(part);if(key&&(t===key||t===root||(aliases[t]||t)===root)){const mark=document.createElement('mark');mark.textContent=part;node.append(mark);}else node.append(document.createTextNode(part));}}
export function renderLegacyQuestion(host,q,word='',aliases={}){const paragraph=(text,cls='')=>{const p=document.createElement('p');p.className=cls;appendMarked(p,text,word,aliases);host.append(p);return p;};
 if(q.kind==='fill'){paragraph(q.stem,'question-stem');if(/\(i\)/.test(q.stem))paragraph('空格 (i)：A–C；(ii)：D–F'+(q.options.length===9?'；(iii)：G–I':''),'hint');const options=document.createElement('div');options.className='question-options';for(const o of q.options){const p=document.createElement('p'),b=document.createElement('b');b.textContent=o.label+'. ';p.append(b);appendMarked(p,o.text,word,aliases);options.append(p);}host.append(options);}
 else {const box=document.createElement('div');box.className='question-reading';let cursor=0;const spans=(q.bold||[]).map(text=>({text,at:q.text.indexOf(text)})).filter(s=>s.at>=0).sort((a,b)=>a.at-b.at);for(const span of spans){if(span.at<cursor)continue;appendMarked(box,q.text.slice(cursor,span.at),word,aliases);const strong=document.createElement('strong');appendMarked(strong,span.text,word,aliases);box.append(strong);cursor=span.at+span.text.length;}appendMarked(box,q.text.slice(cursor),word,aliases);host.append(box);}
}
