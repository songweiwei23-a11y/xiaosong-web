/**
 * 自动质检（2026-10-03）：查的都是这周线上真出过的事——踩禁忌、用了排除的信息、配比对不上、年限和事实卡打架
 */
import { describe, it, expect } from 'vitest';
import { runQualityChecks, yearConflicts, sanitizeQualityReport, summarizeQuality, outputKey, type QualityRow } from '@/lib/quality-checks';
import { resolveMix } from '@/lib/content-mix';
import { regressionCases, runRegression, REGRESSION_PROFILE } from '@/lib/quality-regression';
import { readCode } from './helpers/source';

const persona = { yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年' };
const profile = {
  id: 'p', profile_name: '锦园地摊', account_track: ['美食烹饪'], persona_facts: persona,
  taboo_settings: { excluded: ['公益营销：给贫困户送米面油', '直播规划：挂小房子小风车'] },
};

describe('年限和事实卡打架', () => {
  it('「在南乐扎根 18 年」「18 年了」「18 年的老店」都算；事实卡里有的 9 年、半年不算', () => {
    const out = '在南乐扎根18年的四川师傅\n18年了，这个味道没变\n一家十八年的老店\n做川菜9年，来南乐半年';
    const c = yearConflicts(out, persona);
    expect(c.length).toBe(3);
    expect(c.join('|')).not.toMatch(/9年|半年/);
  });

  it('不误报：年份、"一年四季"、和在本地多久无关的年', () => {
    expect(yearConflicts('2026 年国庆，一年四季都能来，3 年级的小朋友也爱吃', persona)).toEqual([]);
  });

  it('没填事实卡：不查', () => {
    expect(yearConflicts('在南乐扎根18年', null)).toEqual([]);
  });
});

describe('一次体检', () => {
  it('四类问题都能查出来', () => {
    const topics = ['## 选题1：A\n**0️⃣ 视频目的**\n变现型', '## 选题2：B\n**0️⃣ 视频目的**\n变现型'].join('\n\n');
    const output = `${topics}\n我们是全城最正宗的串串\n周末给贫困户送米面油\n在南乐扎根18年`;
    const r = runQualityChecks({ output, profile, mix: { resolved: resolveMix({ account_stage: '刚起号，定位未确定' }), count: 2 } });
    expect(r.passed).toBe(false);
    expect(new Set(r.issues.map((i) => i.kind))).toEqual(new Set(['taboo', 'excluded', 'mix', 'years']));
  });

  it('干净的结果通过；在列禁忌、说"这次不做公益"的行不算', () => {
    const r = runQualityChecks({ output: '一元火锅怎么吃最值？\n不要说"全城最正宗"\n这次不做公益相关的内容\n做川菜9年，来南乐半年', profile });
    expect(r).toEqual({ passed: true, issues: [] });
  });

  it('同一份结果的键稳定，内容不同键不同', () => {
    expect(outputKey('甲乙')).toBe(outputKey('甲乙'));
    expect(outputKey('甲乙')).not.toBe(outputKey('甲丙'));
  });
});

describe('上报和汇总', () => {
  it('上报数据校验：乱的种类丢掉、截断、没板块名不收；通过与否由问题条数决定（不信浏览器说的）', () => {
    expect(sanitizeQualityReport({ issues: [] })).toBeNull();
    const row = sanitizeQualityReport({ taskType: '选题策划', passed: true, profileId: 'x', issues: [{ kind: 'taboo', detail: 'a'.repeat(500) }, { kind: '乱写', detail: 'b' }], sample: 's'.repeat(999) })!;
    expect(row.passed).toBe(false);
    expect(row.issues).toHaveLength(1);
    expect(row.issues[0].detail).toHaveLength(200);
    expect(row.sample).toHaveLength(300);
    expect(row.profile_id).toBeNull();
  });

  it('汇总：通过率、板块排行、问题排行、最近一次回归', () => {
    const rows: QualityRow[] = [
      { task_type: '选题策划', source: 'live', passed: false, issues: [{ kind: 'taboo', detail: 'x' }, { kind: 'taboo', detail: 'y' }], created_at: '2026-10-03T01:00:00Z' },
      { task_type: '选题策划', source: 'live', passed: true, issues: [], created_at: '2026-10-03T02:00:00Z' },
      { task_type: '脚本生成', source: 'live', passed: true, issues: [], created_at: '2026-10-03T03:00:00Z' },
      { task_type: '回归:创作方向', source: 'nightly', passed: true, issues: [], created_at: '2026-10-03T19:00:00Z' },
      { task_type: '回归:创作方向', source: 'nightly', passed: false, issues: [], created_at: '2026-10-02T19:00:00Z' },
    ];
    const s = summarizeQuality(rows);
    expect(s.total).toBe(3);
    expect(s.passRate).toBe(66.7);
    expect(s.byTask[0]).toEqual({ task: '选题策划', total: 2, failed: 1 });
    expect(s.byKind).toEqual([{ kind: 'taboo', label: '踩禁忌', count: 1 }]); // 同一条里两个禁忌只算一次
    expect(s.nightly).toHaveLength(1);
  });
});

describe('每晚回归', () => {
  it('测试档案把这周的坑都埋进去了：事实卡半年、排除公益直播、审稿原稿写 18 年和全城最正宗', () => {
    const cases = regressionCases();
    expect(cases.map((c) => c.task)).toEqual(['回归:创作方向', '回归:审稿优化', '回归:画布改写']);
    expect(cases[0].query).toContain('人设事实卡');
    expect(cases[0].query).toContain('刻意去掉的信息');
    expect(cases[0].query).toContain('流量型 3 个');
    expect(cases[1].query).toContain('全城最正宗');
    expect(cases[1].query).toContain('18 年');
    expect(cases[2].query).toContain('只换说法，不加事实');
  });

  it('跑完每个用例都体检；审稿只查优化后的稿子；出错的记成没跑成', async () => {
    let n = 0;
    const out = await runRegression(async () => {
      n++;
      if (n === 1) return '### 方向1：A\n- **视频目的**：流量型\n### 方向2：B\n- **视频目的**：流量型\n### 方向3：C\n- **视频目的**：流量型\n### 方向4：D\n- **视频目的**：人设型\n### 方向5：E\n- **视频目的**：变现型';
      if (n === 2) return '### 3. 问题清单\n原稿写「全城最正宗」「在南乐干了 18 年」\n### 4. 优化后的完整脚本\n我是成都来的老王，做川菜 9 年，来南乐半年。\n### 5. 纯文字文案\n…';
      throw new Error('超时');
    });
    expect(out[0].result.passed).toBe(true);
    expect(out[1].result.passed).toBe(true); // 问题清单里引用原稿的话不算
    expect(out[2].error).toBe('超时');
    expect(REGRESSION_PROFILE.persona_facts).toBeTruthy();
  });

  it('回归接口：定时任务暗号（不少于 16 位、等长比较）或管理员才能触发', () => {
    const route = readCode('app/api/admin/quality/regression/route.ts');
    expect(route).toMatch(/secret\.length < 16/);
    expect(route).toMatch(/timingSafeEqual/);
    expect(route).toMatch(/!cronAuthorized\(request\) && !\(await requireAdmin\(\)\)/);
  });
});

describe('接线', () => {
  it('所有结果面板生成完体检；按配比的两个板块带上配比；自由对话每轮也体检', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/generatingBefore\.current && !isGenerating && body/);
    expect(panel).toMatch(/reportQuality\(\{ taskType: CREATION_SOURCES\[seg\]/);
    for (const f of ['app/dashboard/topic/page.tsx', 'app/dashboard/direction/page.tsx']) expect(readCode(f), f).toContain('qualityMix={mixUsed}');
    expect(readCode('app/dashboard/free-chat/page.tsx')).toMatch(/reportQuality\(\{ taskType: '自由对话'/);
  });

  it('后台有质检看板入口；上报接口要登录、记不上不报错', () => {
    expect(readCode('app/admin/layout.tsx')).toContain('/admin/quality');
    const api = readCode('app/api/quality-checks/route.ts');
    expect(api).toMatch(/requireUser\(\)/);
    expect(api).toMatch(/source: 'live'/);
    expect(readCode('supabase/migrations/20261003_quality_checks.sql')).toMatch(/create table if not exists public\.quality_checks/);
  });
});
