import { afterEach, describe, expect, it, vi } from 'vitest';
import { splitRemixPlans } from '@/lib/remix-plans';
import { buildCreationHandoff, CREATION_DESTINATIONS, creationScript } from '@/lib/creation-flow';
import { hasPendingHandoff, putHandoff, takeHandoff } from '@/lib/handoff';
import { buildTitlePrompt } from '@/lib/title-standards';
import { creationReference, originForResult, continuationRules } from '@/lib/creation-continuation';

afterEach(() => vi.unstubAllGlobals());

describe('二创各方案继续创作', () => {
  it.each([1, 2, 3, 5, 8])('%i 个方案都可分别带入正文，不夹带其他方案', count => {
    const markdown = '创作建议\n\n' + Array.from({ length: count }, (_, i) => `### 方案 ${i + 1}：创意${i + 1}\n#### 口播全文\n独有内容-${i + 1}\n#### 分镜\n| 镜头 | 文案 |\n| 1 | 真实细节${i + 1} |`).join('\n\n---\n\n');
    const parsed = splitRemixPlans(markdown);
    expect(parsed.intro).toBe('创作建议');
    expect(parsed.plans).toHaveLength(count);
    for (const [i, plan] of parsed.plans.entries()) {
      for (const destination of CREATION_DESTINATIONS) {
        const payload = buildCreationHandoff('remix', destination.id, plan.body, { title: plan.title });
        expect(payload.sourceContent).toContain(`独有内容-${i + 1}`);
        expect(payload.sourceContent?.match(/独有内容-/g)).toHaveLength(1);
        expect(payload.target).toBe(`/dashboard/${destination.id}`);
        if (['review', 'storyboard'].includes(destination.id)) expect(payload.scriptContent).toBe(`独有内容-${i + 1}`);
        if (destination.id === 'title') expect(payload.scriptContent).toBe(plan.body);
        if (destination.id === 'script') expect(payload.note).toContain(plan.body);
        if (destination.id === 'remix') expect(payload.remixSource?.text).toBe(plan.body);
      }
    }
  });
  it('兼容中文序号、加粗标题、括号和表情，不把正文中的分镜序号或示例切成方案', () => {
    const parsed = splitRemixPlans('**方案一（暖心版）**\n口播甲\n```markdown\n### 方案 9：示例\n```\n| 方案2 | 镜头 |\n**🎬 方案二：反差版**\n口播乙');
    expect(parsed.plans).toHaveLength(2);
    expect(parsed.plans[0].body).toContain('方案 9：示例');
    expect(parsed.plans[1].body).toContain('口播乙');
    expect(parsed.plans[1].body).not.toContain('口播甲');
  });
  it('单份旧记录没有标准标题时仍提供继续创作，空记录没有方案', () => {
    expect(splitRemixPlans('旧口播全文').plans[0].body).toBe('旧口播全文');
    expect(splitRemixPlans('  ').plans).toEqual([]);
  });
  it('最后一份方案不夹带整批推荐和其他方案的信息', () => {
    const parsed = splitRemixPlans('### 方案1：甲\n全文甲\n### 方案2：乙\n#### 口播\n全文乙\n## 我推荐先拍哪个\n推荐方案1，随后方案2');
    expect(parsed.plans[1].body).toBe('### 方案2：乙\n#### 口播\n全文乙');
    expect(parsed.footer).toContain('推荐方案1');
  });
  it('审稿和分镜使用正文；迁移表、审稿意见留作参考，缺少正文栏目时完整保留', () => {
    expect(creationScript('remix', '### 方案1：甲\n#### 口播全文\n真实口播\n#### 分镜\n拍摄说明')).toBe('真实口播');
    expect(creationScript('review', '### 3. 问题清单\n修改意见\n### 4. 优化后的完整脚本\n优化正文\n### 5. 注意\n备注')).toBe('优化正文');
    expect(creationScript('review', '审稿结果没有正文栏目')).toBe('审稿结果没有正文栏目');
  });
  it('整批流转仍保留全部方案，作品的后续阶段保留关联，新选题不复用旧作品', () => {
    const body = '### 方案 1：甲\n#### 口播全文\n全文甲\n#### 分镜\n分镜甲\n### 方案 2：乙\n#### 口播全文\n全文乙\n#### 分镜\n分镜乙';
    expect(buildCreationHandoff('remix', 'review', body).scriptContent).toBe(body);
    expect(buildCreationHandoff('remix', 'storyboard', body).scriptContent).toBe(body);
    expect(buildCreationHandoff('script', 'storyboard', body, { workId: 'work-a' }).workId).toBe('work-a');
    expect(buildCreationHandoff('review', 'topic', body, { workId: 'work-a' }).workId).toBeUndefined();
  });
  it('从不同方案去开篇设计，现有开头取自该方案的口播，不取迁移说明', () => {
    const body = '### 方案 2：甲\n**一句话**：迁移方法说明\n#### 口播全文\n今天的牛肉到店了。先看纹路。\n#### 分镜\n镜头说明';
    const handed = buildCreationHandoff('remix', 'growth', body);
    expect(handed.currentOpening).toBe('今天的牛肉到店了。先看纹路。');
    expect(handed.sourceContent).toBe(body);
  });
  it('标题生成实际使用带入的正文，主题之外的真实细节不会丢失', () => {
    const prompt = buildTitlePrompt({ topic: '火锅', sourceContent: '店里每天上午现切牛肉', titleTypeLabel: '悬念式', titleFormulaValue: '', titleFormulaLabel: '', keywordStrategyLabel: '', keywordStrategyDesc: '', platform: '抖音', targetAudience: '', count: 3 });
    expect(prompt).toContain('店里每天上午现切牛肉');
    expect(prompt).toContain('不夸大或编造事实');
    expect(prompt).toContain('没有已确认数字时');
    expect(prompt).toContain('X串、XX元');
  });
  it('方案经过标题、脚本、审稿再分镜仍保留原始方案和当前版本，分镜只用最新优化稿', () => {
    const original = '### 方案1：备菜\n#### 口播全文\n店里今天切了X串牛肉，数量待核实。\n#### 创意\n一串串数清楚';
    const title = buildCreationHandoff('remix', 'title', original);
    expect(creationReference(title)).toBe(original);
    const script = buildCreationHandoff('title', 'script', '### 标题：今天数给你看', { originContent: title.originContent });
    expect(script.note).toContain(original);
    expect(script.note).toContain('今天数给你看');
    expect(script.note).toContain('【原始创作方案】');
    const review = buildCreationHandoff('script', 'review', '当前脚本正文', { originContent: script.originContent });
    const shots = buildCreationHandoff('review', 'storyboard', '### 优化后的完整脚本\n优化后的当前台词\n### 修改说明\n强化开头', { originContent: review.originContent });
    expect(shots.originContent).toBe(original);
    expect(shots.scriptContent).toBe('优化后的当前台词');
    expect(creationReference(shots)).toContain(original);
    expect(creationReference(shots)).toContain('强化开头');
  });
  it('刷新后和切换历史时使用该版本的根稿，不把正在编辑的其他方案带过去', () => {
    const history = [{ result: '标题A', input_data: { originContent: '原始方案A' } }, { result: '旧稿', input_data: { sourceReference: '旧方案B' } }, { result: '没有来源的旧稿' }];
    expect(originForResult('标题A', history, '正在编辑C')).toBe('原始方案A');
    expect(originForResult('旧稿', history, '正在编辑C')).toBe('旧方案B');
    expect(originForResult('没有来源的旧稿', history, '正在编辑C')).toBe('');
    expect(originForResult('刚生成C', history, '原始方案C')).toBe('原始方案C');
  });
  it('各板块按具体任务承接原文，待核实占位不能变成真实数字', () => {
    for (const task of ['review', 'storyboard', 'topic', 'script', 'title', 'growth', 'free-chat'] as const) {
      expect(continuationRules(task)).toContain('X串、XX元');
      expect(continuationRules(task)).toContain('不是已核实事实');
    }
    expect(continuationRules('storyboard')).toContain('台词不要改写');
    expect(continuationRules('topic')).toContain('承接了原方案的哪个点');
  });
});

describe('交接保护', () => {
  function browser(profile = 'profile-a', pathname = '/dashboard/review') {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) };
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('localStorage', { getItem: () => profile });
    vi.stubGlobal('window', { location: { pathname } });
    return storage;
  }
  it('只有指定目标页能接收一次，其他页面不能提前消费', () => {
    browser('profile-a', '/dashboard/title');
    expect(putHandoff({ from: '跨行业二创', target: '/dashboard/review', scriptContent: '唯一方案' })).toBe(true);
    expect(hasPendingHandoff()).toBe(false);
    // Next 客户端导航已渲染目标组件、地址栏还未切换时也能保护新稿。
    expect(hasPendingHandoff('/dashboard/review')).toBe(true);
    expect(takeHandoff()).toBeNull();
    vi.stubGlobal('window', { location: { pathname: '/dashboard/review' } });
    expect(hasPendingHandoff()).toBe(true);
    expect(takeHandoff()?.scriptContent).toBe('唯一方案');
    expect(takeHandoff()).toBeNull();
  });
  it('换档案后不把前一个档案内容带入', () => {
    browser();
    putHandoff({ from: '二创', target: '/dashboard/review', scriptContent: '档案A内容' });
    vi.stubGlobal('localStorage', { getItem: () => 'profile-b' });
    expect(hasPendingHandoff()).toBe(false);
    expect(takeHandoff()).toBeNull();
  });
  it('存储写入失败向调用方报告，旧版无目标交接仍可接收', () => {
    const storage = browser();
    storage.setItem('xiaosong-handoff', JSON.stringify({ from: '脚本生成', scriptContent: '旧版交接' }));
    expect(takeHandoff()?.scriptContent).toBe('旧版交接');
    vi.stubGlobal('sessionStorage', { setItem: () => { throw new Error('quota'); } });
    expect(putHandoff({ from: '二创', sourceContent: '正文' })).toBe(false);
  });
});
