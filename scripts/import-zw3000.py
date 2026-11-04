"""Import the supplied zw 3000-word PDF; retain full provenance and inline only missing study headwords.
Usage: python scripts/import-zw3000.py /path/to/source.pdf --html index.html --output data/zw3000-v1.json
Requires pdfplumber. Read-only on the source PDF; does not deploy anything.
"""
from pathlib import Path
import argparse, hashlib, json, re, unicodedata
import pdfplumber

def clean(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', text or '').replace('\u00ad', '')).strip()

def normalize_word(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', clean(text.replace('\n', ''))) if not unicodedata.combining(c)).lower()

def clean_zh(text):
    return re.sub(r'(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])', '', text).strip()

def extract(source):
    entries = {}
    with pdfplumber.open(source) as doc:
        pages = len(doc.pages)
        for number, original in enumerate(doc.pages, 1):
            if number < 5:
                continue
            page = original.filter(lambda obj: obj.get('object_type') != 'char' or
                (abs(obj.get('matrix', (1, 0, 0, 1))[1]) < .01 and abs(obj.get('matrix', (1, 0, 0, 1))[2]) < .01))
            for table in page.extract_tables():
                for cells in table:
                    row = [clean(c) for c in cells]
                    if not any(row) or row[0] == '词汇' or '张巍GRE' in row[0]:
                        continue
                    word = normalize_word(cells[0] or '')
                    if len(row) != 5 or not re.fullmatch(r"[a-z][a-z '-]*", word) or not row[2]:
                        raise ValueError(f'Unparsed source row at PDF page {number}: {row}')
                    senses = []
                    for text in re.split(r'(?=\(\d+\))', row[2]):
                        text = re.sub(r'^\(\d+\)\s*', '', text.strip())
                        if not text:
                            continue
                        match = re.match(r'^(adj\.|adv\.|vt\.|vi\.|v\.|n\.|prep\.|conj\.|interj\.|phrase\.)\s*(.*)', text)
                        pos, body = (match[1], match[2]) if match else ('', text)
                        chinese = re.search(r'[\u3400-\u9fff]', body)
                        if not chinese:
                            raise ValueError(f'No Chinese definition: {word}, PDF page {number}')
                        senses.append(dict(pos=pos, en=body[:chinese.start()].strip(), zh=clean_zh(body[chinese.start():]), raw=text, page=number))
                    example = row[4]
                    chinese = re.search(r'[\u3400-\u9fff]', example)
                    en, zh = (example[:chinese.start()].strip(), clean_zh(example[chinese.start():])) if chinese else (example, '')
                    if word in entries:
                        raise ValueError(f'Duplicate headword: {word}, PDF page {number}')
                    entries[word] = dict(p=row[1], senses=senses, eq=row[3], examples=[dict(en=en, zh=zh, raw=example, page=number)] if example else [])
            page.close()
    return entries, pages

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--html', type=Path, default=Path('index.html'))
    parser.add_argument('--output', type=Path, default=Path('data/zw3000-v1.json'))
    args = parser.parse_args()
    entries, pages = extract(args.pdf)
    html = args.html.read_text()
    primary = set()
    for name in ['W1400', 'QS', 'JJ_TOWN', 'JJ_READ']:
        match = re.search(r'window\.' + name + r'\s*=\s*(\{.*?\});', html)
        if not match:
            raise ValueError(f'Missing primary study source: {name}')
        primary.update(json.loads(match[1]))
    fallback = {w: d for w, d in entries.items() if w not in primary}
    metadata = dict(source=args.pdf.name, label='zw 镇考3000词', pages=pages,
        sha256=hashlib.sha256(args.pdf.read_bytes()).hexdigest(), headwords=len(entries), fallback_headwords=len(fallback),
        priority='Use only when W1400, QS, JJ_TOWN, and JJ_READ have no matching entry. Equivalence tables and the general dictionary do not suppress this source.')
    dump = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(dump(dict(version=1, meta=metadata, entries=entries)))
    script = '<script id="zw3000-data">window.ZW3000 = ' + dump(fallback) + ';</script>'
    if '<script id="zw3000-data">' in html:
        html = re.sub(r'<script id="zw3000-data">.*?</script>', lambda _: script, html, count=1, flags=re.S)
    else:
        html = html.replace('<script id="gre-data">', script + '\n<script id="gre-data">', 1)
    args.html.write_text(html)
    print(f'{len(entries)} source headwords; {len(fallback)} inlined supplement records. Runtime checks primary forms before using the supplement.')

if __name__ == '__main__':
    main()
