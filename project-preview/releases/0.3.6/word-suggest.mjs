/* 查词联想：纯函数模块，浏览器与 node 测试共用。
 * entries 为 [word, zh, gre] 三元组：word 小写词头，zh 简短中文释义，gre 表示来自 GRE 资料词表。 */
export function normalizeQuery(raw) {
  const q = String(raw || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\u2019/g, "'").trim().toLowerCase();
  return /^[a-z][a-z'-]{0,39}$/.test(q) ? q : '';
}

export function rankSuggestions(entries, rawQuery, limit = 8) {
  const query = normalizeQuery(rawQuery);
  if (!query || query.length < 2 || !Array.isArray(entries)) return [];
  const seen = new Set();
  const matches = [];
  for (const item of entries) {
    if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
    const word = item[0];
    if (seen.has(word) || !word.startsWith(query)) continue;
    seen.add(word);
    matches.push({ word, zh: typeof item[1] === 'string' ? item[1] : '', gre: item[2] === true || item[2] === 1 });
  }
  matches.sort((a, b) =>
    Number(b.gre) - Number(a.gre) ||
    a.word.length - b.word.length ||
    a.word.localeCompare(b.word));
  return matches.slice(0, Math.max(1, Math.min(20, limit)));
}
