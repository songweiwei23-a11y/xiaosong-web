// 通过开物正式的 Dify 应用，测试当前发布的模型设置（思考模式 + 推理工作）的耗时和 token 用量。
// 输入变量与 lib/dify-task.ts 的 askDify 完全一致。密钥只从 .env.local 读取，不打印。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const key = env.DIFY_API_KEY;
if (!key) { console.error('.env.local 里没有 DIFY_API_KEY'); process.exit(1); }

const CASES = [
  {
    name: '复杂分析',
    query: '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。',
  },
  {
    name: '脚本生成',
    query: '给一个 30 秒的川菜烧烤探店短视频写分镜脚本，包括画面、口播和字幕，口播不超过 80 字。',
  },
  {
    name: '简短修改',
    query: '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。',
  },
];

async function run(c) {
  const started = Date.now();
  const res = await fetch(`${base}/chat-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        query: c.query,
        search_query: c.query,
        conversation_history: '',
        dealReasons: '',
        web_search_enabled: '0',
        web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。',
      },
      query: c.query,
      response_mode: 'blocking',
      user: 'effect-test',
    }),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) return { name: c.name, ok: false, status: res.status, ms, error: text.slice(0, 300).replaceAll(key, '<KEY>') };
  let json;
  try { json = JSON.parse(text); } catch { return { name: c.name, ok: false, status: res.status, ms, error: '返回不是 JSON' }; }
  const usage = json.metadata?.usage ?? {};
  return {
    name: c.name,
    ok: true,
    ms,
    answerChars: (json.answer ?? '').length,
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
    difyLatency: usage.latency ?? null,
    usageKeys: Object.keys(usage).join(','),
    preview: (json.answer ?? '').replace(/\s+/g, ' ').slice(0, 60),
  };
}

for (const c of CASES) {
  console.log(`请求中：${c.name} ...`);
  const r = await run(c);
  console.log(JSON.stringify(r, null, 2));
}
