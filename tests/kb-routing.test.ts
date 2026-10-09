/**
 * 编导知识库按任务分流（2026-10-05 质量整改第二阶段，lib/kb-routing）。
 * 实测：查知识库输入 32,363 token、首字 9～15.7 秒；不查 8,333 token、首字 3.5 秒。
 */
import { describe, expect, it } from 'vitest';
import { freeChatNeedsKnowledge, NO_KB_TASKS } from '@/lib/kb-routing';
import { readCode } from './helpers/source';

describe('知识库按任务分流', () => {
  it.each(['帮我写一条探店口播脚本', '这个开头钩子不够抓人', '怎么起号涨粉', '抖音直播间话术怎么写', '给我 5 个选题'])('短视频相关的要查：%s', (q) => {
    expect(freeChatNeedsKnowledge(q)).toBe(true);
  });
  it.each(['Excel 里怎么按月汇总金额', '帮我写个请假条', '今天北京天气怎么样', '这份合同第三条什么意思'])('无关的不查：%s', (q) => {
    expect(freeChatNeedsKnowledge(q)).toBe(false);
  });
  it('画布改一句从不查', () => expect(NO_KB_TASKS.has('画布改写')).toBe(true));
  it('接口：空检索词就是不查；画布、无关的自由对话问题传空', () => {
    const route = readCode('app/api/dify/chat/route.ts');
    expect(route).toMatch(/NO_KB_TASKS\.has\(taskType\) \? ''/);
    expect(route).toMatch(/body\.freeChat === true && !freeChatNeedsKnowledge\(question\) \? ''/);
    // 要联网的那一轮检索词照常传，免得联网节点读到空的
    expect(route).toMatch(/if \(webSession\.enabled && !difyPayload\.inputs\.search_query\) difyPayload\.inputs\.search_query = fullSearchQuery/);
  });
  it('按资料修正、深度研究、偏好学习本来就不查（传空检索词）', () => {
    expect(readCode('app/api/fact-fix/route.ts')).toMatch(/askDify\(buildFactFixPrompt\([^)]*\), userId, ''\)/);
    expect(readCode('lib/preference-learner.ts')).toMatch(/ask\(prompt, userId, ''\)|askDify/);
  });
});

describe('上线开关', () => {
  it('第二阶段测试应用对比通过前关着：一切照旧', async () => {
    const { KB_ROUTING_ENABLED } = await import('@/lib/kb-routing');
    expect(KB_ROUTING_ENABLED).toBe(false);
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/!KB_ROUTING_ENABLED \? fullSearchQuery/);
  });
});
