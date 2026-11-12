// 通过开物正式的 Dify 应用，测试「推理工作」档位（low / high）在线上的真实效果。
// 用法：LABEL=low node .tmp/dify-level-test.mjs   （每个问题跑 REPEATS 遍，默认 2 遍，结果存到 .tmp/level-<LABEL>.json）
// 密钥只从 .env.local 读取，不打印。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const key = env.DIFY_API_KEY;
if (!key) { console.error('.env.local 里没有 DIFY_API_KEY'); process.exit(1); }

const LABEL = process.env.LABEL;
if (!LABEL) { console.error('请设置 LABEL，例如 LABEL=low 或 LABEL=high'); process.exit(1); }
const REPEATS = Number(process.env.REPEATS || 2);

const CASES = [
  { name: '复杂分析', query: '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。' },
  { name: '脚本生成', query: '给一个 30 秒的川菜烧烤探店短视频写分镜脚本，包括画面、口播和字幕，口播不超过 80 字。' },
  { name: '简短修改', query: '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。' },
];

async function run(c) {
  const started = Date.now();
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        query: c.query, search_query: c.query, conversation_history: '', dealReasons: '',
        web_search_enabled: '0',
        web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。',
      },
      query: c.query,
      response_mode: 'blocking',
      user: `level-test-${LABEL}`,
    }),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, ms, error: text.slice(0, 200).replaceAll(key, '<KEY>') };
  const json = JSON.parse(text);
  const usage = json.metadata?.usage ?? {};
  const answer = json.answer ?? '';
  const close = answer.indexOf('</think>');
  return {
    ok: true,
    ms,
    completionTokens: usage.completion_tokens ?? null,
    promptTokens: usage.prompt_tokens ?? null,
    hasThink: answer.startsWith('<think>'),
    thinkChars: close >= 0 ? close : 0,
    visibleChars: close >= 0 ? answer.slice(close + 8).trim().length : answer.length,
  };
}

const results = [];
for (const c of CASES) {
  for (let i = 1; i <= REPEATS; i++) {
    console.log(`请求中：${c.name} 第 ${i} 遍 ...`);
    const r = await run(c);
    results.push({ case: c.name, round: i, ...r });
    console.log(JSON.stringify(r));
  }
}

const out = `.tmp/level-${LABEL}.json`;
fs.writeFileSync(out, JSON.stringify({ label: LABEL, at: new Date().toISOString(), results }, null, 2));
console.log(`\n已保存到 ${out}`);

const okRows = results.filter((r) => r.ok);
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
console.log(`\n[${LABEL}] 平均：输出token ${avg(okRows.map((r) => r.completionTokens ?? 0))}，耗时 ${avg(okRows.map((r) => r.ms))}ms，含 <think> 的次数 ${okRows.filter((r) => r.hasThink).length}/${okRows.length}`);
