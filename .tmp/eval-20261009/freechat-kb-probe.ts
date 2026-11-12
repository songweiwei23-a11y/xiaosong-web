// 自由对话接知识库后：同一个问题，看输入 token 是否从约 6 千涨到含知识库的量，回答里是否用上知识库方法
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2'); }
const { askDify } = await import('@/lib/dify-task');
const raw = fs.readFileSync('docs/开物修复前后对比_20261009/修复后_第3轮/提示词/01.txt', 'utf8');
const search = raw.match(/^【检索词】(.*)$/m)?.[1] ?? '';
const query = raw.replace(/^【检索词】.*\n\n/, '');
const before = JSON.parse(fs.readFileSync('docs/开物修复前后对比_20261009/修复后_第3轮/自动检查结果.json', 'utf8')).find((r: any) => r.id === '01');
const t = Date.now();
const r = await askDify(query, 'kaiwu-eval-freechat-kb', search, { signal: AbortSignal.timeout(420_000) });
const usage = r.ok ? (r.completion as any).usage : null;
const text = r.ok ? r.text : '';
fs.writeFileSync('docs/自由对话接知识库_20261009/接入后自由对话实测.md', `> 用时 ${Math.round((Date.now() - t) / 1000)} 秒，${text.length} 字；输入 ${usage?.prompt_tokens} token（接入前同一问题 ${before?.auto?.usage?.prompt_tokens}）\n\n${text}`);
console.log(JSON.stringify({ ok: r.ok, sec: Math.round((Date.now() - t) / 1000), chars: text.length, promptTokens: usage?.prompt_tokens, beforeTokens: before?.auto?.usage?.prompt_tokens, search: search.slice(0, 60) }));
