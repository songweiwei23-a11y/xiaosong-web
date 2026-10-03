import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import { BOARD_MANIFESTS, manifestOf, type Board } from '@/lib/context-manifest';
import { buildContextBlock, type CreatorContext, type CreatorProfile } from '@/lib/creator-context';
import { BRIEF_FIELDS } from '@/lib/creative-brief';

/**
 * 这一组是审计出来的。当时实测各板块到底拿到了什么：
 *
 *   分镜/审稿/标题  走 useCreatorContext，拿到简报 4/4，注入 389-444 字   ✓
 *   选题            页面自己拼 ctx，漏了 brief，简报字段 1/4，却注入 2251 字
 *   脚本            同上，简报字段 1/7，注入 2299 字
 *   成交理由/自由对话/知识库   完全没接
 *
 * **注入最多的两个板块，有用的最少**——塞的是截断的定位原文。
 * 根因是"每个板块该拿什么"散落在各页面里，没有单一出处。
 *
 * 所以：清单收到 lib/context-manifest，这里逐板块核对。
 * 少接一个字段就会红，不用等下次人工审计。
 */

const PROFILE: CreatorProfile = {
  id: 'p1',
  profile_name: '实体获客编导-不一',
  account_platform: ['抖音'],
  account_track: ['短视频代运营'],
  account_stage: '刚起号',
  fans_level: '0-1万',
  content_format: ['口播'],
  target_age: ['25-30岁'],
  target_occupation: ['企业主'],
  target_pain_points: '被同行坑过、怕效果达不到预期',
  target_needs: '要明确的效果',
  fan_common_questions: '多少钱怎么收费',
  content_tone: '幽默搞笑式',
  content_style: ['接地气'],
  unique_selling_point: '效果好、服务好',
  content_value: '让人产生信任',
  conversion_hooks: '先干出效果再谈钱',
  conversion_path: '看视频→私信→到店',
  conversion_barriers: '不相信是真的',
  monetization_model: ['线下服务'],
  price_range: ['500元以上'],
  content_themes: '客户真实店况',
  viral_content_pattern: '讲故事、拍工作过程',
  competitive_advantage: '濮阳本土化',
  content_restrictions: '绝对化用语、不诋毁同行',
  equipment: ['手机', '灯光'],
  team_structure: '一人全包',
  shooting_location: ['家'],
  editing_capability: '基础剪辑',
  budget_per_video: '0-500元',
};

/** 每个简报字段放一句独特的话，便于断言它到底有没有进来 */
const BRIEF = BRIEF_FIELDS.map(
  (f, i) => `### ${i + 1}. ${f.label}\n\n【${f.key}到位】这一段的内容`
).join('\n\n');

const ctx = (over: Partial<CreatorContext> = {}): CreatorContext => ({
  profile: PROFILE,
  positioning: null,
  dealReasons: ['专业强', '实在不坑'],
  brief: BRIEF,
  ...over,
});

describe('起号板块用自己的清单，不借脚本的', () => {
  it('能看到拍摄条件和爆款基因——起号就是按这些挑打法的', () => {
    const block = buildContextBlock(ctx({ brief: null }), 'growth');
    expect(block).toMatch(/可用设备|团队规模/);
    expect(block).toMatch(/爆款基因/);
  });

  it('起号页两处（推荐候选、完整方案）都用 growth 清单', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/growth/page.tsx'), 'utf8');
    expect(page.match(/buildContextBlock\(context, 'growth'\)/g)?.length).toBe(2);
    expect(page.match(/contentPlan,\s*restrictions,\s*notes: planNotes,/g)?.length).toBe(2);
  });
});

describe('清单本身立得住', () => {
  it('每个板块都写清楚了它在干什么', () => {
    for (const m of BOARD_MANIFESTS) {
      expect(m.job, `${m.label} 没说明它要信息干什么`).toBeTruthy();
      expect(m.profile.length + m.brief.length, `${m.label} 什么都不要？`).toBeGreaterThan(0);
    }
  });

  it('board 不重复', () => {
    const b = BOARD_MANIFESTS.map((m) => m.board);
    expect(new Set(b).size).toBe(b.length);
  });

  it('所有产出内容的板块都带上硬禁忌', () => {
    // 漏一条可能直接产出违规文案，这是不能省的
    for (const m of BOARD_MANIFESTS) {
      expect(m.profile, `${m.label} 没带档案里的禁忌`).toContain('restrictions');
      expect(m.brief, `${m.label} 没带简报里的禁忌`).toContain('forbidden');
    }
  });
});

describe('每个板块都真的拿到了清单里声明的东西', () => {
  for (const m of BOARD_MANIFESTS) {
    it(`${m.label} 拿到全部 ${m.brief.length} 个简报字段`, () => {
      const block = buildContextBlock(ctx(), m.board);
      const missing = m.brief.filter((k) => !block.includes(`【${k}到位】`));
      expect(missing, `${m.label} 缺：${missing.join('、')}`).toEqual([]);
    });

    it(`${m.label} 不会拿到它不需要的简报字段`, () => {
      // 多塞无关信息会稀释指令，而且每次生成都要为这些 token 付钱
      const block = buildContextBlock(ctx(), m.board);
      const extra = BRIEF_FIELDS.map((f) => f.key)
        .filter((k) => !m.brief.includes(k))
        .filter((k) => block.includes(`【${k}到位】`));
      expect(extra, `${m.label} 多拿了：${extra.join('、')}`).toEqual([]);
    });
  }
});

describe('档案切片也按清单来', () => {
  const probes: Record<string, RegExp> = {
    shooting: /可用设备|团队规模/,
    monetize: /变现方式|成交路径/,
    viral: /爆款基因|差异化优势/,
    tone: /说话语气/,
    selling: /核心卖点/,
    audience: /真实痛点|粉丝常问/,
  };

  for (const m of BOARD_MANIFESTS) {
    it(`${m.label} 的档案切片对得上`, () => {
      const block = buildContextBlock(ctx({ brief: null }), m.board);
      for (const [slice, re] of Object.entries(probes)) {
        const want = m.profile.includes(slice as never);
        const got = re.test(block);
        expect(got, `${m.label} 的 ${slice}：清单说${want ? '要' : '不要'}，实际${got ? '有' : '没有'}`).toBe(want);
      }
    });
  }
});

describe('有简报就不再塞截断的定位原文', () => {
  const LONG = '定位原文'.repeat(1000);

  for (const m of BOARD_MANIFESTS) {
    it(`${m.label} 有简报时不出现定位原文`, () => {
      const block = buildContextBlock(
        ctx({ positioning: { name: 'n', summary: LONG, full: LONG } }),
        m.board
      );
      expect(block).not.toContain('定位原文');
    });
  }

  it('没有简报时才退回定位，并提示可以生成简报', () => {
    const block = buildContextBlock(
      ctx({ brief: null, positioning: { name: 'n', summary: '摘要', full: '全文' } }),
      'script'
    );
    expect(block).toContain('已确定的账号定位');
    expect(block).toContain('生成一份「创作简报」');
  });
});

describe('注入体积可控', () => {
  for (const m of BOARD_MANIFESTS) {
    it(`${m.label} 的上下文不超过 3500 字`, () => {
      const size = buildContextBlock(ctx(), m.board).length;
      expect(size, `${m.label} 注入 ${size} 字`).toBeLessThan(3500);
      expect(size, `${m.label} 注入是空的`).toBeGreaterThan(100);
    });
  }
});

/**
 * 光有清单不够——页面得真的按清单去取。
 * 选题和脚本当初就是「清单上写着要，页面没传」，静态扫一遍挡住回归。
 */
describe('页面确实把简报传进去了', () => {
  const PAGES: Array<[string, string]> = [
    ['选题', 'app/dashboard/topic/page.tsx'],
    ['脚本', 'app/dashboard/script/page.tsx'],
    ['分镜', 'app/dashboard/storyboard/page.tsx'],
    ['审稿', 'app/dashboard/review/page.tsx'],
    ['标题', 'app/dashboard/title/page.tsx'],
  ];

  /** 这两个板块审计时是完全没接的，补上之后要卡住，别再退回去 */
  const NEWLY_WIRED: Array<[string, string, string]> = [
    ['成交理由', 'app/dashboard/deal-reason/page.tsx', 'dealReason'],
    ['自由对话', 'app/dashboard/free-chat/page.tsx', 'freeChat'],
    // 2026-09-30 补接（"每个板块都要有记忆，互相关联互通"）
    ['拆解爆款', 'app/dashboard/breakdown/page.tsx', 'breakdown'],
    ['跨行业二创', 'app/dashboard/remix/page.tsx', 'remix'],
    ['知识库', 'app/dashboard/knowledge/page.tsx', 'knowledge'],
  ];

  it('清单里的每个板块都有页面真的按它取上下文（清单写了、页面没用，等于没接）', () => {
    const dir = path.join(process.cwd(), 'app/dashboard');
    const pages = fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('page.tsx') || f.endsWith('.tsx'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');
    expect(pages.length, '一个页面都没读到，扫描空转').toBeGreaterThan(10_000);
    const used = new Set<string>();
    const source = ts.createSourceFile('pages.tsx', pages, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'buildContextBlock') {
        const board = node.arguments[1];
        if (board && ts.isStringLiteral(board)) used.add(board.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    const unused = BOARD_MANIFESTS.filter((m) => !used.has(m.board)).map((m) => m.label);
    expect(unused, `这些板块清单里有、页面没按它取：${unused.join('、')}`).toEqual([]);
  });

  it('成交理由只给清单里声明要的板块', () => {
    for (const m of BOARD_MANIFESTS) {
      const block = buildContextBlock(ctx(), m.board);
      expect(block.includes('这个账号的成交理由'), m.label).toBe(m.dealReasons);
    }
  });

  for (const [name, rel, board] of NEWLY_WIRED) {
    it(`${name}页接上了账号上下文（原来完全没接）`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src, `${name}页没有调用 useCreatorContext`).toMatch(/useCreatorContext\(\)/);
      expect(src, `${name}页没有按 '${board}' 取上下文`).toContain(`'${board}'`);
    });
  }

  it('自由对话不再手拼那 5 个字段', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/free-chat/page.tsx'),
      'utf8'
    );
    // 原来是 "账号：" + name + "；平台：" + ... 连成一行，
    // 没有口吻、没有禁忌、没有简报
    expect(src).not.toMatch(/parts\.push\("平台："/);
    expect(src).toMatch(/buildContextBlock\(creatorContext, 'freeChat'\)/);
  });

  for (const [name, rel] of PAGES) {
    it(`${name}页取了 creatorContext`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      expect(src, `${name}页没有调用 useCreatorContext`).toMatch(/useCreatorContext\(\)/);
      // 手拼 ctx 的页面必须显式带上 brief，否则简报到不了
      if (/buildContextBlock\(\s*\{/.test(src)) {
        expect(src, `${name}页手拼了 ctx 但没带 brief`).toMatch(/brief:\s*creatorContext\.brief/);
      }
    });
  }
});
