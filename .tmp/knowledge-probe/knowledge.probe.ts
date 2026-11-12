// 真实探针（只测检索）：真实 Dify 知识库检索，看召回什么、耗时多少。不调用助理模型（本地没有中转密钥）。
import { describe, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: async () => ({ ok: true, reservation: { userId: 'probe', requestId: 'probe', feature: 'knowledge' } }),
  settleCreation: async () => undefined,
  releaseCreation: async () => undefined,
}));

import { knowledgeConfigured, knowledgeResultText, searchKnowledge } from '@/lib/assistant/knowledge';

const QUESTIONS = [
  '我是做美食账号的，视频开头前三秒怎么抓住观众？给我三个能直接用的方法。',
  '选题怎么挑，才既不跑偏，又有爆的可能？',
  '今天天气怎么样',
];

describe('助理查知识库：真实检索', () => {
  it('真实 Dify 检索', async () => {
    const configured = knowledgeConfigured();
    if (!configured) throw new Error('本地没有配置 DIFY_DATASET_API_KEY');
    const report: unknown[] = [];
    for (const question of QUESTIONS) {
      const t0 = Date.now();
      const hits = await searchKnowledge(question);
      const ms = Date.now() - t0;
      report.push({
        question,
        ms,
        returned: hits === null ? 'null（查不到）' : `${hits.length} 段`,
        hits: hits?.map((h) => ({ doc: h.doc, score: h.score, head: h.content.slice(0, 80) })) ?? [],
        textChars: hits?.length ? knowledgeResultText(hits).length : 0,
      });
    }
    fs.writeFileSync('.tmp/knowledge-probe/result.json', JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  }, 300_000);
});
