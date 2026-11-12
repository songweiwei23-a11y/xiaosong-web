// 实测中转能不能调用 Opus 5.5（只读，不写数据库）。结果写到 .tmp/knowledge-probe/opus-result.json。
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';

describe('Opus 5.5 中转实测', () => {
  it('能不能调用、耗时、用量', async () => {
    const cfg = readAssistantConfig();
    const result: Record<string, unknown> = {};
    if (!cfg) {
      result.error = '没有助理密钥';
    } else {
      for (const model of ['claude-opus-5-5', 'claude-sonnet-5-5']) {
        const started = Date.now();
        const out = await callAssistantLlm(
          { ...cfg, model },
          { system: '你是开物的助理。', messages: [{ role: 'user', content: '用一句中文说明你是谁，不超过30个字。' }], tools: [], maxTokens: 120 },
        )
          .then((r) => ({
            ok: true,
            text: r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').slice(0, 80),
            usage: r.usage,
          }))
          .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
        result[model] = { ...out, ms: Date.now() - started };
      }
    }
    // 路径相对于运行目录：本地是 .tmp/knowledge-probe，服务器是 .kb-probe，所以两边分开写
    const out = fs.existsSync('.kb-probe') ? '.kb-probe/opus-result.json' : '.tmp/knowledge-probe/opus-result.json';
    fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
    console.log(`OPUS_DONE ${JSON.stringify(result)}`);
  }, 300_000);
});
