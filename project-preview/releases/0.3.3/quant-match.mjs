// Curated bilingual matching rules. Matches are suggestions, not proof of equivalent questions.
const rows=[
 ['divisibility','整除与因数','integers','divisible|divisibility|factor|multiple','整除|因数|倍数'],
 ['remainder','余数','integers','remainder|modulo','余数|取余'],
 ['parity','奇偶性','integers','even|odd','奇数|偶数|奇偶'],
 ['prime','质数','integers','prime|composite','质数|素数|合数'],
 ['consecutive','连续整数','integers','consecutive','连续整数|相邻整数'],
 ['gcd-lcm','最大公因数与最小公倍数','integers','greatest common|least common','最大公因数|最大公约数|最小公倍数'],
 ['fraction','分数运算','fractions','fraction|numerator|denominator','分数|分子|分母'],
 ['exponent','指数运算','powers','exponent|power|exponential','指数|乘方'],
 ['root','根与平方根','powers','square root|cube root|radical','平方根|立方根|根式'],
 ['rounding','取整与估算','decimals','round|nearest|approximate','四舍五入|近似|估算'],
 ['absolute','绝对值','real-numbers','absolute value','绝对值'],
 ['number-line','数轴与距离','real-numbers','number line','数轴'],
 ['ratio','比与比例','ratios','ratio|proportion|proportional','比例|成正比|成反比'],
 ['percent-change','百分比变化','percentages','percent|percentage|increase|decrease','百分|增长率|减少率'],
 ['algebra','代数式化简','expressions','expression|simplify|polynomial','代数式|化简|多项式'],
 ['linear-equation','线性方程','linear','linear equation|system of equations','一次方程|线性方程|方程组'],
 ['quadratic','二次方程与根','quadratics','quadratic|discriminant','二次方程|判别式'],
 ['inequality','不等式与范围','inequalities','inequality|at least|at most','不等式|至少|至多'],
 ['sequence','数列','functions','sequence|consecutive terms|arithmetic progression|geometric progression','数列|等差|等比'],
 ['function','函数与映射','functions','function|domain|range','函数|定义域|值域'],
 ['rate','速度与路程','applications','speed|miles per hour|kilometers per hour|distance','速度|路程|行程'],
 ['work-rate','工程效率','applications','work rate|working together|complete the job','工程|合作完成|效率'],
 ['interest','利息','applications','interest|compounded','利息|复利|单利'],
 ['mixture','混合与浓度','applications','mixture|concentration|solution','浓度|混合|溶液'],
 ['slope','斜率','coordinates','slope','斜率'],
 ['intercept','截距','coordinates','intercept','截距'],
 ['coordinates','坐标与距离','coordinates','coordinate|origin|xy-plane|cartesian','坐标|原点|坐标平面'],
 ['parallel','平行与垂直','angles','parallel|perpendicular','平行|垂直'],
 ['angles','角度关系','angles','angle|degree','角度|补角|余角'],
 ['polygon','多边形内外角','polygons','polygon|pentagon|hexagon','多边形|五边形|六边形'],
 ['similarity','相似与全等','triangles','similar triangles|congruent','相似|全等'],
 ['pythagorean','直角三角形','triangles','right triangle|hypotenuse|pythagorean','直角三角形|斜边|勾股'],
 ['triangle','三角形边角与面积','triangles','triangle|triangular','三角形|三角形面积'],
 ['quadrilateral','四边形面积与周长','quadrilaterals','rectangle|square|parallelogram|trapezoid|rhombus','长方形|正方形|平行四边形|梯形|菱形'],
 ['circle','圆的半径与周长','circles','circle|radius|radii|diameter|circumference','半径|直径|圆周长'],
 ['sector','弧与扇形','circles','arc|sector|central angle','弧长|扇形|圆心角'],
 ['volume','体积与表面积','solids','volume|surface area|cube|cylinder|sphere|prism|cone','体积|表面积|圆柱|球体|圆锥|棱柱'],
 ['chart','图表读数','charts','graph|chart|table|bar|pie','图表|柱状图|饼图|折线图'],
 ['mean','平均数与加权平均','statistics','average|arithmetic mean|weighted','平均数|均值|加权平均'],
 ['median','中位数','statistics','median','中位数'],
 ['mode','众数','statistics','mode','众数'],
 ['dispersion','方差与标准差','statistics','standard deviation|variance','标准差|方差'],
 ['range-stat','极差','statistics','range of the data|range of the numbers','极差'],
 ['counting','排列组合','counting','permutation|combination|arrange|ways','排列|组合|种方法'],
 ['probability','事件概率','probability','probability|random|equally likely','概率|随机|等可能'],
 ['independence','独立与条件概率','probability','independent|conditional|given that','独立事件|条件概率'],
 ['normal','正态分布','distributions','normal distribution|normally distributed','正态分布'],
 ['percentile','百分位数','distributions','percentile|quartile','百分位|四分位'],
 ['sets','集合与容斥','sets','set|union|intersection|both|neither','集合|交集|并集|容斥']
];
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function containsTerm(text,term){if(!term)return false;return new RegExp('(^|[^a-z])'+escape(term).replace(/\s+/g,'\\s+')+'(?:s|es)?(?=$|[^a-z])','i').test(text||'');}
export const concepts=rows.map(([id,title,topic,en,zh])=>({id,title,topic,en:en.split('|'),zh:zh.split('|')}));
const vocabulary=[
 ['consecutive','连续的'],['integer','整数'],['remainder','余数'],['divisible','可整除的'],['factor','因数'],['multiple','倍数'],['prime','质数'],['composite','合数'],['even','偶数'],['odd','奇数'],['numerator','分子'],['denominator','分母'],['reciprocal','倒数'],['exponent','指数'],['square root','平方根'],['absolute value','绝对值'],['ratio','比'],['proportion','比例'],['percent','百分之'],['increase','增加'],['decrease','减少'],['approximate','近似的'],['distinct','不同的'],['positive','正的'],['negative','负的'],['nonzero','非零的'],['nonnegative','非负的'],['at least','至少'],['at most','至多'],['no more than','不超过'],['no less than','不少于'],['inclusive','包括端点的'],['exclusive','不包括端点的'],['respectively','分别地'],['equation','方程'],['inequality','不等式'],['solution','解；溶液（依语境）'],['function','函数'],['sequence','数列'],['slope','斜率'],['intercept','截距'],['coordinate','坐标'],['origin','原点'],['parallel','平行的'],['perpendicular','垂直的'],['congruent','全等的'],['similar','相似的'],['isosceles','等腰的'],['equilateral','等边的'],['hypotenuse','斜边'],['perimeter','周长'],['circumference','圆周长'],['radius','半径'],['diameter','直径'],['arc','弧'],['sector','扇形'],['tangent','切线'],['inscribed','内接的'],['circumscribed','外接的'],['rectangle','长方形'],['parallelogram','平行四边形'],['trapezoid','梯形'],['rhombus','菱形'],['volume','体积'],['surface area','表面积'],['cylinder','圆柱体'],['sphere','球体'],['cube','立方体；立方'],['average','平均数'],['median','中位数'],['mode','众数'],['standard deviation','标准差'],['variance','方差'],['range','极差；范围（依语境）'],['percentile','百分位数'],['probability','概率'],['random','随机的'],['independent','独立的'],['replacement','放回'],['without replacement','不放回'],['permutation','排列'],['combination','组合'],['intersection','交集'],['union','并集'],['interest','利息'],['compounded','复利计算的']
];
export const glossary=vocabulary.map(([word,zh])=>({word,zh}));
export function buildMatcher(data){
 const evidence=new Map(data.questions.map(q=>[q.id,{concepts:concepts.filter(c=>c.en.some(w=>containsTerm(q.searchText,w))||c.zh.some(w=>q.searchText.includes(w))).map(c=>c.id),terms:glossary.filter(t=>containsTerm(q.searchText,t.word)).map(t=>t.word)}]));
 const get=(q,record={})=>{const e=evidence.get(q.id);return {concepts:[...new Set([...e.concepts,...(record.concepts||[])])],terms:e.terms};};
 function matches(q,search,record={}){const text=search.trim().toLowerCase();if(!text)return true;const e=get(q,record),matchedConcepts=concepts.filter(c=>c.title.includes(text)||c.zh.some(w=>w.includes(text)||text.includes(w))||c.en.some(w=>w===text));const terms=glossary.filter(t=>t.word===text||t.zh.includes(text));return (record.words||[]).includes(text)||matchedConcepts.some(c=>e.concepts.includes(c.id))||terms.some(t=>containsTerm(q.searchText,t.word))||(/[\u3400-\u9fff]/.test(text)?q.searchText.includes(text):containsTerm(q.searchText,text));}
 function related(q,records={}){const a=get(q,records[q.id]),words=(records[q.id]?.words?.length?records[q.id].words:a.terms);return data.questions.filter(other=>other.id!==q.id).map(other=>{const b=get(other,records[other.id]),cs=a.concepts.filter(c=>b.concepts.includes(c)),ws=words.filter(w=>containsTerm(other.searchText,w)||(records[other.id]?.words||[]).includes(w));return {question:other,concepts:cs,words:ws,score:cs.length*3+ws.length*2};}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.question.ordinal-b.question.ordinal).slice(0,6);}
 return {get,matches,related};
}
