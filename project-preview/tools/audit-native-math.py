from pathlib import Path
import json,re,io,unicodedata,collections
import pymupdf as fitz
from fontTools.ttLib import TTFont
root=Path('/tmp/gre-account-project/preview');data=json.loads((root/'releases/0.2.3/quant-v1.json').read_text());D=fitz.open('/tmp/gre-quant-import/sources/zw900.pdf');fontcache={};pages={}
def fontmap(page):
 out={}
 for f in page.get_fonts():
  key=re.sub('[^a-z]','',f[3].split('+')[-1].lower())
  if f[0] not in fontcache:
   try:
    raw=D.extract_font(f[0])[3];ft=TTFont(io.BytesIO(raw));cmap=ft.getBestCmap();m={}
    for u,name in cmap.items():
     if u<0xE000 or u>0xF8FF:m.setdefault(ft.getGlyphID(name),chr(u))
    fontcache[f[0]]=m
   except Exception:fontcache[f[0]]={}
  out[key]=fontcache[f[0]]
 return out
for pageNum in sorted(set(q['page'] for q in data['questions'] if q['source']=='zw900')):
 page=D[pageNum-1];fm=fontmap(page);trace={}
 for span in page.get_texttrace():
  key=re.sub('[^a-z]','',span['font'].lower());m=next((v for k,v in fm.items() if k.startswith(key) or key.startswith(k)),{})
  for code,gid,origin,bbox in span['chars']:
   ch=chr(code) if code>=32 else ''
   if 'dejavu' in key or code==65533:ch=m.get(gid,ch)
   trace[(round(origin[0],2),round(origin[1],2))]=unicodedata.normalize('NFKC',ch)
 lines=[]
 for block in page.get_text('rawdict')['blocks']:
  if 'lines' not in block:continue
  for line in block['lines']:
   if abs(line['dir'][1])>.01:continue
   chars=[]
   for span in line['spans']:
    if span['size']>18:continue
    for c in span['chars']:
     orig=c['origin'];value=trace.get((round(orig[0],2),round(orig[1],2)),c['c']);chars.append({'text':value,'sup':bool(span['flags']&1),'x':orig[0]/page.rect.width,'y':orig[1]/page.rect.height,'font':span['font']})
   text=''.join(c['text'] for c in chars)
   if not text.strip():continue
   # Remove publisher annotation by character range without dropping the mathematical question line.
   pub=re.search(r'[【\[]?微信公众号',text)
   if pub:chars=chars[:pub.start()]
   if not chars:continue
   if re.fullmatch(r'真经GRE|张巍GRE.*|第\s*\d+\s*页',''.join(c['text'] for c in chars).strip()):continue
   lines.append({'chars':chars,'y':min(c['y'] for c in chars),'x':min(c['x'] for c in chars)})
 pages[pageNum]={'lines':lines,'drawings':page.get_drawings(),'width':page.rect.width,'height':page.rect.height}
result={};counts=collections.Counter()
for q in data['questions']:
 if q['source']!='zw900':continue
 out=[];haslayout=False;unmapped=False;supers=[]
 for region in q['regions']:
  pn=region['page'];p=pages.get(pn)
  if not p:continue
  ls=[l for l in p['lines'] if any(region['y']<=c['y']<=region['end'] for c in l['chars']) and region['x']<=l['x']<region['right']]
  ls.sort(key=lambda l:(round(l['y']/.004),l['x']))
  # Start at this question's own marker where possible, retaining any math spans in its line.
  own=next((i for i,l in enumerate(ls) if re.match(r'^\s*'+str(q['number'])+r'\.(?!\d)',''.join(c['text'] for c in l['chars']))),None)
  if own is not None:ls=ls[own:]
  for l in ls:
   runs=[]
   for c in l['chars']:
    if runs and runs[-1]['sup']==c['sup']:runs[-1]['text']+=c['text']
    else:runs.append({'text':c['text'],'sup':c['sup']})
   txt=''.join(r['text'] for r in runs)
   if not txt.strip():continue
   if re.match(r'^\s*'+str(q['number']+1)+r'\.(?!\d)',txt):break
   for r in runs:
    if r['sup'] and r['text'].strip():supers.append(r['text'].strip())
   if any('Kingsoft' in c['font'] for c in l['chars']):haslayout=True
   if '\ufffd' in txt or re.search('[\u01c0-\u024f\ue000-\uf8ff]',txt):unmapped=True
   out.append(runs)
  # Geometric paths can contain fraction bars, radical overbars, or required figures.
  for draw in p['drawings']:
   rect=draw['rect'];y=(rect.y0+rect.y1)/2/p['height'];color=draw.get('color') or draw.get('fill')
   if color and max(color)-min(color)<.2 and region['y']<y<region['end'] and rect.width>2 and rect.height<100:haslayout=True
 plain='\n'.join(''.join(('^('+r['text']+')' if r['sup'] and r['text'].strip() else r['text']) for r in line) for line in out)
 if re.search(r'\b(table|graph|figure|diagram|shaded)\b',plain,re.I):haslayout=True
 good=bool(out) and not haslayout and not unmapped and len(plain)>20
 entry={'lines':out,'plain':plain,'superscripts':supers,'requiresLayout':haslayout,'unmapped':unmapped,'eligible':good,'method':'pdf-characters-and-superscript-positions'}
 result[q['id']]=entry;counts['nativeQuestions']+=1;counts['withSuperscripts']+=bool(supers);counts['eligible']+=good;counts['layoutReview']+=haslayout;counts['unmapped']+=unmapped
Path('/tmp/gre-quant-import/native-math-audit.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
print(dict(counts));print(json.dumps(result['zw900-p006-q010-0010'],ensure_ascii=False,indent=2))
