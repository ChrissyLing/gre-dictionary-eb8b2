"""Build the same-origin Chinese-to-English index from bundled dictionary shards."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
entries = []
for source in sorted((root / 'data/v4').glob('?.json')):
    for word, record in json.loads(source.read_text()).items():
        if isinstance(record, dict) and record.get('z'):
            entries.append([word, record['z']])
entries.sort()
(root / 'data/zh-en-v1.json').write_text(json.dumps({'version': 1, 'entries': entries}, ensure_ascii=False, separators=(',', ':')))
print(f'Built reverse index for {len(entries):,} headwords')
