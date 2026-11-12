// 选题查重的真实模型验证（2026-11-09）：8 批真实选题 × 1 次小调用。只在服务器跑（密钥只在服务器 .env.local）。不碰数据库。
import fs from 'node:fs';
import { it } from 'vitest';
import { readAssistantConfig } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { buildDupPrompt, parseDupJson } from './topic-dup';

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const done = {
  A: ['一元火锅到底赚不赚钱', '成都师傅教你调一碗干碟', '夏天最后一锅冰粉', '串串签子为什么要数', '川味烧烤的辣椒面怎么炒', '老顾客每周都来的原因'],
  B: ['大码女生别再买oversize外套', '50码裤子怎么选长度', '宝妈试了五件最后选了这件', '夏天大码连衣裙别选雪纺', '大码女生的第一件西装', '我为什么只做大码'],
};

it('dup eval', async () => {
  const cfg = readAssistantConfig();
  if (!cfg) throw new Error('没有模型配置');
  const batches = JSON.parse(fs.readFileSync('.tmp/dup-eval/titles.json', 'utf8')) as Record<string, string[]>;
  const lines: string[] = [];
  for (const [name, titles] of Object.entries(batches).sort()) {
    const d = done[name[0] as 'A' | 'B'].map((title) => ({ title, status: '已发布' as const }));
    const p = buildDupPrompt(titles, d);
    const t0 = Date.now();
    const res = await callAssistantLlm(cfg, { system: p.system, messages: [{ role: 'user', content: p.user }], tools: [], maxTokens: 800 }, { signal: AbortSignal.timeout(40_000) });
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    const hits = parseDupJson(text, titles, d);
    lines.push(`== ${name}（${Math.round((Date.now() - t0) / 100) / 10} 秒）`, ...hits.map((h) => `  ${h.title}  ≈ ${h.like}｜${h.why}`));
  }
  fs.writeFileSync('.tmp/dup-eval/result.txt', lines.join('\n'), 'utf8');
});
