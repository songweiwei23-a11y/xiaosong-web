// 只看结构：推理内容有没有结束标签，结束后面是不是正式回答。不打印密钥，不打印完整回答。
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);
const base = (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const key = env.DIFY_API_KEY;

const q = '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。';
const res = await fetch(`${base}/chat-messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputs: {
      query: q, search_query: q, conversation_history: '', dealReasons: '',
      web_search_enabled: '0',
      web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。',
    },
    query: q,
    response_mode: 'blocking',
    user: 'effect-test',
  }),
});
const json = await res.json();
const a = json.answer ?? '';
const close = a.indexOf('</think>');
const visible = close >= 0 ? a.slice(close + '</think>'.length).trim() : a;
console.log('answer total chars:', a.length);
console.log('starts with:', JSON.stringify(a.slice(0, 12)));
console.log('has </think> closing tag:', close >= 0);
console.log('think block chars:', close >= 0 ? close : 'n/a');
console.log('visible answer chars:', visible.length);
console.log('visible answer (first 160 chars):', visible.replace(/\s+/g, ' ').slice(0, 160));
