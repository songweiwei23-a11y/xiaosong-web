// 同一个问题，通过中转分别用「流式」和「非流式」各请求一次，对比：首字耗时、总耗时、字数、结束原因、是否截断。
// 不带 Dify 的提示词和知识库，只测模型本身。密钥只从环境变量读取，不打印。
const base = (process.env.TEST_BASE_URL || '').replace(/\/+$/, '');
const key = process.env.TEST_API_KEY || '';
const model = process.env.TEST_MODEL || 'claude-sonnet-4-6';
if (!base || !key) { console.error('缺少 TEST_BASE_URL 或 TEST_API_KEY'); process.exit(1); }

const CASES = [
  { name: '复杂分析', prompt: '请分析：同一条短视频在不同时段发布，完播率差异很大。原因有哪些？每个原因给出判断依据和一条可执行的对策。' },
  { name: '脚本生成', prompt: '给一个 30 秒的川菜烧烤探店短视频写分镜脚本，包括画面、口播和字幕，口播不超过 80 字。' },
  { name: '简短修改', prompt: '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。' },
];

const body = (prompt, stream) => JSON.stringify({
  model,
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 3000,
  stream,
  ...(stream ? { stream_options: { include_usage: true } } : {}),
});

async function plain(prompt) {
  const t0 = Date.now();
  const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body(prompt, false) });
  const text = await r.text();
  const ms = Date.now() - t0;
  if (!r.ok) return { ok: false, status: r.status, error: text.slice(0, 200).replaceAll(key, '<KEY>') };
  const j = JSON.parse(text);
  return { ok: true, ms, chars: (j.choices?.[0]?.message?.content ?? '').length, finish: j.choices?.[0]?.finish_reason, outTokens: j.usage?.completion_tokens, content: j.choices?.[0]?.message?.content ?? '' };
}

async function streamed(prompt) {
  const t0 = Date.now();
  const r = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body(prompt, true) });
  if (!r.ok) return { ok: false, status: r.status, error: (await r.text()).slice(0, 200).replaceAll(key, '<KEY>') };
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', content = '', firstAt = null, finish = null, usage = null, chunks = 0, sawDone = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { sawDone = true; continue; }
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.usage) usage = j.usage;
      const delta = j.choices?.[0]?.delta?.content;
      if (delta) { if (firstAt === null) firstAt = Date.now() - t0; content += delta; chunks++; }
      if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
    }
  }
  return { ok: true, ms: Date.now() - t0, ttftMs: firstAt, chunks, chars: content.length, finish, sawDone, outTokens: usage?.completion_tokens ?? null, content };
}

for (const c of CASES) {
  console.log(`\n=== ${c.name} ===`);
  const p = await plain(c.prompt);
  const s = await streamed(c.prompt);
  const show = (label, r) => {
    if (!r.ok) return console.log(`${label}: 失败 HTTP ${r.status} ${r.error}`);
    console.log(`${label}: 总耗时 ${r.ms}ms${r.ttftMs != null ? ` 首字 ${r.ttftMs}ms` : ''} 字数 ${r.chars} 输出token ${r.outTokens ?? '未返回'} 结束原因 ${r.finish}${label.startsWith('流式') ? ` 收到 DONE ${r.sawDone} 分片 ${r.chunks}` : ''}`);
  };
  show('非流式', p);
  show('流式  ', s);
  if (p.ok && s.ok) {
    const diff = Math.abs(p.chars - s.chars) / Math.max(p.chars, 1);
    console.log(`字数差异 ${(diff * 100).toFixed(0)}%${diff > 0.2 ? '（偏差较大，流式可能有丢失）' : '（基本一致）'}`);
    console.log(`流式开头：${s.content.replace(/\s+/g, ' ').slice(0, 80)}`);
    console.log(`流式结尾：${s.content.replace(/\s+/g, ' ').slice(-60)}`);
  }
}
