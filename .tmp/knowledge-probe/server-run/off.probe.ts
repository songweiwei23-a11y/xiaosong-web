// 线上对照探针：知识库没接通时的真实行为（不给工具，系统提示带上「没有接通」的说明，和线上 runAssistantJob 一致）。
// 在服务器应用目录里跑（.kb-probe/），跑完删除。
import { describe, it } from 'vitest';
import fs from 'node:fs';

import { readAssistantConfig } from '@/lib/assistant/config';
import { runAssistantAgent } from '@/lib/assistant/agent';
import { ASSISTANT_SYSTEM, assistantDateLine } from '@/lib/assistant/run';

// 与 lib/assistant/run.ts 里的 KNOWLEDGE_OFF_NOTE 保持一致
const KNOWLEDGE_OFF_NOTE = '\n\n编导知识库这次没有接通：没有 search_knowledge 工具。讲方法时用一般经验回答，不要说自己查过知识库，也不要写《资料名》。';

const QUESTIONS = [
  '我是做美食账号的，视频开头前三秒怎么抓住观众？给我三个能直接用的方法。',
  '选题怎么挑，才既不跑偏，又有爆的可能？',
  '今天天气怎么样',
];

describe('助理：知识库没接通时的真实行为', () => {
  it('不给工具 + 没接通的说明', async () => {
    const cfg = readAssistantConfig();
    if (!cfg) throw new Error('服务器没有配置助理模型');
    const report: Record<string, unknown>[] = [];
    for (const question of QUESTIONS) {
      const steps: string[] = [];
      const start = Date.now();
      const answer = await runAssistantAgent({
        cfg,
        system: ASSISTANT_SYSTEM + assistantDateLine() + KNOWLEDGE_OFF_NOTE,
        userText: question,
        history: [],
        tools: [],
        emit: (e: { type: string; text?: string }) => {
          if (e.type === 'step') steps.push(e.text ?? '');
        },
        isStopped: () => false,
      });
      const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
      report.push({
        question,
        ms: Date.now() - start,
        toolSteps: steps,
        citedDocs: [...new Set([...text.matchAll(/《([^》]+)》/g)].map((m) => m[1]))],
        chars: text.length,
        answer: text.slice(0, 1200),
      });
    }
    fs.writeFileSync('.kb-probe/result-off.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('PROBE_DONE');
  }, 1_200_000);
});
