// 判断中转的默认推理强度：用一道「需要想一想、但正文很短」的题，比较不传参数（默认）与各档 reasoning_effort 的输出 token。
// 输出 token 里包含看不见的推理部分；默认档的数字如果和某一档最接近，就可以推断默认档位。
// 密钥和地址只从环境变量读取：TEST_BASE_URL、TEST_API_KEY；可选 TEST_MODEL。
const base = (process.env.TEST_BASE_URL || '').replace(/\/+$/, '');
const key = process.env.TEST_API_KEY || '';
const model = process.env.TEST_MODEL || 'claude-sonnet-4-6';
if (!base || !key) { console.error('缺少 TEST_BASE_URL 或 TEST_API_KEY'); process.exit(1); }

const PROMPT = '一个盒子里有 3 个红球、5 个蓝球，随机取 2 个，两个都是蓝色的概率是多少？只给最终分数，不要解释。';
const LEVELS = [
  { name: '默认（不传）', extra: {} },
  { name: 'none', extra: { reasoning_effort: 'none' } },
  { name: 'minimal', extra: { reasoning_effort: 'minimal' } },
  { name: 'low', extra: { reasoning_effort: 'low' } },
  { name: 'medium', extra: { reasoning_effort: 'medium' } },
  { name: 'high', extra: { reasoning_effort: 'high' } },
  { name: 'xhigh', extra: { reasoning_effort: 'xhigh' } },
  { name: 'max', extra: { reasoning_effort: 'max' } },
];
const REPEATS = 3;

async function once(extra) {
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 4000, ...extra }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, error: text.slice(0, 160).replaceAll(key, '<KEY>') };
  const j = JSON.parse(text);
  const msg = j.choices?.[0]?.message ?? {};
  return {
    ok: true,
    tokens: j.usage?.completion_tokens ?? null,
    answer: (msg.content ?? '').replace(/\s+/g, ' ').slice(0, 40),
    keys: Object.keys(msg).join(','),
    reasoningField: typeof msg.reasoning_content === 'string' ? msg.reasoning_content.length : null,
  };
}

const table = [];
for (const lv of LEVELS) {
  const runs = [];
  for (let i = 0; i < REPEATS; i++) runs.push(await once(lv.extra));
  const ok = runs.filter((r) => r.ok);
  if (ok.length === 0) {
    table.push({ name: lv.name, status: '全部失败', detail: runs[0].error ?? runs[0].status });
    continue;
  }
  const avg = Math.round(ok.reduce((a, r) => a + (r.tokens ?? 0), 0) / ok.length);
  table.push({ name: lv.name, status: `成功 ${ok.length}/${REPEATS}`, avgTokens: avg, tokensEach: ok.map((r) => r.tokens).join(' / '), answer: ok[0].answer, keys: ok[0].keys, reasoningField: ok[0].reasoningField });
}

console.log('档位 | 结果 | 平均输出 token | 每次 | 正文开头 | 回复字段 | 推理字段长度');
for (const t of table) {
  if (t.avgTokens === undefined) { console.log(`${t.name} | ${t.status} | ${t.detail}`); continue; }
  console.log(`${t.name} | ${t.status} | ${t.avgTokens} | ${t.tokensEach} | ${JSON.stringify(t.answer)} | ${t.keys} | ${t.reasoningField ?? '无'}`);
}
