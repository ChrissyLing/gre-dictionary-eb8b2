/* 题目联网翻译：与查词页同一组免费翻译通道（MyMemory 优先，Google 兜底），无需密钥。
 * 纯函数切分 + 可注入 fetch 的实现，便于 node 测试。 */
export const MYMEMORY_TR = 'https://api.mymemory.translated.net/get?q=';
export const GOOGLE_TR = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=';

/* 按换行切段，累计不超过 max 字符；超长单行硬切。 */
export function chunkText(text, max = 450) {
  const lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (line.length > max) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < line.length; i += max) chunks.push(line.slice(i, i + max));
      continue;
    }
    if (current && current.length + line.length + 1 > max) { chunks.push(current); current = line; }
    else current = current ? current + '\n' + line : line;
  }
  if (current) chunks.push(current);
  return chunks;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function trMyMemory(text, fetchImpl) {
  const { signal, done } = withTimeout(8000);
  try {
    const res = await fetchImpl(MYMEMORY_TR + encodeURIComponent(text) + '&langpair=en|zh-CN', { signal });
    if (!res.ok) throw new Error('http ' + res.status);
    const d = await res.json();
    let out = d && d.responseData && d.responseData.translatedText;
    if (!out || /MYMEMORY WARNING|INVALID|QUOTA/i.test(out)) throw new Error('bad result');
    return out.replace(/\s*[\[【][^\]】]*[\]】]\s*$/, '').trim() || out;
  } finally { done(); }
}

async function trGoogle(text, fetchImpl) {
  const { signal, done } = withTimeout(5000);
  try {
    const res = await fetchImpl(GOOGLE_TR + encodeURIComponent(text), { signal });
    if (!res.ok) throw new Error('http ' + res.status);
    const d = await res.json();
    const out = (d && d[0] || []).map(seg => seg[0]).join('');
    if (!out) throw new Error('empty');
    return out;
  } finally { done(); }
}

/* 逐段翻译，MyMemory 失败后该段改用 Google；两个通道都失败则抛出错误。 */
export async function translateText(text, { fetchImpl = fetch } = {}) {
  const chunks = chunkText(text);
  if (!chunks.length) return '';
  const out = [];
  let backend = 'mymemory';
  for (const chunk of chunks) {
    const first = backend === 'google' ? trGoogle : trMyMemory;
    const second = backend === 'google' ? trMyMemory : trGoogle;
    try {
      out.push(await first(chunk, fetchImpl));
    } catch {
      out.push(await second(chunk, fetchImpl));
      backend = second === trGoogle ? 'google' : 'mymemory';
    }
  }
  return out.join('\n');
}
