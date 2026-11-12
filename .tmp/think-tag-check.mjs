// 直接调中转：对比 thinking 开/关、reasoning_effort 低/高，检查回答里有没有 <think> 标签，以及标签内外的字数。
// 密钥只从环境变量读取，不打印。
const base = (process.env.TEST_BASE_URL || '').replace(/\/+$/, '');
const key = process.env.TEST_API_KEY || '';
const model = process.env.TEST_MODEL || 'claude-sonnet-4-6';
if (!base || !key) { console.error('缺少 TEST_BASE_URL 或 TEST_API_KEY'); process.exit(1); }

const PROMPT = '把这段改成三句话：今天的串串一元一串，老板手艺好，欢迎来吃。';
const CASES = {
  baseline: {},
  thinking_on: { thinking: { type: 'enabled', budget_tokens: 4000 } },
  effort_low: { reasoning_effort: 'low' },
  effort_high: { reasoning_effort: 'high' },
};

for (const [name, extra] of Object.entries(CASES)) {
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: 6000, ...extra }),
  });
  const text = await r.text();
  if (!r.ok) { console.log(`${name}: HTTP ${r.status} ${text.slice(0, 160).replaceAll(key, '<KEY>')}`); continue; }
  const j = JSON.parse(text);
  const content = j.choices?.[0]?.message?.content ?? '';
  const close = content.indexOf('</think>');
  const hasOpen = content.startsWith('<think>');
  const visible = close >= 0 ? content.slice(close + 8).trim() : content;
  console.log(`${name}: 输出token ${j.usage?.completion_tokens} | 有 <think> 开头 ${hasOpen} | 思考部分字数 ${close >= 0 ? close : 0} | 正文字数 ${visible.length} | 正文开头 ${JSON.stringify(visible.replace(/\s+/g, ' ').slice(0, 50))}`);
}
