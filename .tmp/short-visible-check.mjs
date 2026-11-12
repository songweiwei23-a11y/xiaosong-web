// 只跑一次「简短修改」，打印去掉思考部分后的正文，用来确认正文是否符合「三句话」。不保存，不打印密钥。
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
    inputs: { query: q, search_query: q, conversation_history: '', dealReasons: '', web_search_enabled: '0', web_search_note: '本轮不执行联网搜索；依据当前用户材料与可检索的知识库作答，缺少依据的保持未知。' },
    query: q, response_mode: 'blocking', user: 'short-visible-check',
  }),
});
const json = await res.json();
const a = json.answer ?? '';
const close = a.indexOf('</think>');
const visible = close >= 0 ? a.slice(close + 8).trim() : a;
console.log('正文（去掉思考部分）：');
console.log(JSON.stringify(visible));
console.log('正文字数：' + visible.length + '，输出 token：' + (json.metadata?.usage?.completion_tokens ?? '?'));
