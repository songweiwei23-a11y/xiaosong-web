// 账号诊断（2026-11-02 产品方）：创作进度用拆对标的逻辑拆自己的号、读抖音真实数据，诊断结果同步给整个开物——
// 「需要知道账号目前信息的就让他知道；不需要或者会扰乱该板块的就不要给」，开物助理也要知道。
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDiagnosisQuery, diagnosisInstruction, diagnosisPromptBlock, diagnosisSection, DIAGNOSIS_FRAMEWORK, DIAGNOSIS_TASK_TYPE, type AccountDiagnosis } from '@/lib/account-diagnosis';
import { BOARD_MANIFESTS, manifestOf } from '@/lib/context-manifest';
import { buildContextBlock, type CreatorContext } from '@/lib/creator-context';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { foundationNeedOf } from '@/lib/foundation-gate';
import { situationBlock, situationItems, type Situation } from '@/lib/assistant/situation';

const REPORT = [
  '## 第一部分　现在的你',
  '### 二、核心诊断（先看这 8 条）',
  '1. **实际是什么号**：县城剪发老师傅的救场号',
  '7. **最大的问题**：变现型几乎没有',
  '### 三、实际定位 vs 地基定位',
  '| 维度 | 地基 | 实际 |',
  '### 四、六维深度拆解（和拆对标同一套，拆的是自己）',
  '#### 1. 人设定位',
  '- 人设标签句：剪坏了找阿杰',
  '## 第二部分　接下来怎么做',
  '### 十一、接下来 30 天的布局',
  '- **配比**：流量型 50%、人设型 30%、变现型 20%',
  '### 十二、给各板块的指令',
  '- 内容规划：每周排 1 条到店体验',
  '- 选题：多拍救场，少拍发型教程',
  '- **脚本**：开头先给剪坏的结果，结尾说到店地址',
  '- 人设：每条都露手和剪刀',
  '- 变现：评论区问价的统一回到店',
  '- 地基：账号定位不用重做，内容定位加一个到店系列',
  '### 十三、待核实',
  '- 完播率没有数据',
].join('\n');
const DIAG: AccountDiagnosis = { report: REPORT, generatedAt: '2026-11-02T10:00:00.000Z', materials: ['插件采集：作品 42 条'] };

describe('诊断报告：拆自己 + 诊断 + 给各板块的指令', () => {
  it('框架：第一部分拆自己（核心诊断、实际 vs 地基、六维深度拆解、流量、配比、人设、变现、评论区），第二部分怎么做（问题、30 天布局、给各板块的指令）', () => {
    const order = ['## 第一部分', '### 一、材料清单', '### 二、核心诊断', '### 三、实际定位 vs 地基定位', '### 四、六维深度拆解', '#### 1. 人设定位', '#### 6. 变现定位', '#### 8. 自洽检验',
      '### 五、流量诊断', '### 六、配比诊断', '### 七、人设诊断', '### 八、变现诊断', '### 九、评论区在说什么',
      '## 第二部分', '### 十、问题清单', '### 十一、接下来 30 天的布局', '### 十二、给各板块的指令', '### 十三、待核实'];
    let last = -1;
    for (const h of order) {
      const at = DIAGNOSIS_FRAMEWORK.indexOf(h);
      expect(at, h).toBeGreaterThan(last);
      last = at;
    }
    for (const b of ['内容规划', '创作方向', '选题', '脚本', '人设', '变现', '地基']) expect(DIAGNOSIS_FRAMEWORK).toContain(`- ${b}：`);
    expect(DIAGNOSIS_FRAMEWORK).toContain('建议编导到抖音创作者中心导出「作品数据」表格');
  });

  it('提示词：材料全带上（采集、导入文件、作品记录、地基），文件总量有上限；要求对照「定的」和「实际的」，不替老板改方向', () => {
    const q = buildDiagnosisQuery({
      profileName: '阿杰剪发',
      materialLines: ['插件采集：作品 42 条'],
      collectedText: '【插件自动采集的账号数据】x',
      fileTexts: [{ name: '作品数据.xlsx', text: '播放 完播'.repeat(20000) }, { name: '脚本.docx', text: 'y' }],
      insightBlock: '### 🧭 作品概况',
      contextBlock: '## 账号定位原文\n救场老师傅',
    });
    for (const s of ['【诊断的账号】阿杰剪发', '【插件自动采集的账号数据】x', '### 文件：作品数据.xlsx', '### 🧭 作品概况', '救场老师傅', '不替老板改方向', DIAGNOSIS_FRAMEWORK]) expect(q).toContain(s);
    expect(q.length).toBeLessThan(80_000);
  });

  it('按标题取节、按板块取指令（带不带加粗都认）', () => {
    expect(diagnosisSection(REPORT, /核心诊断/)).toContain('县城剪发老师傅的救场号');
    expect(diagnosisInstruction(REPORT, '选题')).toBe('多拍救场，少拍发型教程');
    expect(diagnosisInstruction(REPORT, '脚本')).toBe('开头先给剪坏的结果，结尾说到店地址');
    expect(diagnosisInstruction(REPORT, '标题')).toBe('');
  });
});

describe('诊断同步给整个开物：要的给，会扰乱的不给', () => {
  it('分配：规划类全给，写单条的只给三行，分镜、审稿、标题、成交理由、拆解、知识库不给', () => {
    const scope = Object.fromEntries(BOARD_MANIFESTS.map((m) => [m.board, m.diagnosis ?? null]));
    expect(scope).toEqual({
      topic: 'planning', direction: 'planning', growth: 'planning', freeChat: 'planning',
      script: 'single', remix: 'single',
      storyboard: null, review: null, title: null, dealReason: null, breakdown: null, knowledge: null,
    });
  });

  it('规划类：核心诊断 + 30 天布局 + 全部指令；写单条的：只有脚本、人设、变现三行；地基：核心诊断 + 实际 vs 地基 + 对地基的建议；助理：核心诊断 + 指令', () => {
    const planning = diagnosisPromptBlock(DIAG, 'planning');
    expect(planning).toContain('### 🩺 账号诊断（2026-11-02）');
    for (const s of ['县城剪发老师傅的救场号', '流量型 50%', '选题：多拍救场', '内容规划：每周排 1 条到店体验']) expect(planning).toContain(s);

    const single = diagnosisPromptBlock(DIAG, 'single');
    expect(single).toContain('- 脚本：开头先给剪坏的结果');
    expect(single).toContain('- 人设：每条都露手和剪刀');
    expect(single).toContain('- 变现：评论区问价的统一回到店');
    expect(single).not.toContain('流量型 50%');
    expect(single).not.toContain('县城剪发老师傅');

    const foundation = diagnosisPromptBlock(DIAG, 'foundation');
    expect(foundation).toContain('实际 vs 地基');
    expect(foundation).toContain('诊断对地基的建议：账号定位不用重做，内容定位加一个到店系列');
    expect(foundation).toContain('不因为某类数据好就替他改方向');

    expect(diagnosisPromptBlock(DIAG, 'assistant')).toContain('派活时照这个补全派活单');
    expect(diagnosisPromptBlock(null, 'planning')).toBe('');
    expect(diagnosisPromptBlock(DIAG, null)).toBe('');
  });

  it('板块上下文按清单领：选题有布局，脚本只有三行，分镜、审稿一个字没有', () => {
    const ctx = { profile: { profile_name: '阿杰剪发' }, positioning: null, dealReasons: [], workInsight: { diagnosis: DIAG } } as unknown as CreatorContext;
    expect(buildContextBlock(ctx, 'topic')).toContain('流量型 50%');
    expect(buildContextBlock(ctx, 'script')).toContain('- 脚本：开头先给剪坏的结果');
    expect(buildContextBlock(ctx, 'script')).not.toContain('流量型 50%');
    for (const m of ['storyboard', 'review', 'title', 'dealReason', 'breakdown', 'knowledge'] as const) expect(buildContextBlock(ctx, m), m).not.toContain('账号诊断');
    expect(manifestOf('direction')?.diagnosis).toBe('planning');
  });

  it('地基板块：账号定位、深挖定位、行业建议（页面和助理派活两边）都带 foundation 那一份；创作简报不带（它要忠实转译定位）', () => {
    expect(buildPositioningPrompt({ profileSummary: 'x', diagnosis: diagnosisPromptBlock(DIAG, 'foundation') })).toContain('## 🩺 这个号现在的实际情况（账号诊断）');
    expect(buildPositioningPrompt({ profileSummary: 'x' })).not.toContain('账号诊断');
    const read = (f: string) => fs.readFileSync(f, 'utf8');
    for (const f of ['app/dashboard/positioning/page.tsx', 'components/positioning/DeepDivePage.tsx', 'app/dashboard/industry-advice/page.tsx']) {
      expect(read(f), f).toMatch(/diagnosisPromptBlock\(await fetchDiagnosis\([^)]*\), ['"]foundation['"]\)/);
    }
    const extra = read('lib/assistant/boards-extra.ts');
    expect(extra.match(/diagnosisPromptBlock\(creatorContext\.workInsight\?\.diagnosis, 'foundation'\)/g)?.length).toBe(3);
    expect(read('app/dashboard/creative-brief/page.tsx')).not.toContain('diagnosis');
  });

  it('开物助理：每轮的老板现状带诊断要点；没诊断过、诊断过期都会提醒', () => {
    const base: Situation = { today: '2026-11-02', profileCount: 1, profile: { name: '阿杰剪发', industry: '理发' }, positioningTypes: ['账号定位', '创作简报'], recent: [{ from: '脚本生成', title: 'x', createdAt: '2026-11-01T10:00:00+08:00' }], works: [{ shoot_status: 'published' }, { shoot_status: 'published' }, { shoot_status: 'published' }], todos: [], benchmarks: { accounts: 1, analyzed: 1, latestAt: null }, quota: null };
    expect(situationItems(base).map((i) => i.key)).toContain('diagnose');
    expect(situationItems({ ...base, diagnosis: { ...DIAG, generatedAt: '2026-09-20T00:00:00Z' } }).find((i) => i.key === 'diagnose-old')?.label).toBe('诊断已经 43 天了');
    const block = situationBlock({ ...base, diagnosis: DIAG });
    expect(block).toContain('### 🩺 账号诊断（2026-11-02）');
    expect(block).toContain('选题：多拍救场');
    expect(situationItems({ ...base, diagnosis: DIAG }).map((i) => i.key)).not.toContain('diagnose');
  });
});

describe('接线', () => {
  const read = (f: string) => fs.readFileSync(f, 'utf8');

  it('任务类型：和对标拆解同一项额度；有档案就能诊断', () => {
    expect(TASK_TYPE_TO_FEATURE[DIAGNOSIS_TASK_TYPE]).toBe('breakdown');
    expect(foundationNeedOf(DIAGNOSIS_TASK_TYPE)).toBe('profile');
  });

  it('存在作品概况同一行；重新分析作品概况时保留诊断', () => {
    expect(read('app/api/account-diagnosis/route.ts')).toContain("insight: { ...base, diagnosis }");
    expect(read('app/api/work-insights/route.ts')).toContain('diagnosis: previous?.diagnosis ?? null');
  });

  it('创作进度页：诊断我的账号在作品概况上面；插件交来自己的号才诊断，等地基读完再开始；做完刷新各板块的上下文', () => {
    const page = read('app/dashboard/works/page.tsx');
    expect(page.indexOf('<AccountDiagnosis />')).toBeLessThan(page.indexOf('<MaterialsPanel />'));
    const c = read('components/works/AccountDiagnosis.tsx');
    expect(c).toContain('if (!col || col.purpose !== "self") return;');
    expect(c).toContain('type: "collect", url, purpose: "self"');
    expect(c).toContain('if (!pending.current || loading || !profileId) return;');
    expect(c).toContain('invalidateCreatorContext();');
    expect(c).toContain('taskType: DIAGNOSIS_TASK_TYPE');
  });

  it('助理知道怎么带老板去诊断', async () => {
    const { ASSISTANT_SYSTEM } = await import('@/lib/assistant/run');
    expect(ASSISTANT_SYSTEM).toContain('用 open_page 打开 works（创作进度），告诉他在「诊断我的账号」里粘贴自己的抖音主页链接');
  });
});
