import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readResearchMeta, researchAsk } from '@/lib/research-meta';
import { sanitizeMessages } from '@/lib/chat-message-utils';

const JOB = '0f8fad5b-d9cb-469f-a165-70867728950e';
const read = (p: string) => readFileSync(p, 'utf8');

describe('深度研究留在对话里（2026-10-04 产品方：和出方案一样，不弹全屏）', () => {
  it('研究记录：只认合法的研究编号，状态和深度清洗', () => {
    expect(readResearchMeta({ jobId: 'x', topic: 't' })).toBeNull();
    expect(readResearchMeta(null)).toBeNull();
    expect(readResearchMeta({ jobId: JOB, topic: '团购', depth: 'deep', status: 'running', partial: true })).toEqual({ jobId: JOB, topic: '团购', depth: 'deep', status: 'running', partial: true });
    expect(readResearchMeta({ jobId: JOB, depth: 'weird', status: 'hacked' })).toEqual({ jobId: JOB, topic: '', depth: 'standard' });
  });

  it('对话存进去、读回来，研究记录还在（刷新后计划、进度卡片不丢）', () => {
    const [user, answer] = sanitizeMessages([
      { role: 'user', content: researchAsk('团购值不值得做', '标准'), timestamp: 1, research: { jobId: JOB, topic: '团购值不值得做', depth: 'standard' } },
      { role: 'assistant', content: '', timestamp: 2, research: { jobId: JOB, topic: '团购值不值得做', depth: 'standard', status: 'plan_ready' } },
    ]);
    expect(user.content).toContain('深度研究（标准）');
    expect(user.research?.jobId).toBe(JOB);
    expect(answer.research?.status).toBe('plan_ready');
    expect(read('lib/chat-store.ts')).toMatch(/m\.research \? \{ research: m\.research \}/);
  });

  it('入口是输入框上方的小卡片，计划、进度在对话里；不再用全屏弹层', () => {
    const page = read('app/dashboard/free-chat/page.tsx');
    expect(page).not.toMatch(/<ResearchPanel/);
    expect(page).toMatch(/<ResearchStarter/);
    expect(page).toMatch(/<ResearchCard/);
    for (const f of ['components/chat/ResearchStarter.tsx', 'components/chat/ResearchCard.tsx']) {
      expect(read(f)).not.toMatch(/fixed inset-0|role="dialog"/);
    }
    // 研究那一轮不能「重新生成」「改一下再问」：那会把「🔎 深度研究：…」当普通问题发出去
    expect(page).toMatch(/lastUser\.research\) return/);
    expect(page).toMatch(/!msg\.plan && !msg\.research/);
  });

  it('紧接着追问时把报告带给模型（报告是服务端单独写的，对话记忆里没有）', () => {
    expect(read('app/dashboard/free-chat/page.tsx')).toMatch(/【刚才的深度研究报告】/);
  });
});
