"""Build same-origin dictionary shards from an ECDICT CSV (MIT licensed).
Usage: python scripts/build-dictionary.py /path/to/ecdict.csv
"""
import csv
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text()
core = json.JSONDecoder().raw_decode(html.split('window.W1400 = ', 1)[1])[0]
pairs = json.JSONDecoder().raw_decode(html.split('window.SEQ = ', 1)[1])[0]
wanted = set(core) | set(pairs)
valid = re.compile(r"[a-z][a-z '-]*\Z")
records = {}
exchanges = {}

def common(value):
    try:
        return 0 < int(value) <= 30000
    except (ValueError, TypeError):
        return False

with Path(sys.argv[1]).open(encoding='utf-8-sig', newline='') as source:
    for row in csv.DictReader(source):
        word = row['word'].strip().lower()
        if not valid.fullmatch(word):
            continue
        if not (word in wanted or row['tag'].strip() or common(row['bnc']) or common(row['frq'])):
            continue
        record = {k: row[field].replace('\\n', '\n').strip() for k, field in [('p', 'phonetic'), ('e', 'definition'), ('z', 'translation')]}
        if not (record['e'] or record['z']):
            continue
        # Prefer a lowercase dictionary headword over a capitalized duplicate.
        if word not in records or row['word'] == word:
            records[word] = {k: v for k, v in record.items() if v}
            exchanges[word] = row['exchange']

aliases = {}
for word, exchange in exchanges.items():
    for item in exchange.split('/'):
        kind, _, forms = item.partition(':')
        if kind not in {'p', 'd', 'i', '3', 'r', 't', 's'}:
            continue
        for form in forms.split(','):
            form = form.lower().strip()
            if valid.fullmatch(form) and form not in records:
                aliases.setdefault(form, word)
all_entries = {**aliases, **records}
out = root / 'data' / 'v4'
out.mkdir(parents=True, exist_ok=True)
for letter in 'abcdefghijklmnopqrstuvwxyz':
    shard = {w: all_entries[w] for w in sorted(all_entries) if w.startswith(letter)}
    (out / (letter + '.json')).write_text(json.dumps(shard, ensure_ascii=False, separators=(',', ':')) + '\n')
summary = {'source': 'ECDICT', 'source_repository': 'https://github.com/TheOpenDictionary/ecdict', 'source_blob_sha': 'ec19285744cc24443727dc9cdf75be66a28ca489', 'headwords': len(records), 'inflections': len(aliases), 'core_gre_entries': len(core), 'equivalence_headwords': len(pairs), 'missing_core': sorted(wanted - set(all_entries)), 'bytes': sum(p.stat().st_size for p in out.glob('*.json'))}
(out / 'manifest.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False))
for word in ['appropriate', 'pragmatic', 'lull', 'miscellaneous', 'acclaimed', 'buttressing', 'bolstering', 'hello']:
    assert word in all_entries, word
