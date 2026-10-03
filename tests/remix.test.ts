/**
 * 跨行业二创：提示词守住知识库的方法（借机制不借内容、行业内看选题跨行业看表达），
 * 用户的每一个选择都真的进了提示词，和拆解爆款、分镜/审稿/标题接得上。
 */
import { describe, it, expect } from 'vitest';
import {
  buildRemixPrompt,
  condenseBreakdown,
  BORROW_LAYERS,
  DEFAULT_LAYERS,
  DEFAULT_OUTPUTS,
  MAX_SOURCE_CHARS,
  REMIX_TASK_TYPE,
  type RemixOptions,
} from '@/lib/remix';
import { TASK_TYPE_TO_FEATURE } from '@/lib/task-type';
import { ISOLATED_TASKS } from '@/lib/topic-library';
import { COUNTED_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/config/plans';
import { readCode } from './helpers/source';

const REPORT = `## 一句话：这条为什么能火
结果前置 + 细节证据

### 五、逐镜头拆解
**节奏一览**
| 镜头 | 时间 | 景别 | 这一镜干什么 | 情绪 |
|---|---|---|---|---|
| 1 | 00:00–00:08 | 近景 | 抛钩子 | ●●●○○ |

#### 镜头 1｜00:00.0–00:08.6｜8.6 秒｜●●●○○
- **画面**：访谈位
- **作用**：抛钩子

#### 镜头 2｜00:08.6–00:10.9｜2.3 秒｜●●●○○
- **画面**：照片

**镜头层面的发现**
1. 前 8 秒不切

### 七、能学走什么
结构骨架：结果前置 → 补原因`;

const base: RemixOptions = {
  layers: DEFAULT_LAYERS,
  count: 3,
  differentiate: 'layer',
  depth: 'full',
  role: '变现型',
  duration: '60 秒',
  outputs: DEFAULT_OUTPUTS,
  profileSummary: '- 档案名称：阿强牛肉\n- 经营品类（每一个都在卖，定位里都要体现）：川菜',
  restrictions: '不说全长沙最好吃',
};

describe('拆解报告瘦身', () => {
  it('去掉逐个镜头的卡片，节奏一览、发现、能学走什么都留着', () => {
    const c = condenseBreakdown(REPORT);
    expect(c).not.toMatch(/镜头 1｜00:00\.0/);
    expect(c).not.toMatch(/\*\*画面\*\*：照片/);
    expect(c).toContain('**节奏一览**');
    expect(c).toContain('**镜头层面的发现**');
    expect(c).toContain('### 七、能学走什么');
  });

  it('太长就截断并说明', () => {
    const c = condenseBreakdown('字'.repeat(MAX_SOURCE_CHARS + 500));
    expect(c.length).toBeLessThan(MAX_SOURCE_CHARS + 20);
    expect(c).toMatch(/后面省略/);
  });
});

describe('提示词', () => {
  const p = buildRemixPrompt({ kind: 'breakdown', text: REPORT, title: '下载.mp4' }, base);

  it('知识库方法：行业内看选题、跨行业看开篇金句呈现形式；借机制不借内容，照抄就是搬运', () => {
    expect(p).toMatch(/行业内看选题，跨行业看开篇、金句、呈现形式/);
    expect(p).toMatch(/借的是\*\*结构和机制\*\*/);
    expect(p).toMatch(/搬运/);
    expect(p).toMatch(/帮粉丝买车"→"帮粉丝做账号"/);
  });

  it('用户选的每一层都有具体借法；没选的层要换成自己的', () => {
    for (const id of DEFAULT_LAYERS) {
      const layer = BORROW_LAYERS.find((l) => l.id === id)!;
      expect(p, layer.label).toMatch(new RegExp(`- ${layer.label.slice(0, 2)}`));
    }
    expect(p).toMatch(/\*\*没选的层\*\*（镜头节奏、情绪曲线/);
    const one = buildRemixPrompt({ kind: 'paste', text: '原片文案原片文案原片文案原片文案原片文案' }, { ...base, layers: ['punchline'] });
    expect(one).toMatch(/金句：借原片金句的\*\*句式\*\*/);
    expect(one).not.toMatch(/开篇：保留原片开头/);
  });

  it('方案数、拉开方式、深度、目的、时长都进提示词', () => {
    expect(p).toMatch(/\*\*出 3 个方案\*\*，方案之间：每个借不同的层/);
    expect(p).toMatch(/\*\*深度\*\*：完整/);
    expect(p).toMatch(/\*\*目的\*\*：变现型/);
    expect(p).toMatch(/\*\*时长\*\*：60 秒/);
    // 1 个方案就不说怎么拉开
    expect(buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, count: 1 })).not.toMatch(/方案之间：/);
  });

  it('产出按勾的来：快速只出要点；深度自动带备选开头、分镜细到台词动作', () => {
    expect(p).toContain('#### 口播全文');
    expect(p).toContain('#### 分镜');
    expect(p).toContain('#### 用你手上的资源怎么拍');
    expect(p).not.toContain('#### 标题和封面');
    const quick = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, depth: 'quick' });
    expect(quick).toContain('#### 口播要点');
    expect(quick).not.toContain('#### 口播全文');
    const deep = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, depth: 'deep' });
    expect(deep).toContain('#### 备选开头');
    expect(deep).toMatch(/细到能直接照着拍/);
    const all = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, outputs: ['titles', 'comment'] });
    expect(all).toContain('#### 标题和封面');
    expect(all).toContain('#### 评论区置顶');
  });

  it('不许替老板编经历（实测编出"辞掉大厂、撕了年薪工资条"）：档案里没有的用【】让他换成真的', () => {
    expect(p).toMatch(/\*\*不要替他编经历\*\*/);
    expect(p).toMatch(/写成「【换成你的：……】」让他换成自己的真实经历/);
    // 要填的地方和标段落作用的【开篇钩子】分得清
    expect(p).toMatch(/要填的地方一定以"换成你的："开头/);
    expect(p).toMatch(/写成 X/);
  });

  it('每个方案都有迁移对照、开头逐字、防搬运；最后推荐先拍哪个', () => {
    expect(p).toContain('#### 迁移对照');
    expect(p).toContain('| 层 | 原片 | 你的版本 |');
    expect(p).toMatch(/第一句话逐字写出来/);
    expect(p).toMatch(/"这条不是搬运"/);
    expect(p).toContain('### 我推荐先拍哪个');
  });

  it('落到账号：带档案和禁忌；没档案时用手填的行业，都没有就提醒', () => {
    expect(p).toContain('- 经营品类（每一个都在卖，定位里都要体现）：川菜');
    expect(p).toMatch(/## 硬禁忌[\s\S]*不说全长沙最好吃/);
    const noProfile = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, profileSummary: undefined, restrictions: undefined, targetIndustry: '美甲店' });
    expect(noProfile).toMatch(/做的是：美甲店/);
    expect(buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, profileSummary: undefined })).toMatch(/提醒他选好档案/);
  });

  it('以当前档案为准（产品方定）：店名、行业、在卖的品类写成硬约束，几个品类都要覆盖', () => {
    const withStore = buildRemixPrompt(
      { kind: 'breakdown', text: REPORT },
      { ...base, store: { name: '锦园地摊串串', lines: ['川味串串火锅', '川味烧烤', '川菜'], track: '美食烹饪、川菜' } }
    );
    expect(withStore).toMatch(/## 二创到哪家店（以这个档案为准，硬约束）/);
    expect(withStore).toContain('**店 / 账号**：锦园地摊串串');
    expect(withStore).toContain('**行业 / 赛道**：美食烹饪、川菜');
    expect(withStore).toContain('**在卖的品类**：川味串串火锅、川味烧烤、川菜');
    expect(withStore).toMatch(/原片是什么行业不重要，写出来的一律是「川味串串火锅、川味烧烤、川菜」的事/);
    expect(withStore).toMatch(/3 个品类都在卖、一样重要/);
    expect(withStore).toMatch(/不要编这家店没有的东西/);
    // 硬约束在档案摘要前面
    expect(withStore.indexOf('二创到哪家店')).toBeLessThan(withStore.indexOf('这个账号的档案'));
    // 只有一个品类就不说"覆盖几个品类"
    const one = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, store: { name: '阿强牛肉', lines: ['川菜'] } });
    expect(one).not.toMatch(/个品类都在卖/);
  });

  it('带上账号记忆（简报、成交理由、禁忌）：有它就不再重复单独的禁忌段', () => {
    const ctx = '## 📇 账号背景：阿强牛肉\n\n### ⛔ 硬性禁忌（违反即不可用）\n\n- 绝对不能说：全长沙最好吃\n\n## 💰 这个账号的成交理由\n\n- 实在不坑';
    const q = buildRemixPrompt({ kind: 'breakdown', text: REPORT }, { ...base, contextBlock: ctx });
    expect(q).toContain('## 💰 这个账号的成交理由');
    expect(q).toContain('硬性禁忌');
    expect(q).not.toMatch(/## 硬禁忌（所有方案/);
  });

  it('原片是拆解报告时说明镜头卡片省略了；贴文案时原样放进去', () => {
    expect(p).toMatch(/逐个镜头的卡片已省略/);
    expect(p).toContain('## 原片：下载.mp4');
    const paste = buildRemixPrompt({ kind: 'paste', text: '修车师傅说信不信15秒让你不敢去4S店', industry: '汽修' }, base);
    expect(paste).toMatch(/用户贴的原片文案/);
    expect(paste).toContain('（汽修）');
    expect(paste).toContain('修车师傅说信不信15秒让你不敢去4S店');
  });
});

describe('接到全站', () => {
  it('单独一项额度：免费 3 次；任务类型对得上；不接共用会话', () => {
    expect(TASK_TYPE_TO_FEATURE[REMIX_TASK_TYPE]).toBe('remix');
    expect(COUNTED_FEATURES.find((f) => f.key === 'remix')?.column).toBe('remix_used');
    expect(SUBSCRIPTION_PLANS.free.quotas.remix).toBe(3);
    expect(ISOLATED_TASKS.has(REMIX_TASK_TYPE)).toBe(true);
    expect(readCode('supabase/migrations/20260930_remix.sql')).toMatch(/add column if not exists remix_used/);
  });

  it('拆解爆款 → 二创：拆完一键带过去（整份报告走 sessionStorage）', () => {
    const breakdown = readCode('app/dashboard/breakdown/page.tsx');
    expect(breakdown).toMatch(/label: "拿去二创到我的店"/);
    expect(breakdown).toMatch(/putHandoff\(\{ from: BREAKDOWN_TASK_TYPE, remixSource: \{ title: loadedFileName \|\| file\?\.name, text: body \} \}\)/);
    expect(breakdown).toMatch(/router\.push\("\/dashboard\/remix"\)/);
    const remix = readCode('app/dashboard/remix/page.tsx');
    expect(remix).toMatch(/const h = takeHandoff\(\);\s*if \(h\) setIncomingSetup\(h\);\s*if \(h\?\.remixSource\?\.text\)/);
    // 二创页也能从拆过的视频里挑
    expect(remix).toMatch(/taskType=\$\{encodeURIComponent\(BREAKDOWN_TASK_TYPE\)\}/);
  });

  it('页面：一律用侧边栏当前档案，没有「用不用档案」的开关；只有没建档案才手填行业', () => {
    const remix = readCode('app/dashboard/remix/page.tsx');
    expect(remix).not.toMatch(/withProfile/);
    expect(remix).not.toMatch(/type="checkbox"/);
    expect(remix).toMatch(/store: profile \? \{ name: String\(profile\.profile_name \?\? ""\), lines, track \} : undefined/);
    expect(remix).toMatch(/businessLines\(profile\)/);
    expect(remix).toMatch(/buildContextBlock\(context, 'remix'\)/);
    expect(remix).toMatch(/targetIndustry: profile \? undefined : targetIndustry/);
    // 档案还没读出来就点生成，会落到"没有档案"那一支
    expect(remix).toMatch(/if \(ctxLoading\)/);
  });

  it('页面：先查额度、按跨行业二创发、存历史、切回来能恢复', () => {
    const remix = readCode('app/dashboard/remix/page.tsx');
    expect(remix).toMatch(/checkQuota\("remix"\)/);
    expect(remix).toMatch(/openUpgrade\("remix"\)/);
    expect(remix).toMatch(/taskType: REMIX_TASK_TYPE/);
    expect(remix).toMatch(/saveCreativeHistory\(\{ id: historyId, taskType: REMIX_TASK_TYPE/);
    expect(remix).toContain('historyInput,');
    expect(remix).toMatch(/useRestoreLastResult\(lastResult, setResult, resultScope\)/);
  });
});
