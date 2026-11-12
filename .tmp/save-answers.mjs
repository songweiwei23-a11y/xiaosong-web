// 保存当前线上档位在三个问题上的完整回答，供人工打分。
// 用法：LABEL=high node .tmp/save-answers.mjs   → 写入 .tmp/answers-<LABEL>.json
// 密钥只从 .env.local 读取，不打印。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const key = env.DIFY_API_KEY;
const LABEL = process.env.LABEL;
if (!LABEL) { console.error('请设置 LABEL'); process.exit(1); }

const CASES = [
  { id: 'Q1', name: '复杂分析', query: '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。' },
  { id: 'Q2', name: '脚本生成', query: '给一个 30 秒的川菜烧烤探店短视频写分镜脚本，包括画面、口播和字幕，口播不超过 80 字。' },
  { id: 'Q3', name: '简短修改', query: '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。' },
];

const out = [];
for (const c of CASES) {
  console.log(`请求中：${c.name} ...`);
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: { query: c.query, search_query: c.query, conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。' },
      query: c.query, response_mode: 'blocking', user: `save-${LABEL}`,
    }),
  });
  const text = await res.text();
  if (!res.ok) { console.log(`${c.name} 失败 HTTP ${res.status}`); continue; }
  const json = JSON.parse(text);
  const answer = json.answer ?? '';
  const close = answer.indexOf('</think>');
  out.push({
    id: c.id,
    name: c.name,
    query: c.query,
    thinking: close >= 0 ? answer.slice(0, close + 8) : '',
    visible: close >= 0 ? answer.slice(close + 8).trim() : answer,
    completionTokens: json.metadata?.usage?.completion_tokens ?? null,
  });
}
fs.writeFileSync(`.tmp/answers-${LABEL}.json`, JSON.stringify({ label: LABEL, at: new Date().toISOString(), items: out }, null, 2));
console.log(`已保存 ${out.length} 条到 .tmp/answers-${LABEL}.json`);
