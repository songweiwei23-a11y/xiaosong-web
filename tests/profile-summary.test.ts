import { describe, it, expect } from 'vitest';
import {
  buildProfileSummary,
  businessLines,
  BUSINESS_LINES_LABEL,
  PROFILE_SUMMARY_FIELDS,
  PROFILE_SUMMARY_EXCLUDED,
} from '@/lib/profile-summary';
import { EMPTY_PROFILE } from '@/components/profile/ProfileForm';
import { readCode } from './helpers/source';
import { buildPositioningPrompt } from '@/lib/positioning-standards';

/**
 * 定位用的档案摘要。
 *
 * 【线上的毛病】账号定位页自己拼摘要，漏了「数据最好的内容类型」等六七栏。
 * 提示词说"主打内容看数据最好的内容类型"，模型却从没见过这一栏——
 * 档案里填的是"讲故事、拍工作过程"，定位给的是"教知识 60%"。
 */

describe('档案摘要', () => {
  it('表单里每一栏都进摘要，或者写明了为什么不进', () => {
    const covered = new Set([
      ...PROFILE_SUMMARY_FIELDS.map(([k]) => k),
      ...Object.keys(PROFILE_SUMMARY_EXCLUDED),
    ]);
    const keys = Object.keys(EMPTY_PROFILE);
    // 扫描自证不空转：表单字段少于 30 个说明读错了东西
    expect(keys.length).toBeGreaterThanOrEqual(30);
    const missing = keys.filter((k) => !covered.has(k));
    expect(missing, `这些档案字段既没进摘要、也没说明为什么不进：${missing.join('、')}`).toEqual([]);
  });

  it('定主打内容要用的几栏都在', () => {
    const s = buildProfileSummary({
      profile_name: '实体获客编导',
      viral_content_pattern: '讲故事 / 讲经历的、拍工作过程的',
      content_tone: '幽默搞笑式',
      target_region: ['本地同城', '南乐县'],
      fan_common_questions: '多少钱',
      conversion_barriers: ['不相信是真的'],
    });
    expect(s).toContain('- 数据最好的内容类型（定主打内容的首要依据）：讲故事 / 讲经历的、拍工作过程的');
    expect(s).toContain('- 语言风格：幽默搞笑式');
    expect(s).toContain('- 地域：本地同城、南乐县');
    expect(s).toContain('- 客人常问：多少钱');
    expect(s).toContain('- 成交障碍：不相信是真的');
  });

  it('空栏不写，免得一堆"未设置"', () => {
    const s = buildProfileSummary({ profile_name: 'x', content_tone: '', equipment: [] });
    expect(s).toBe('- 档案名称：x');
  });

  it('账号定位、商业定位、内容定位用的是同一份', () => {
    expect(readCode('app/dashboard/positioning/page.tsx')).toMatch(
      /const buildProfileSummary = \(\) => \(activeProfile \? summarizeProfile\(activeProfile\) : ''\)/
    );
    expect(readCode('components/positioning/DeepDivePage.tsx')).toMatch(
      /const profileSummary = \(p: Profile\) => buildProfileSummary\(p\)/
    );
  });

  it('单节重写也带上用户定的方向', () => {
    expect(readCode('app/dashboard/positioning/page.tsx')).toMatch(/userDirection=\{additionalNotes \|\| undefined\}/);
    expect(readCode('components/positioning/SectionEditor.tsx')).toMatch(/profileSummary,\s*userDirection,\s*\}\)/);
  });
});

describe('赛道、地域进检索词（联网搜索才搜得到这个号相关的东西）', () => {
  it('从档案取出短字段，buildSearchQuery 会把它们拼进检索词', async () => {
    const { profileSearchHints } = await import('@/lib/profile-summary');
    const { buildSearchQuery } = await import('@/lib/search-query');
    const hints = profileSearchHints({ account_track: ['短视频代运营', '短视频博主'], target_region: ['本地同城', '南乐县'] });
    expect(hints).toEqual({ track: '短视频代运营、短视频博主', region: '本地同城、南乐县' });
    const q = buildSearchQuery('账号定位', { taskType: '账号定位', query: '长提示词', ...hints }, '长提示词');
    expect(q).toContain('短视频代运营');
    expect(q).toContain('南乐县');
    expect(profileSearchHints(null)).toEqual({});
  });

  it('账号定位、深挖、起号三处请求都带上', () => {
    expect(readCode('app/dashboard/positioning/page.tsx')).toMatch(/\.\.\.profileSearchHints\(activeProfile\)/);
    expect(readCode('components/positioning/DeepDivePage.tsx')).toMatch(/\.\.\.profileSearchHints\(profile\)/);
    expect(readCode('app/dashboard/growth/page.tsx').match(/\.\.\.profileSearchHints\(context\.profile\)/g)?.length).toBe(2);
  });
});

/**
 * 经营品类：2026-09-29 线上，档案经营川味串串火锅、川味烧烤、川菜三类，
 * 定位一句话写成"川菜厨子，主打川味烧烤+一元串串火锅"——川菜被当成厨师身份，作为品类丢了。
 * 下面的档案值就是线上那份的原样（只取相关几栏）。
 */
describe('经营品类单列一行，定位里当硬约束', () => {
  const live = {
    profile_name: '锦园地摊串串一元火锅',
    account_track: ['美食烹饪', '本地服务', '川味烧烤', '川味串串火锅', '川菜'],
    product_category: ['餐饮'],
    content_themes: '以烧烤串串和一元火锅为核心',
  };

  it('从赛道、产品品类里取出具体品类，「餐饮」「美食烹饪」这种大类不算', () => {
    expect(businessLines(live)).toEqual(['川味烧烤', '川味串串火锅', '川菜']);
    expect(businessLines({ ...live, product_category: ['川菜', '餐饮', '冷饮'] })).toEqual(['川菜', '冷饮']);
    expect(businessLines({ account_track: '美食烹饪、川菜' })).toEqual(['川菜']);
    expect(businessLines({ account_track: ['美食烹饪'], product_category: ['餐饮'] })).toEqual([]);
  });

  it('摘要第二行就点名，名字下面紧跟着', () => {
    const lines = buildProfileSummary(live).split('\n');
    expect(lines[1]).toBe(`${BUSINESS_LINES_LABEL}川味烧烤、川味串串火锅、川菜`);
    expect(buildProfileSummary({ profile_name: 'x', account_track: ['美食烹饪'] })).not.toContain('经营品类');
  });

  it('定位提示词：有品类才加硬约束——要并列写全、不能拿"××厨子"顶替品类、交稿前对一遍', () => {
    const summary = buildProfileSummary(live);
    const prompt = buildPositioningPrompt({ profileSummary: summary });
    expect(prompt).toContain('### 🍽 经营品类（硬约束）');
    expect(prompt).toContain('这家店在卖：**川味烧烤、川味串串火锅、川菜**');
    expect(prompt).toMatch(/并列写全/);
    expect(prompt).toMatch(/不能拿它顶替一个品类/);
    expect(prompt).toMatch(/交稿前对一遍/);
    // 放在档案后面、方法论前面
    expect(prompt.indexOf('经营品类（硬约束）')).toBeGreaterThan(prompt.indexOf(summary.split('\n')[0]));
    expect(prompt.indexOf('经营品类（硬约束）')).toBeLessThan(prompt.indexOf('## 📚 判断依据'));
    expect(buildPositioningPrompt({ profileSummary: buildProfileSummary({ profile_name: 'x' }) })).not.toContain('经营品类（硬约束）');
    // 最末尾再逐个点名、要求一字不差（实测只讲一遍压不住：写成"川味馆""川菜师傅"，还把川味串串火锅拆成两样）
    const tail = prompt.slice(prompt.lastIndexOf('## ✅ 交稿前最后检查：经营品类'));
    expect(tail.length).toBeLessThan(600); // 真的在最后
    expect(tail).toContain('「川味烧烤」「川味串串火锅」「川菜」');
    expect(tail).toMatch(/原样出现、一字不差/);
    expect(tail).toMatch(/"××师傅""××厨子"不算写了"××"这个品类/);
    expect(buildPositioningPrompt({ profileSummary: buildProfileSummary({ profile_name: 'x' }) })).not.toContain('交稿前最后检查：经营品类');
    // 商业定位、内容定位用的是同一个函数
    for (const focus of ['business', 'content'] as const) {
      expect(buildPositioningPrompt({ profileSummary: summary, focus })).toContain('经营品类（硬约束）');
    }
  });
});
