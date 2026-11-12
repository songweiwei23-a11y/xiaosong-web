// 对四个档位的 Dify 应用各跑一轮测试：三个问题 × REPEATS 遍，记录输出 token、耗时、是否含 <think>，并保存正文供盲评。
// Key 只从环境变量读取（不写进文件、不打印）：
//   KEY_FAST（快速/low）、KEY_STANDARD（标准/medium）、KEY_HIGH（高/high）、KEY_MAX（max/xhigh）
// 地址从 .env.local 的 DIFY_BASE_URL 读取。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');

const TIERS = [
  { name: '快速', envKey: 'KEY_FAST' },
  { name: '标准', envKey: 'KEY_STANDARD' },
  { name: '高', envKey: 'KEY_HIGH' },
  { name: 'max', envKey: 'KEY_MAX' },
];
const REPEATS = Number(process.env.REPEATS || 2);

const CASES = [
  { id: 'Q1', name: '复杂分析', query: '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。' },
  { id: 'Q2', name: '脚本生成', query: '给一个 30 秒的川菜烧烤探店短视频写分镜脚本，包括画面、口播和字幕，口播不超过 80 字。' },
  { id: 'Q3', name: '简短修改', query: '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。' },
];

async function run(key, c, tier, round) {
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
      user: `four-apps-${tier.envKey}-${round}`,
    }),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, ms, error: text.slice(0, 200).replaceAll(key, '<KEY>') };
  const json = JSON.parse(text);
  const answer = json.answer ?? '';
  const close = answer.indexOf('</think>');
  return {
    ok: true,
    ms,
    completionTokens: json.metadata?.usage?.completion_tokens ?? null,
    hasThink: answer.startsWith('<think>'),
    thinking: close >= 0 ? answer.slice(0, close + 8) : '',
    visible: close >= 0 ? answer.slice(close + 8).trim() : answer,
  };
}

const summary = [];
for (const tier of TIERS) {
  const key = process.env[tier.envKey];
  if (!key) { console.log(`跳过「${tier.name}」：没有设置环境变量 ${tier.envKey}`); continue; }
  const rows = [];
  for (const c of CASES) {
    for (let r = 1; r <= REPEATS; r++) {
      console.log(`[${tier.name}] ${c.name} 第 ${r} 遍 ...`);
      const out = await run(key, c, tier, r);
      rows.push({ case: c.id, name: c.name, round: r, query: c.query, ...out });
      console.log(JSON.stringify({ ok: out.ok, ms: out.ms, completionTokens: out.completionTokens, hasThink: out.hasThink, status: out.status, error: out.error }));
    }
  }
  fs.writeFileSync(`.tmp/tier-${tier.envKey}.json`, JSON.stringify({ tier: tier.name, at: new Date().toISOString(), rows }, null, 2));
  const ok = rows.filter((r) => r.ok);
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  summary.push({
    tier: tier.name,
    avgTokens: avg(ok.map((r) => r.completionTokens ?? 0)),
    avgMs: avg(ok.map((r) => r.ms)),
    thinkCount: `${ok.filter((r) => r.hasThink).length}/${ok.length}`,
    failed: rows.length - ok.length,
  });
}

console.log('\n四档汇总：');
for (const s of summary) console.log(`- ${s.tier}：平均输出 token ${s.avgTokens}，平均耗时 ${s.avgMs}ms，含 <think> ${s.thinkCount}，失败 ${s.failed}`);
console.log('\n正文已分别保存到 .tmp/tier-KEY_*.json（盲评前不要打开，不要把里面的内容发给别人）。');
