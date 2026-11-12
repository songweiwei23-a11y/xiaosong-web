// 知识库相关度标定：关掉门槛，看每个问题前几段的原始分数和开头，供人工判断是否相关。只读，不调用模型。
import { describe, it } from 'vitest';
import fs from 'node:fs';

process.env.KNOWLEDGE_MIN_SCORE = '0';

import { searchKnowledge } from '@/lib/assistant/knowledge';

const QUESTIONS = [
  '选题怎么做，才有爆款的可能？',
  '开篇怎么抓人？',
  '脚本结构一般怎么搭？',
  '账号定位怎么选？',
  '拍摄怎么执行？',
  '代运营怎么收费？',
  '怎么提高视频完播率？',
  '我的额度还剩多少？',
];

describe('知识库相关度标定', () => {
  it('导出各问题前几段的分数与开头', async () => {
    const out: { q: string; hits: { doc: string; score: number; head: string }[] }[] = [];
    for (const q of QUESTIONS) {
      const hits = (await searchKnowledge(q)) ?? [];
      out.push({ q, hits: hits.map((h) => ({ doc: h.doc, score: Math.round(h.score * 1000) / 1000, head: h.content.slice(0, 70).replace(/\s+/g, ' ') })) });
    }
    fs.writeFileSync('.tmp/knowledge-probe/scores.json', JSON.stringify(out, null, 2), 'utf8');
    console.log('SCORES_DONE');
  }, 300_000);
});
