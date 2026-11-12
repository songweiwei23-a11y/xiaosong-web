// 线上真实 A/B 探针：同一问题，只给 search_knowledge 工具 vs 不给任何工具。真实 Dify 检索、真实助理模型。
// 在服务器的应用目录里跑（.kb-probe/），跑完删除。额度用假的，不扣真实额度。
import { describe, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('@/lib/creation-quota', () => ({
  reserveCreation: async () => ({ ok: true, reservation: { userId: 'probe', requestId: 'probe', feature: 'knowledge' } }),
  settleCreation: async () => undefined,
  releaseCreation: async () => undefined,
}));

import { readAssistantConfig } from '@/lib/assistant/config';
import { runAssistantAgent } from '@/lib/assistant/agent';
import { createAssistantTools } from '@/lib/assistant/tools';
import { ASSISTANT_SYSTEM, assistantDateLine } from '@/lib/assistant/run';
import { knowledgeConfigured } from '@/lib/assistant/knowledge';

const QUESTIONS = [
  '我是做美食账号的，视频开头前三秒怎么抓住观众？给我三个能直接用的方法。',
  '选题怎么挑，才既不跑偏，又有爆的可能？',
  '今天天气怎么样',
];

describe('助理查知识库：线上真实 A/B', () => {
  it('有知识库工具 vs 没有', async () => {
    const cfg = readAssistantConfig();
    if (!cfg) throw new Error('服务器没有配置助理模型');
    if (!knowledgeConfigured()) throw new Error('服务器没有读到知识库密钥');
    const report: Record<string, unknown>[] = [];
    for (const question of QUESTIONS) {
      const row: Record<string, unknown> = { question };
      for (const withKb of [true, false]) {
        const steps: string[] = [];
        const tools = createAssistantTools({ userId: 'probe', cookie: 'probe=1', internalBase: 'http://127.0.0.1:1' }).filter((t) =>
          withKb ? t.name === 'search_knowledge' : false,
        );
        const start = Date.now();
        const answer = await runAssistantAgent({
          cfg,
          system: ASSISTANT_SYSTEM + assistantDateLine(),
          userText: question,
          history: [],
          tools,
          emit: (e: { type: string; text?: string }) => {
            if (e.type === 'step') steps.push(e.text ?? '');
          },
          isStopped: () => false,
        });
        const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
        row[withKb ? 'withKnowledge' : 'withoutKnowledge'] = {
          ms: Date.now() - start,
          toolSteps: steps,
          citedDocs: [...new Set([...text.matchAll(/《([^》]+)》/g)].map((m) => m[1]))],
          chars: text.length,
          answer: text.slice(0, 1200),
        };
      }
      report.push(row);
    }
    fs.writeFileSync('.kb-probe/result.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('PROBE_DONE');
  }, 1_200_000);
});
