import { describe, expect, it } from 'vitest';
import { profileConsistencyIssues, specificCategories } from '@/lib/profile-consistency';

/** 川菜那份档案的形状：经营三个具体品类，主题栏还写着「两个核心」 */
const chuanCai = {
  product_category: ['餐饮', '川味串串火锅', '川味烧烤', '川菜'],
  account_track: ['美食烹饪', '本地服务', '川味烧烤', '川味串串火锅', '川菜'],
};

describe('档案一致性提示（整改 B3）', () => {
  it('具体品类：去掉大类「餐饮」「本地服务」，赛道里的自定义值也算', () => {
    expect(specificCategories(chuanCai)).toEqual(['川味串串火锅', '川味烧烤', '川菜']);
  });

  it('选题方向写「两个核心」，但经营了三个品类：提示，并指出是哪一栏', () => {
    const issues = profileConsistencyIssues({ ...chuanCai, content_themes: '以川味串串火锅和川味烧烤两个核心为主' });
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe('content_themes');
    expect(issues[0].message).toContain('两个核心');
    expect(issues[0].message).toContain('3 个');
  });

  it('写的数字和品类数量对得上：不提示', () => {
    const issues = profileConsistencyIssues({ ...chuanCai, content_themes: '以三个品类为核心，串串、烧烤、川菜' });
    expect(issues).toEqual([]);
  });

  it('只经营一个品类时不做数量核对（那时「两个核心」本身就是另一类问题，不在这条规则里）', () => {
    const issues = profileConsistencyIssues({ product_category: ['川味烧烤'], account_track: [], content_themes: '两个核心' });
    expect(issues).toEqual([]);
  });

  it('同一份经历里出现了几个不同的年数：提醒核对', () => {
    const issues = profileConsistencyIssues({ interview_highlights: '在杭州开了9年美甲店，之前做过3年学徒' });
    expect(issues.map((i) => i.key)).toEqual(['interview_highlights']);
    expect(issues[0].message).toContain('3、9 年');
  });

  it('只有一个年数：不提示；日期（2026年）不算年限', () => {
    expect(profileConsistencyIssues({ interview_highlights: '2026年开始做账号，开了9年店' })).toEqual([]);
  });

  it('没有档案：不提示', () => {
    expect(profileConsistencyIssues(null)).toEqual([]);
  });
});
