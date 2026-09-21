import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from '@/lib/search-query';

describe('buildSearchQuery', () => {
  it('账号定位：4800+ 字的完整指令不会进入检索查询', () => {
    const longPrompt = '请帮我进行短视频账号定位分析\n' + '输出要求：'.repeat(1200);
    const q = buildSearchQuery(
      '账号定位',
      { taskType: '账号定位', accountStage: '0-1万粉', monetizationGoal: '本地探店', profileInfo: longPrompt },
      longPrompt
    );
    expect(q.length).toBeLessThanOrEqual(200);
    expect(q).toContain('账号定位');
    expect(q).toContain('0-1万粉');
    expect(q).toContain('本地探店');
    // profileInfo 是长正文，必须被跳过
    expect(q).not.toContain('输出要求');
  });

  it('选题策划：保留用户选择项，剔除长补充说明', () => {
    const q = buildSearchQuery(
      '选题策划',
      {
        taskType: '选题策划',
        tracks: '美食',
        contentTypes: '探店',
        explosiveElements: '反差、怀旧',
        positioningExtra: '这是一段很长的账号定位补充说明'.repeat(20),
      },
      '我需要策划短视频选题'
    );
    expect(q).toContain('八大爆款元素');
    expect(q).toContain('美食');
    expect(q).toContain('探店');
    expect(q).not.toContain('账号定位补充说明');
  });

  it('前端拼好完整 query 的页面：回退到取开头一段', () => {
    const full = '请为以下脚本生成专业分镜脚本\n## 原始脚本\n' + 'x'.repeat(3000);
    const q = buildSearchQuery('分镜脚本', { taskType: '分镜脚本', query: full }, full);
    expect(q.length).toBeLessThanOrEqual(200);
    expect(q).toContain('分镜脚本');
    expect(q).toContain('景别');
  });

  it('知识库查询/自由对话：直接用用户原始提问', () => {
    const q = buildSearchQuery('知识库查询', { taskType: '知识库查询' }, '如何设计开头3秒的强冲突？');
    expect(q).toContain('如何设计开头3秒的强冲突');
  });

  it('展开嵌套的 inputs（topic 页的传参结构）', () => {
    const q = buildSearchQuery(
      '选题策划',
      { taskType: '选题策划', inputs: { platforms: '抖音', styles: '幽默' } },
      '选题'
    );
    expect(q).toContain('抖音');
    expect(q).toContain('幽默');
  });

  it('空输入也不会产生空查询（否则检索节点会拿到空串）', () => {
    expect(buildSearchQuery('', {}, '')).toBe('短视频编导');
    expect(buildSearchQuery('未知任务', {}, '  ')).toBe('短视频编导');
  });

  it('始终不超过 200 字符', () => {
    const body: Record<string, string> = {};
    for (let i = 0; i < 50; i++) body['f' + i] = '选项' + i;
    const q = buildSearchQuery('脚本生成', body, 'x');
    expect(q.length).toBeLessThanOrEqual(200);
  });
});
