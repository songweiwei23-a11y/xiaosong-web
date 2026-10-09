import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  STAGE_ORDER,
  nextStage,
  workStageUrl,
  latestOf,
  workScriptBody,
  historyOpenUrl,
  type WorkDetail,
} from '@/lib/resume';
import { readCode } from './helpers/source';

/**
 * 作品互通：任何时候打开一个作品的任何环节，都能接着做。
 *
 * 【原来的问题】
 * - 板块之间靠 sessionStorage 一次性交接，隔一天、刷新一下就没了
 * - 「进行中」和首页「接着上次」的链接不带作品编号，点进去页面不知道做哪条
 * - "下一步"永远算成选题策划（选题那批记录从不挂到作品上），永远把人送回选题页
 * - 离开脚本页再回来，恢复了正文却没恢复作品，再生成就建出同名作品
 *   （线上「20年前濮阳老板怎么招客」06:52、06:57 各一个）
 * - 选题结果只能整批带走，没法单独把第 7 条送去起标题；旧批次打开了也送不出去
 * - 开篇生成后不挂任何作品
 */

const work = (items: WorkDetail['items']): WorkDetail => ({
  id: 'w1',
  title: '20年前濮阳老板怎么招客',
  profile_id: null,
  is_done: false,
  items,
});

describe('下一步与打开地址', () => {
  it('选题永远算已做——作品就是挑定了选题才建的', () => {
    const stages = STAGE_ORDER.map((s) => ({ name: s, done: false }));
    expect(nextStage(stages)).toBe('脚本生成');
  });

  it('按流程找第一个没做的', () => {
    const stages = STAGE_ORDER.map((s) => ({ name: s, done: s === '脚本生成' }));
    expect(nextStage(stages)).toBe('分镜脚本');
    expect(nextStage(STAGE_ORDER.map((s) => ({ name: s, done: true })))).toBeNull();
  });

  it('地址带作品编号；开篇额外落到开篇标签', () => {
    expect(workStageUrl('abc', '分镜脚本')).toBe('/dashboard/storyboard?work=abc');
    expect(workStageUrl('abc', '开篇钩子')).toBe('/dashboard/growth?work=abc&tab=opening');
  });

  it('历史记录：属于作品的回到那一条，零散的回到板块', () => {
    expect(historyOpenUrl({ task_type: '审稿优化', work_id: 'w9' })).toBe('/dashboard/review?work=w9');
    expect(historyOpenUrl({ task_type: '审稿优化', work_id: null })).toBe('/dashboard/review');
    expect(historyOpenUrl({ task_type: '成交理由' })).toBe('/dashboard/deal-reason');
  });
});

describe('从作品里取内容', () => {
  it('一个环节做过好几版，取最新一版', () => {
    const w = work([
      { id: 'a', task_type: '脚本生成', result: '旧版', created_at: '2026-09-20T00:00:00Z' },
      { id: 'b', task_type: '脚本生成', result: '新版', created_at: '2026-09-24T00:00:00Z' },
      { id: 'c', task_type: '分镜脚本', result: '分镜', created_at: '2026-09-25T00:00:00Z' },
    ]);
    expect(latestOf(w, '脚本生成')?.result).toBe('新版');
    expect(latestOf(w, '标题封面')).toBeNull();
  });

  it('给分镜、审稿用的脚本正文去掉了末尾的质量报告', async () => {
    const { splitQualityReport } = await import('@/lib/script-result-utils');
    // 格式照 lib/quality-checker 真实产出的写：## 🟢 脚本质量评分
    const withReport = '正文第一句\n\n正文第二句\n\n---\n\n## 🟢 脚本质量评分：7.2/10\n综合 72 分';
    // 前提：拆分函数本身认得这段报告，否则这条测的是空气
    expect(splitQualityReport(withReport).report).not.toBe('');
    const body = workScriptBody(
      work([{ id: 'a', task_type: '脚本生成', result: withReport, created_at: '2026-09-24T00:00:00Z' }])
    );
    expect(body).toContain('正文第一句');
    expect(body).not.toContain('72 分');
  });
});

describe('环节清单只有一份', () => {
  it('全仓只有 lib/resume.ts 定义了环节清单', () => {
    // 原来 lib/works.ts、app/api/works/route.ts、侧边栏各写一份，注释里写着"保持一致"
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) {
          const code = readCode(path.relative(process.cwd(), p));
          if (/\[\s*['"]选题策划['"]\s*,\s*['"]脚本生成['"]\s*,\s*['"]分镜脚本['"]/.test(code)) {
            hits.push(path.relative(process.cwd(), p));
          }
        }
      }
    };
    for (const d of ['app', 'lib', 'components', 'hooks']) walk(path.join(process.cwd(), d));
    expect(hits.map((h) => h.replace(/\\/g, '/'))).toEqual(['lib/resume.ts']);
  });
});

describe('作品接口', () => {
  const api = readCode('app/api/works/route.ts');

  it('选题环节永远算已做', () => {
    expect(api).toMatch(/stage === '选题策划' \|\| done\.includes\(stage\)/);
    expect(api).toContain('stageDone(s, done)');
  });

  it('同题的进行中作品直接复用，不再建出同名的第二个', () => {
    const post = api.slice(api.indexOf('export async function POST'), api.indexOf('export async function PUT'));
    expect(post).toMatch(/\.eq\('title', title\)/);
    expect(post).toMatch(/\.eq\('is_done', false\)/);
    expect(post).toContain('reused: true');
    // 按档案区分：A 号的"探店"和 B 号的"探店"是两条内容
    expect(post).toMatch(/profile_id/);
  });

  it('查环节时按本人过滤', () => {
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'));
    expect((get.match(/from\('script_history'\)[\s\S]{0,200}?\.eq\('user_id', guard\.userId!\)/g) ?? []).length).toBe(2);
  });
});

describe('「进行中」和首页带着作品走', () => {
  for (const f of ['components/dashboard/InProgressStrip.tsx', 'app/dashboard/page.tsx']) {
    it(`${f} 的链接带作品编号、下一步不再永远是选题`, () => {
      const code = readCode(f);
      expect(code).toContain('workStageUrl(');
      expect(code).toContain('nextStage(');
      // 旧写法：自己按"第一个没做的"找，而选题永远没做
      expect(code, '又自己写了一份"第一个没做的环节"').not.toMatch(/stages\.find\(\(s\) => !s\.done\)/);
    });
  }

  it('顶栏「进行中」能删除作品，删之前要确认，并说清内容不会删', () => {
    const code = readCode('components/dashboard/InProgressStrip.tsx');
    expect(code).toContain('deleteWork(');
    expect(code).toContain('confirmDialog(');
    expect(code).toMatch(/内容不会删/);
  });

  it('「我的作品」页存在，每个环节都能点开', () => {
    const page = readCode('app/dashboard/works/page.tsx');
    expect(page).toContain('<WorkCard');
    expect(page).toContain('deleteWork(');
    expect(readCode('components/works/WorkCard.tsx')).toContain('workStageUrl(w.id, s.name)');
  });
});

describe('各板块认得 ?work= 地址', () => {
  const BOARDS: [string, string][] = [
    ['app/dashboard/script/page.tsx', '脚本生成'],
    ['app/dashboard/storyboard/page.tsx', '分镜脚本'],
    ['app/dashboard/review/page.tsx', '审稿优化'],
    ['app/dashboard/title/page.tsx', '标题封面'],
    ['app/dashboard/growth/page.tsx', '开篇钩子'],
  ];

  for (const [f, stage] of BOARDS) {
    it(`${stage}：打开作品时恢复内容`, () => {
      const code = readCode(f);
      expect(code, `${f} 没接 useWorkResume`).toContain('useWorkResume(');
      expect(code, `${f} 没把这个环节最新一版调出来`).toContain(`latestOf(work, "${stage}")`.replace(/"/g, f.includes('growth') ? "'" : '"'));
    });
  }

  it('分镜、审稿续作时拿的是去掉质量报告的脚本正文', () => {
    for (const f of ['app/dashboard/storyboard/page.tsx', 'app/dashboard/review/page.tsx']) {
      expect(readCode(f)).toContain('workScriptBody(work)');
    }
  });

  it('"回填最近一条"在打开作品时让路——不能把别的作品的内容塞进来冒充', () => {
    expect(readCode('hooks/useRestoreLastResult.ts')).toMatch(/if \(workIdFromUrl\(\)\) return/);
    expect(readCode('app/dashboard/title/page.tsx')).toMatch(/useRestoreLastResult\(lastResult, setResult, resultScope/);
    expect(readCode('app/dashboard/growth/page.tsx')).toMatch(/workIdFromUrl\(\) \|\| incomingCreation\.current \? null/);
  });

  it('作品取不到时要说出来，不然页面空着像是"记忆"又坏了', () => {
    expect(readCode('hooks/useWorkResume.ts')).toMatch(/notify\(/);
  });
});

describe('历史记录调回来时连作品一起接上', () => {
  it('历史条目的类型里有 work_id 和 input_data', () => {
    const code = readCode('components/workspace/HistoryPanel.tsx');
    expect(code).toMatch(/work_id\?:/);
    expect(code).toMatch(/input_data\?:/);
  });

  for (const f of [
    'app/dashboard/script/page.tsx',
    'app/dashboard/storyboard/page.tsx',
    'app/dashboard/review/page.tsx',
  ]) {
    it(`${f} 点历史时把作品也接上`, () => {
      expect(readCode(f)).toMatch(/setWorkId\(item\.work_id \?\? null\)/);
    });
  }

  it('脚本页恢复上次内容时，连作品一起恢复——重复建作品就是从这里来的', () => {
    const code = readCode('app/dashboard/script/page.tsx');
    // 必须真的把作品设上。只查 lastItem.work_id 这个词在不在是不够的——
    // 删掉 setWorkId 之后它还留在 if 条件里，断言照样通过（变异测试时就这么漏过一次）
    expect(code).toMatch(/setWorkId\(\(cur\) => cur \|\| lastItem\.work_id\)/);
    // 带着内容跳过来的、或地址指定了作品的，以那边为准
    expect(code).toMatch(/handedOffRef\.current \|\| workIdFromUrl\(\)/);
  });

  it('打开作品后换了主题，就是另一条内容，不能记到原作品上', () => {
    expect(readCode('app/dashboard/script/page.tsx')).toMatch(
      /topic\.trim\(\) !== workTitle\.trim\(\)/
    );
  });
});

describe('开篇也挂到作品上', () => {
  const code = readCode('app/dashboard/growth/page.tsx');

  it('生成成功后才挂作品，并登记环节', () => {
    expect(code).toMatch(/saveGenerationHistory\(taskType, \{ \.\.\.inputs, creationSettings: currentSettings, profileId: generationProfileId \}, full, workId\)/);
    expect(code).toMatch(/recordStage\(workId, taskType\)/);
    // 没带作品来的，按这条选题建一个（服务端同题复用）
    expect(code).toMatch(/createWork\(title, profileId\)/);
  });

  it('"用这条写脚本""起标题"把作品带下去', () => {
    // 作品编号写进持久创作需求，跳转地址由服务端保存结果生成（?creation=…&work=…）
    expect(code).toMatch(/buildCreationHandoff\('growth', 'script', o\.line,/);
    expect(code).toMatch(/buildCreationHandoff\('growth', 'title', result,/);
    expect(code.match(/workId: currentOpeningWork \?\? undefined,\s*\}, \(u\) => router\.push\(u\)/g)?.length).toBe(2);
  });
});

describe('选题清单：每一条都能单独送出去', () => {
  it('三个出口：写脚本、设计开篇、起标题', () => {
    const list = readCode('components/workspace/TopicList.tsx');
    for (const s of ['脚本生成', '开篇钩子', '标题封面']) expect(list).toContain(`stage: "${s}"`);
  });

  it('选题页接上了：点哪条就给哪条建作品，带着编号跳过去', () => {
    const page = readCode('app/dashboard/topic/page.tsx');
    expect(page).toContain('<TopicList');
    expect(page).toContain('parseTopicOptions(result)');
    expect(page).toMatch(/createWork\(title,/);
    // 带着编号持久保存后跳（地址里有 ?work=，见 lib/creation-snapshot 的 creationSnapshotUrl）
    expect(page).toMatch(/workId: workId \?\? undefined,/);
    expect(page).toMatch(/await openCreationSafely\(\{/);
  });

  it('从历史里打开旧批次时，那一批的打法也接上', () => {
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/item\.input_data\?\.tactic/);
  });

  it('已经在做的那条标出来，不会被当成新的再开一遍', () => {
    expect(readCode('components/workspace/TopicList.tsx')).toMatch(/已在做/);
  });
});
