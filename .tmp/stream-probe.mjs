// 只读探测：用线上 Dify 应用做一次流式调用，记录各类事件出现的时间，判断「实时显示」是哪一环断了。
// 只输出事件类型、计数和时间，不输出回答内容。密钥只从 .env.local 读取。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const key = env.DIFY_API_KEY;
const q = '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。';

const t0 = Date.now();
const res = await fetch(`${base}/chat-messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: { query: q, search_query: q, conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。' },
    query: q, response_mode: 'streaming', user: 'stream-probe',
  }),
});
if (!res.ok) { console.log('HTTP', res.status, (await res.text()).slice(0, 160).replaceAll(key, '<KEY>')); process.exit(0); }

const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
const counts = {};
const firstAt = {};
let messageChars = 0;
let thinkSeen = false;
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line.startsWith('data:')) continue;
    let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
    const ev = j.event ?? 'unknown';
    counts[ev] = (counts[ev] ?? 0) + 1;
    if (firstAt[ev] === undefined) firstAt[ev] = Date.now() - t0;
    if (ev === 'message' || ev === 'agent_message') {
      messageChars += (j.answer ?? '').length;
      if ((j.answer ?? '').includes('<think>')) thinkSeen = true;
    }
  }
}
console.log('总耗时 ms:', Date.now() - t0);
console.log('事件计数：', JSON.stringify(counts));
console.log('各类事件首次出现时间 ms：', JSON.stringify(firstAt));
console.log('正文累计字数：', messageChars, '| 正文里出现过 <think>：', thinkSeen);
