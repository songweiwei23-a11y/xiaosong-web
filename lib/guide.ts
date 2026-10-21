import type { SetupStep } from '@/lib/setup-progress';
import { STAGE_ORDER, workStageUrl } from '@/lib/resume';
import type { Work } from '@/lib/works';

/**
 * 新手引导：用户现在处于什么阶段，以及可以怎么选。
 *
 * 引导只列出选项，不替用户做决定：每个阶段给 2–3 个选项，其中一个标「建议」，
 * 但点不点、点哪个都是用户自己的事。引导绝不自动跳转。
 *
 * 纯函数：输入是已经取好的地基、作品、额度，输出是首页大卡和顶栏小条要显示的内容。
 * 每次数据变了就重新算（实时）。
 *
 * 阶段（按顺序判断，先命中的算）：
 *   start       还没有账号档案
 *   foundation  档案有了，地基三步没做完
 *   first_work  地基做完了，一条内容都还没做过
 *   in_progress 有没做完的作品
 *   returning   做过，但最近 7 天没动过
 *   active      最近在用
 */

export type GuideStage = 'start' | 'foundation' | 'first_work' | 'in_progress' | 'returning' | 'active';

export interface GuideOption {
  /** 稳定的标识，给界面做 key */
  key: string;
  /** 按钮文字：写清楚会去哪、做什么 */
  label: string;
  /** 选它会怎样，一句话 */
  why: string;
  href: string;
  /** 建议项。每组最多标一个，只是提示，不替用户选 */
  recommended: boolean;
}

export interface GuideInput {
  /** 地基三步。null 表示还没取到（显示加载中，不猜） */
  setupSteps: SetupStep[] | null;
  /** 当前档案下的作品。null 表示还没取到 */
  works: Work[] | null;
  /** 额度：有功能额度用完时给出功能名；次数包余额（null 表示读不到） */
  quota: { exhaustedFeature: string | null; packCredits: number | null } | null;
  /** 现在的时间（毫秒）。由调用方传入，方便测试 */
  nowMs: number;
}

export interface GuideOutput {
  stage: GuideStage;
  /** 阶段名，短，给标签用 */
  stageLabel: string;
  /** 一句话：现在处于什么阶段 */
  stageDesc: string;
  /** 地基进度；只在新手阶段有 */
  progress: { done: number; total: number } | null;
  /** 可以怎么选：2–3 个，用户自己点 */
  options: GuideOption[];
  /** 选项上面的一句话，说明可以自己选 */
  intro: string;
  /** 行为建议，最多 3 条，只是说明，不带跳转 */
  tips: string[];
  /** 额度相关的提醒（用完了 / 次数包还有多少）；没有就是 null */
  alert: { text: string; href: string; cta: string } | null;
}

const DAY_MS = 86_400_000;
/** 超过这么多天没动过，算「回来了」 */
const STALE_DAYS = 7;
const INTRO = '下面几项你自己选，不选也行，按你自己的节奏来';
const WORKS = '/dashboard/works';
const TOPIC = '/dashboard/topic';

function opt(key: string, label: string, why: string, href: string, recommended: boolean): GuideOption {
  return { key, label, why, href, recommended };
}

/**
 * 一条作品已经做完的环节。
 *
 * 流程是按顺序走的：后面的环节做完了，前面的必然做过。但环节的完成记录可能缺一块
 * （比如脚本是在别处生成的，没挂到这条作品上），所以按阶段顺序往前补齐。
 * 选题策划永远算做完（作品就是挑定了选题才建的，见 lib/resume.ts 的 nextStage）。
 */
export function doneStages(stages: { name: string; done: boolean }[]): Set<string> {
  const explicit = new Set(stages.filter((s) => s.done).map((s) => s.name));
  explicit.add(STAGE_ORDER[0]);
  let furthest = -1;
  STAGE_ORDER.forEach((name, i) => {
    if (explicit.has(name)) furthest = i;
  });
  const done = new Set<string>(explicit);
  for (let i = 0; i <= furthest; i++) done.add(STAGE_ORDER[i]);
  return done;
}

/** 数据没齐时返回 null，页面显示加载中，不猜 */
export function buildGuide(input: GuideInput): GuideOutput | null {
  if (!input.setupSteps || !input.works) return null;

  const steps = input.setupSteps;
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  const profileDone = steps.find((s) => s.key === 'profile')?.done ?? false;
  const nextSetup = steps.find((s) => !s.done) ?? null;

  const works = input.works;
  const byRecent = [...works].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  const inProgress = byRecent.filter((w) => !w.is_done && (w.shoot_status ?? 'none') === 'none');
  const latest = byRecent[0] ?? null;
  const daysSince = latest?.updated_at
    ? (input.nowMs - new Date(latest.updated_at).getTime()) / DAY_MS
    : null;

  const alert = buildAlert(input.quota);

  if (!profileDone) {
    return {
      stage: 'start',
      stageLabel: '新手 · 第 1 步',
      stageDesc: '你还没有账号档案，开物还不认识你的号',
      progress: { done, total },
      options: [
        opt('profile', '建一个账号档案', '填一次，全站都用它。档案越全，生成的东西越贴合你的号', '/dashboard/profiles/new', true),
        opt('skip', '先不建，直接去选题', '能用，但生成的内容是通用的，不贴合你的号', TOPIC, false),
      ],
      intro: INTRO,
      tips: [
        '名字、行业、主卖什么，这三样先填，其余的之后随时能补',
        '不确定的先空着，档案随时可以改',
        '建好档案后，账号定位是下一步',
      ],
      alert,
    };
  }

  if (nextSetup) {
    return {
      stage: 'foundation',
      stageLabel: `地基 ${done}/${total}`,
      stageDesc: `档案已经建好，还差 ${total - done} 步地基。做完才会生成得贴合你的号`,
      progress: { done, total },
      options: [
        opt('setup', `${nextSetup.index}. ${nextSetup.title}`, nextSetup.why, nextSetup.href, true),
        opt('skip', '先不做，直接去选题', '能用，但地基没做完，内容会偏通用', TOPIC, false),
      ],
      intro: INTRO,
      tips: [
        '地基做完一次就够，之后全站都用它',
        '每一步都可以先用默认的，回头再细调',
        '地基没做完时，选题和脚本只能给通用答案',
      ],
      alert,
    };
  }

  if (works.length === 0) {
    return {
      stage: 'first_work',
      stageLabel: '准备开始',
      stageDesc: '地基已经打好，还没有生成过内容',
      progress: null,
      options: [
        opt('topic', '从选题开始', '先选好拍什么方向，再写脚本。第一次完整走一遍，后面会越来越顺', TOPIC, true),
        opt('review', '已经有写好的文案？直接去审稿', '把现成的稿子拿来审一遍，找出需要改的地方', '/dashboard/review', false),
      ],
      intro: INTRO,
      tips: [
        '第一次走完整链路会比较顺：选题 → 脚本 → 审稿',
        '生成完会自动体检，找不到依据的信息会标【待确认】，那是提醒你核对，不是出错',
        '每条内容做完，去作品库标一下拍摄或发布',
      ],
      alert,
    };
  }

  if (inProgress.length > 0) {
    const w = inProgress[0];
    const finished = doneStages(w.stages ?? []);
    const reviewed = finished.has('审稿优化');
    const next = STAGE_ORDER.find((s) => !finished.has(s)) ?? null;
    const readyToShoot = reviewed || next === null;
    const others = inProgress.length - 1;

    if (readyToShoot) {
      // 审稿优化完，就意味着要落地拍了：推荐同步创作进度，而不是再去生成
      const options = [
        opt('sync', '同步创作进度：标记已拍摄或已发布', '审稿优化过了，内容就该落地拍了。到作品库标记拍摄和发布，进度才准', WORKS, true),
      ];
      if (next) options.push(opt('title', `补做「${next}」`, '拍之前把标题和封面定下来（可选）', workStageUrl(w.id, next), false));
      options.push(opt('new', '开始新的一条', '这条先放着，从选题开始新的', TOPIC, false));
      return {
        stage: 'in_progress',
        stageLabel: '待拍摄',
        stageDesc: `「${w.title}」已经审稿优化，可以落地拍了${others > 0 ? `（还有 ${others} 条没做完）` : ''}`,
        progress: null,
        options,
        intro: INTRO,
        tips: [
          '拍摄、发布后，记得回来标记，数据才能回流',
          '同一条内容拍完再开新的，成品率更高',
        ],
        alert,
      };
    }

    return {
      stage: 'in_progress',
      stageLabel: '进行中',
      stageDesc: `「${w.title}」还没做完，下一步是「${next}」${others > 0 ? `（还有 ${others} 条没做完）` : ''}`,
      progress: null,
      options: [
        opt('continue', `接着做「${next}」`, `这条下一步是「${next}」，接着做比开新的快`, workStageUrl(w.id, next!), true),
        opt('works', '到作品库看看这条', '看看它现在做到哪一步，还能改什么', WORKS, false),
        opt('new', '开始新的一条', '这条先放着，从选题开始新的', TOPIC, false),
      ],
      intro: INTRO,
      tips: [
        '做完一条再开新的，成品率更高',
        '顶栏的「进行中」可以左右切换，不用回作品库找',
      ],
      alert,
    };
  }

  if (daysSince !== null && daysSince > STALE_DAYS) {
    return {
      stage: 'returning',
      stageLabel: '欢迎回来',
      stageDesc: `你上次操作是 ${Math.floor(daysSince)} 天前`,
      progress: null,
      options: [
        opt('new', '开始新的一条', '选一个题重新开始', TOPIC, true),
        opt('works', '翻翻作品库里的旧内容', '老内容可以接着改，或者拿来复用', WORKS, false),
        opt('positioning', '回账号定位看看方向还对不对', '账号方向变了，先校准定位，再开新的', '/dashboard/positioning', false),
      ],
      intro: INTRO,
      tips: [
        '老内容可以在作品库里翻出来再改',
        '账号定位隔一段时间回看一次，档案更新了就同步更新定位',
      ],
      alert,
    };
  }

  return {
    stage: 'active',
    stageLabel: '正常创作',
    stageDesc: '最近在用，节奏不错',
    progress: null,
    options: [
      opt('new', '做下一条', '从选题开始，一条一条往下做', TOPIC, true),
      opt('works', '到作品库标记拍摄或发布', '内容拍了或发了，标一下，数据才能回流', WORKS, false),
    ],
    intro: INTRO,
    tips: [
      '每条内容做完去作品库标一下拍摄、发布，数据才能回流',
      '发布后把数据填回来，选题会越来越准',
    ],
    alert,
  };
}

function buildAlert(quota: GuideInput['quota']): GuideOutput['alert'] {
  if (!quota) return null;
  const packs = quota.packCredits;
  if (quota.exhaustedFeature) {
    const packText = packs && packs > 0
      ? `次数包还有 ${packs} 次，会自动接着用`
      : '可以买尝鲜次数包接着用，也可以升级会员';
    return {
      text: `「${quota.exhaustedFeature}」本期额度用完了。${packText}`,
      href: '/dashboard/membership',
      cta: '看次数包和会员',
    };
  }
  return null;
}
