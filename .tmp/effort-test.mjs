// 推理强度测试：直接请求 OpenAI 兼容接口（不经过 Dify），对比 reasoning_effort 为 low / high 时的输出长度和耗时。
// 密钥只从环境变量读取，不写进文件、不打印。
//
// 用法（在你自己的终端里，变量只在当前窗口有效）：
//   PowerShell:  $env:TEST_BASE_URL="<BASE_URL>"; $env:TEST_API_KEY="<KEY>"; node .tmp/effort-test.mjs
//   可选：$env:TEST_MODEL="claude-sonnet-4-6"（默认就是这个）

const base = (process.env.TEST_BASE_URL || '').replace(/\/+$/, '');
const key = process.env.TEST_API_KEY || '';
const model = process.env.TEST_MODEL || 'claude-sonnet-4-6';

if (!base || !key) {
  console.error('缺少环境变量 TEST_BASE_URL 或 TEST_API_KEY。见本文件开头的用法。');
  process.exit(1);
}

const PROMPT = '请用三步拆解：为什么同一条短视频在不同时段的完播率差异很大？每一步都要具体分析，给出判断依据。';

async function run(effort) {
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        reasoning_effort: effort,
        messages: [{ role: 'user', content: PROMPT }],
        max_tokens: 4000,
      }),
    });
  } catch (e) {
    return { effort, ok: false, error: `网络错误：${e.message}` };
  }
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) {
    return { effort, ok: false, status: res.status, ms, error: text.slice(0, 300) };
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { effort, ok: false, status: res.status, ms, error: '返回不是 JSON：' + text.slice(0, 200) };
  }
  const usage = json.usage || {};
  const reply = json.choices?.[0]?.message?.content ?? '';
  return {
    effort,
    ok: true,
    status: res.status,
    ms,
    completionTokens: usage.completion_tokens ?? usage.output_tokens ?? null,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? null,
    replyChars: reply.length,
    finish: json.choices?.[0]?.finish_reason ?? null,
  };
}

const rows = [];
for (const effort of ['low', 'high']) {
  console.log(`请求中：reasoning_effort=${effort} ...`);
  rows.push(await run(effort));
}

console.log('\n结果：');
for (const r of rows) {
  if (!r.ok) {
    console.log(`- ${r.effort}: 失败 HTTP ${r.status ?? '-'}  ${r.error}`);
  } else {
    console.log(
      `- ${r.effort}: 耗时 ${r.ms}ms  输出token ${r.completionTokens ?? '未返回'}  ` +
      `推理token ${r.reasoningTokens ?? '未返回'}  回复字数 ${r.replyChars}  结束原因 ${r.finish}`
    );
  }
}

const [low, high] = rows;
console.log('\n判断：');
if (!low.ok || !high.ok) {
  const bad = !low.ok ? low : high;
  if (/reasoning_effort|unknown|unsupported|invalid/i.test(bad.error || '')) {
    console.log('接口明确拒绝了 reasoning_effort 参数（不支持这个写法）。');
  } else {
    console.log('有请求失败，先看上面的错误信息，判断不了参数是否生效。');
  }
} else {
  const a = low.reasoningTokens ?? low.completionTokens;
  const b = high.reasoningTokens ?? high.completionTokens;
  if (a == null || b == null) {
    console.log('接口没有返回 token 用量，只能靠回复字数和耗时判断：');
    console.log(`回复字数 ${low.replyChars} → ${high.replyChars}，耗时 ${low.ms}ms → ${high.ms}ms。`);
  } else {
    const diff = Math.abs(b - a) / Math.max(a, 1);
    if (diff >= 0.15) {
      console.log(`两档的 token 用量相差 ${(diff * 100).toFixed(0)}%，参数疑似生效（high 更深、更耗 token）。`);
    } else {
      console.log(`两档的 token 用量只差 ${(diff * 100).toFixed(0)}%，参数疑似被忽略，或者这个接口不映射它。`);
      console.log('注意：单次采样有波动，建议再跑一次确认。');
    }
  }
}
