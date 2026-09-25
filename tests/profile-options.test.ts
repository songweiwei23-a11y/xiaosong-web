import { describe, it, expect } from 'vitest';
import {
  OPTION_GROUPS,
  SELLING_POINTS,
  RESTRICTIONS,
  joinSelections,
  splitSelections,
  SCORED_FIELDS,
  SCORED_FIELD_LABELS,
  profileCompletion,
} from '@/lib/profile-options';
import { readCode } from './helpers/source';

/**
 * 生产库 17 份档案的填写率：选择题字段一律 47%，填空题 6%-41%。
 * 成交钩子那一栏只有 1 个人填过。把填空改成勾选，是为了让这些字段
 * 真的有人填——账号定位再会判断，也判断不了空白。
 *
 * 改造的硬性前提：**现有 17 份手写档案一个字都不能丢**。
 * 下面「老数据不丢」那一组就是卡这个的。
 */

describe('选项集本身', () => {
  it('每组都有字段名、标签和「为什么问这个」', () => {
    for (const g of OPTION_GROUPS) {
      expect(g.field, '缺字段名').toBeTruthy();
      expect(g.label, `${g.field} 缺标签`).toBeTruthy();
      // 不说明填了有什么用，用户就没动力填
      expect(g.why, `${g.field} 没说明为什么要问`).toBeTruthy();
      expect(g.options.length, `${g.field} 选项太少`).toBeGreaterThanOrEqual(5);
    }
  });

  it('选项不重复', () => {
    for (const g of OPTION_GROUPS) {
      const vals = g.options.map((o) => o.value);
      expect(new Set(vals).size, `${g.field} 有重复选项`).toBe(vals.length);
    }
  });

  it('选项文字里不能含分隔符，否则存取会被拆断', () => {
    /*
     * 这条是在浏览器里发现的：选项「怕被宰、价格不透明」勾上之后不高亮。
     * 因为多选是用顿号连起来存回 text 列的，选项自己带顿号，
     * 读回来时会被拆成两段，两段都对不上任何选项 —— 勾选状态就丢了。
     * 单测当时全绿，这种事只有真点一下才看得出来。
     */
    const bad: string[] = [];
    for (const g of OPTION_GROUPS) {
      for (const o of g.options) {
        if (/[、,，]/.test(o.value)) bad.push(`${g.field} → ${o.value}`);
      }
    }
    expect(bad, `这些选项含有分隔符，存取会被拆断：\n${bad.join('\n')}`).toEqual([]);
  });

  it('字段名不重复，一个字段只由一组负责', () => {
    const fields = OPTION_GROUPS.map((g) => g.field);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('覆盖了填写率最低的那几个字段', () => {
    const fields = OPTION_GROUPS.map((g) => g.field);
    // 这几个是实测填写率 12%-29% 的重灾区
    for (const f of [
      'conversion_barriers', 'content_restrictions', 'unique_resources',
      'competitive_weakness', 'viral_content_pattern', 'unique_selling_point',
      'fan_common_questions', 'content_value',
    ]) {
      expect(fields, `${f} 没被改成勾选`).toContain(f);
    }
  });

  it('不再问需要用户自己做分析的问题', () => {
    const fields = OPTION_GROUPS.map((g) => g.field);
    // 「市场上还有哪些空白机会点」是 AI 该干的活，反过来问用户等于把难题丢回去
    expect(fields).not.toContain('market_opportunity');
  });

  it('爆款基因改成了问事实，且新号有得选', () => {
    const g = OPTION_GROUPS.find((x) => x.field === 'viral_content_pattern')!;
    expect(g.label).toContain('已经发过');
    expect(g.options.some((o) => o.value.includes('还没发过'))).toBe(true);
  });

  it('禁忌把广告法红线放在第一条', () => {
    expect(RESTRICTIONS[0].value).toContain('绝对化用语');
    expect(RESTRICTIONS[0].hint).toContain('建议都勾上');
  });
});

describe('存取：多选存回原来的 text 列', () => {
  it('勾选项用顿号连起来，和库里手写的格式一致', () => {
    expect(joinSelections(['质量好', '专业强'])).toBe('质量好、专业强');
  });

  it('「其他」里写的内容会附在后面', () => {
    expect(joinSelections(['质量好'], '本地唯一一家')).toBe('质量好、本地唯一一家');
  });

  it('什么都没选就是空串，不会留下多余的顿号', () => {
    expect(joinSelections([])).toBe('');
    expect(joinSelections([], '   ')).toBe('');
  });
});

describe('老数据不丢——这是改造的硬性前提', () => {
  it('勾选出来的值能原样还原成勾选状态', () => {
    const r = splitSelections('质量好、专业强', SELLING_POINTS);
    expect(r.selected).toEqual(['质量好', '专业强']);
    expect(r.other).toBe('');
  });

  it('库里那种几百字的手写内容，原样留在「其他」里', () => {
    // 这是言山廷那份档案的真实写法
    const written = '1、肉品差异：坚持原切鲜切牛肉，拒绝合成调理冻肉；2、锅底差异化';
    const r = splitSelections(written, SELLING_POINTS);
    expect(r.selected).toEqual([]);
    // 一个字都不能丢
    expect(r.other).toContain('原切鲜切');
    expect(r.other).toContain('锅底差异化');
  });

  it('手写和勾选混在一起时，各归各位', () => {
    const r = splitSelections('质量好、我们家开了二十年', SELLING_POINTS);
    expect(r.selected).toEqual(['质量好']);
    expect(r.other).toBe('我们家开了二十年');
  });

  it('中英文逗号都能拆', () => {
    expect(splitSelections('质量好,专业强', SELLING_POINTS).selected).toEqual(['质量好', '专业强']);
    expect(splitSelections('质量好，服务好', SELLING_POINTS).selected).toEqual(['质量好', '服务好']);
  });

  it('空值不会炸', () => {
    for (const v of [null, undefined, '', '   ']) {
      const r = splitSelections(v, SELLING_POINTS);
      expect(r.selected).toEqual([]);
      expect(r.other).toBe('');
    }
  });

  it('存进去再读出来，内容不变', () => {
    for (const original of [
      '质量好、专业强、服务好',
      '效果好、我们是本地第一家做这个的',
      '完全是一段手写的说明文字，没有任何一项对得上选项',
    ]) {
      const r = splitSelections(original, SELLING_POINTS);
      const back = joinSelections(r.selected, r.other);
      expect(back, `「${original}」走一圈之后变了`).toBe(original);
    }
  });
});

describe('完整度按「对产出有用」来算', () => {
  it('计分字段里不包含系统字段', () => {
    for (const bad of ['id', 'user_id', 'created_at', 'is_active', 'banned_at', 'conversation_id']) {
      expect(SCORED_FIELDS as readonly string[]).not.toContain(bad);
    }
  });

  it('把改成勾选的字段都算进完整度', () => {
    for (const g of OPTION_GROUPS) {
      expect(SCORED_FIELDS as readonly string[], `${g.field} 没算进完整度`).toContain(g.field);
    }
  });

  it('每个计分字段都有给人看的叫法', () => {
    for (const f of SCORED_FIELDS) {
      expect(SCORED_FIELD_LABELS[f], f).toBeTruthy();
      // "还差哪几项"用顿号连，叫法里再带顿号就会被看成两项
      expect(SCORED_FIELD_LABELS[f], f).not.toMatch(/[、,，]/);
    }
  });

  it('按真实填写算：只差「职业标签」的档案是 96%，并说出差哪项', () => {
    const full = Object.fromEntries(SCORED_FIELDS.map((f) => [f, ['已填']]));
    const r = profileCompletion({ ...full, target_occupation: [], id: 'x', profile_name: '实体获客编导' });
    expect(r).toEqual({ percent: 96, filled: 25, total: 26, missing: ['职业标签'] });
    expect(profileCompletion(full).percent).toBe(100);
  });

  it('空字符串、空数组、全是空白的都算没填；什么都没填是 0', () => {
    const r = profileCompletion({ account_platform: [], account_track: ['  '], fans_level: '   ', profile_name: '只有名字' });
    expect(r.percent).toBe(0);
    expect(profileCompletion(null).percent).toBe(0);
  });

  it('全站只有这一份算法：侧边栏用它；不再数表里不存在的列、不再白送分', () => {
    const sidebar = readCode('app/dashboard/components/ProfileSwitcher.tsx');
    expect(sidebar).toMatch(/profileCompletion\(/);
    expect(sidebar).not.toMatch(/target_audience|content_category/);
    expect(readCode('lib/creator-context.ts')).toMatch(/return profileCompletion\(p\)\.percent/);
    // 那个 filled += 6 白送 60% 的组件已经删了，别再长出来
    for (const f of ['app/dashboard/components/ProfileSwitcher.tsx', 'lib/creator-context.ts', 'lib/profile-options.ts']) {
      expect(readCode(f), f).not.toMatch(/filled \+= \d/);
    }
  });

  it('保存档案后侧边栏会刷新', () => {
    expect(readCode('app/dashboard/components/ProfileSwitcher.tsx')).toMatch(/onActiveProfileChange\(handleProfileUpdate\)/);
    expect(readCode('app/dashboard/profiles/[id]/edit/page.tsx')).toMatch(/dispatchEvent\(new Event\('profileUpdated'\)\)/);
  });
});
