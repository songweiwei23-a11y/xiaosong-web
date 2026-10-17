import { describe, expect, it } from 'vitest';
import { scanTaboos } from '@/lib/taboos';
import { runQualityChecks } from '@/lib/quality-checks';

/**
 * 整改 A4：夜间质检回归抓到的问题，用户在结果页上也必须看得见。
 *
 * 结果页用的是两个组件：
 *   - TabooScan：直接调 scanTaboos（违禁词、标出原句、给替换写法）
 *   - FactCheckNotice：调 runQualityChecks，只显示 facts / years 两类（「这几处请核对」）
 * 夜间回归用的是同一个 runQualityChecks。这里把回归里出现过的几类问题各喂一遍，
 * 确认两个用户侧的入口都能抓到——抓不到的话，用户看到的结果页就比后台看板「干净」，那是假的安心。
 */

describe('夜间回归抓到的问题，用户侧也能看到（整改 A4）', () => {
  it('广告法绝对化词「最划算」：违禁词扫描命中，结果页会标出原句', () => {
    const hits = scanTaboos('这一锅吃完了跟我说，真的最划算', { profile_name: '测试号' });
    expect(hits.map((h) => h.word)).toContain('最划算');
  });

  it('广告法绝对化词「唯一」：违禁词扫描命中', () => {
    const hits = scanTaboos('全城唯一一家用现切牛肉的串串店', null);
    expect(hits.map((h) => h.word)).toContain('唯一');
  });

  it('档案里没有的价格（88元）：事实核对命中，「这几处请核对」会显示', () => {
    const r = runQualityChecks({
      output: '美甲单色 88 元，晕染 188 元，放进选题里。',
      profile: { profile_name: '测试号', price_range: '' },
      taskType: '脚本生成',
      source: '',
    });
    const facts = r.issues.filter((i) => i.kind === 'facts');
    expect(facts.length).toBeGreaterThan(0);
  });

  it('同一段输出里的违禁词和编造价格，质检结果里两类都在', () => {
    const r = runQualityChecks({
      output: '一元火锅人均 88 元，吃完了跟我说，最划算。',
      profile: { profile_name: '测试号' },
      taskType: '脚本生成',
      source: '',
    });
    expect(r.issues.some((i) => i.kind === 'taboo')).toBe(true);
    expect(r.issues.some((i) => i.kind === 'facts')).toBe(true);
  });

  it('档案和素材里本来就有的价格，不误报', () => {
    const r = runQualityChecks({
      output: '一元串串，今天的价格是 68 元。',
      profile: { profile_name: '测试号', price_range: '68元' },
      taskType: '脚本生成',
      source: '',
    });
    expect(r.issues.filter((i) => i.kind === 'facts' && /68/.test(i.detail))).toEqual([]);
  });
});
