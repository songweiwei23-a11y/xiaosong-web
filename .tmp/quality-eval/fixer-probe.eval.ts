// 只读探针：定位类事实修正为什么返回失败。同一份账号定位输出，只测修正请求的耗时（超时放宽到 420 秒）。
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { buildFactFixPrompt } from '@/lib/fact-fix';

const RUN = path.join('.tmp', 'quality-eval', 'fresh', '2026-10-11T16-14-43');

describe('定位类事实修正探针', () => {
  it('同一份账号定位输出：修正请求要多久', async () => {
    const text = fs.readFileSync(path.join(RUN, 'p1-account.md'), 'utf8').replace(/^# .*\n\n/, '');
    const issues = ['百分比「流量45%」没有出处'];
    const prompt = buildFactFixPrompt({ text, issues, context: '' });
    const t0 = Date.now();
    const r = await askDify(prompt, 'e17250a0-6822-40db-bb99-6ae1d5661505', '定位 探针', { signal: AbortSignal.timeout(420_000) });
    const line = `上下文为空: 请求长度 ${prompt.length} 字，输出长度 ${text.length} 字 → ${r.ok ? `成功，返回 ${r.text.length} 字` : `失败：${r.message}`}，耗时 ${Math.round((Date.now() - t0) / 1000)} 秒`;
    fs.writeFileSync(path.join(RUN, 'fixer-probe.txt'), line + '\n');
    console.log(line);
  }, 900_000);
});
