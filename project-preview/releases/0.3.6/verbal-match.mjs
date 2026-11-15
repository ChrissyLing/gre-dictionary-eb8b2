import {containsTerm} from './quant-match.mjs';
export const verbalConcepts=[['main-idea','主旨题'],['inference','推断题'],['detail','细节题'],['purpose','作用与目的'],['contrast','转折关系'],['cause','因果关系'],['concession','让步关系'],['parallel','并列与递进'],['tone','态度与语气']].map(([id,title])=>({id,title}));
const rules={'main-idea':/main (point|idea)|primarily concerned|primary (purpose|focus)/i,inference:/infer|suggests? that|implies? that/i,detail:/according to|mentions|states? that/i,purpose:/purpose|function of|serves? to/i,contrast:/however|nevertheless|although|rather than|in contrast/i,cause:/because|therefore|consequently|as a result/i,concession:/although|despite|even though/i,parallel:/moreover|furthermore|in addition/i,tone:/attitude|tone of|skeptical|optimistic/i};
export function buildVerbalMatcher(data){
 const index=new Map(data.questions.map(q=>[q.id,Object.entries(rules).filter(([id,re])=>re.test(q.searchText)).map(([id])=>id)]));
 const get=(q,r={})=>({concepts:[...new Set([...(index.get(q.id)||[]),...(r.concepts||[])])],terms:[]});
 function matches(q,text,r={}){const t=text.trim().toLowerCase();return !t||get(q,r).concepts.some(id=>verbalConcepts.find(c=>c.id===id)?.title.includes(t))||(r.words||[]).includes(t)||containsTerm(q.searchText,t);}
 function related(q,records={}){const a=get(q,records[q.id]),words=records[q.id]?.words||[];return data.questions.filter(o=>o.id!==q.id).map(o=>{const b=get(o,records[o.id]),cs=a.concepts.filter(c=>b.concepts.includes(c)),ws=words.filter(w=>containsTerm(o.searchText,w));return{question:o,concepts:cs,words:ws,score:cs.length+ws.length*4};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.question.ordinal-b.question.ordinal).slice(0,6);}
 return{get,matches,related};
}
