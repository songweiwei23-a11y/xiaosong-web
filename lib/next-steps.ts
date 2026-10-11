/**
 * 下一步建议（2026-10-12）：每个板块生成完，按编导的创作顺序告诉用户「接下来去哪、为什么」，按优先级排。
 *
 * 编导的顺序：先定位和方向 → 选题（拍什么）→ 脚本（怎么说）→ 审稿（先核对事实和时长）→ 分镜（怎么拍）→ 标题封面（怎么发）。
 * 拆解的目的是二创：拆解完优先用二创结构写脚本、选题，视频再拆分镜。
 * 没有档案时，定位类和二创的结果不会套到你的账号上，提示先选档案。
 *
 * 纯函数：只看板块和结果里能认出来的信号，不调用模型。
 */
import type { CreationTarget } from './creation-flow';

export interface NextStepFacts {
  hasProfile: boolean;
  /** 结果里还有【待确认】占位：说明还有没核实的事实 */
  hasPlaceholder: boolean;
  /** 结果里已经有口播或脚本正文 */
  hasScript: boolean;
  /** 结果里已经有镜头或分镜 */
  hasShots: boolean;
  /** 拆解出了二创结构（模版） */
  hasStructure: boolean;
  /** 这是视频类内容（要拍，要分镜） */
  isVideo: boolean;
}

export interface NextStep {
  target: CreationTarget;
  /** 1 = 最适合；数字越大越靠后 */
  priority: number;
  reason: string;
}

export interface NextStepPlan {
  steps: NextStep[];
  /** 不是按钮、只是提醒的一句话（比如没选档案） */
  hint?: string;
}

interface Rule { t: CreationTarget; why: string; when?: (f: NextStepFacts) => boolean }

const RULES: Record<string, Rule[]> = {
  breakdown: [
    // 拆解的目的是二创：拆出结构后第一步去跨行业二创，1:1 复刻或裂变成多个版本
    { t: 'remix', why: '用二创结构 1:1 复刻，或按你勾的拆解知识裂变成多个版本，结构不变、题材换成你的', when: (f) => f.hasStructure },
    { t: 'script', why: '用二创结构 1 的分段和台词写成能照着念的口播，结构不变、题材换成你的', when: (f) => f.hasStructure },
    { t: 'topic', why: '用这套结构找几个同类题材，先选定拍什么', when: (f) => f.hasStructure },
    { t: 'storyboard', why: '这条是视频，二创之后按镜头拍，先把镜头定下来', when: (f) => f.hasStructure && f.isVideo },
    { t: 'topic', why: '还没有二创结构：先把原片的爆点拆成可以拍的选题', when: (f) => !f.hasStructure },
    { t: 'script', why: '选好题之后再写脚本', when: (f) => !f.hasStructure },
  ],
  topic: [
    { t: 'script', why: '选一条最有把握的选题，写成脚本' },
    { t: 'growth', why: '前 3 秒决定能不能留住人，先把开头打磨好' },
    { t: 'title', why: '选题定了，给发布用的标题和封面' },
  ],
  direction: [
    { t: 'topic', why: '方向定了，把它拆成具体选题' },
    { t: 'script', why: '如果方向已经很清楚，可以直接写一条脚本' },
  ],
  script: [
    { t: 'review', why: '还有【待确认】或没有出处的说法，先核对再拍', when: (f) => f.hasPlaceholder },
    { t: 'storyboard', why: '脚本定了，拆成镜头才能拍', when: (f) => f.isVideo && !f.hasShots },
    { t: 'review', why: '先查时长和事实，再进入分镜', when: (f) => !f.hasPlaceholder },
    { t: 'title', why: '内容定了，给发布用的标题和封面' },
  ],
  storyboard: [
    { t: 'review', why: '检查分镜和台词是否一致，有没有没出处的说法' },
    { t: 'title', why: '封面和标题跟着镜头来定' },
  ],
  review: [
    { t: 'storyboard', why: '改完的稿子拆成镜头', when: (f) => !f.hasShots },
    { t: 'script', why: '还有待确认的内容，按审稿意见回到脚本再改一版', when: (f) => f.hasPlaceholder },
    { t: 'title', why: '稿子定了，给标题和封面' },
  ],
  title: [
    { t: 'script', why: '标题定了，写正文脚本', when: (f) => !f.hasScript },
    { t: 'review', why: '发布前再过一遍事实和时长' },
  ],
  growth: [
    { t: 'script', why: '开头定了，用它写完整脚本' },
    { t: 'review', why: '写完后先审稿，再拍' },
  ],
  remix: [
    { t: 'script', why: '用二创方案写脚本，结构不变、题材换成你的' },
    { t: 'topic', why: '先找几个同结构的选题' },
    { t: 'storyboard', why: '方案定了，拆成镜头', when: (f) => f.isVideo },
  ],
  positioning: [
    { t: 'topic', why: '定位清楚了，去选题' },
    { t: 'content-positioning', why: '接着定内容方向' },
  ],
  'content-positioning': [
    { t: 'topic', why: '内容方向定了，选题就有了依据' },
    { t: 'growth', why: '接着做起号方案' },
  ],
  'business-positioning': [
    { t: 'deal-reason', why: '成交路径清楚了，去找成交理由' },
    { t: 'topic', why: '再围绕成交去选题' },
  ],
  'creative-brief': [
    { t: 'topic', why: '简报是选题的依据' },
    { t: 'script', why: '也可以直接写脚本' },
  ],
  'deal-reason': [
    { t: 'topic', why: '成交理由定了，选题围绕它来' },
    { t: 'script', why: '也可以直接写脚本' },
  ],
  knowledge: [
    { t: 'topic', why: '把知识点落到选题上' },
    { t: 'script', why: '或者直接写脚本' },
  ],
  'free-chat': [
    { t: 'review', why: '先核对回答里的事实' },
    { t: 'script', why: '有明确选题就写脚本' },
  ],
  'content-plan': [
    { t: 'direction', why: '先定每条的方向' },
    { t: 'topic', why: '再细化选题' },
  ],
};

const DEFAULT_RULES: Rule[] = [
  { t: 'topic', why: '先定拍什么' },
  { t: 'script', why: '再写怎么说' },
];

/** 需要账号才有意义的板块：没有档案时提醒先选 */
const NEEDS_PROFILE = new Set(['breakdown', 'positioning', 'content-positioning', 'business-positioning', 'creative-brief', 'deal-reason', 'remix']);

export function nextSteps(source: string, facts: NextStepFacts): NextStepPlan {
  const rules = RULES[source] ?? DEFAULT_RULES;
  const picked = rules.filter((r) => !r.when || r.when(facts));
  const seen = new Set<string>();
  const steps: NextStep[] = [];
  for (const r of picked) {
    if (seen.has(r.t)) continue;
    seen.add(r.t);
    steps.push({ target: r.t, priority: steps.length + 1, reason: r.why });
    if (steps.length === 3) break;
  }
  const hint = !facts.hasProfile && NEEDS_PROFILE.has(source)
    ? '还没选账号档案：这份结果只按通用思路给，选好档案后会套到你的账号上'
    : undefined;
  return { steps, hint };
}

/** 从结果正文里认出几个事实信号；板块已经知道的（比如结构）由调用方另外传入 */
export function factsFromBody(body: string, source: string, hasProfile: boolean, extra: Partial<NextStepFacts> = {}): NextStepFacts {
  return {
    hasProfile,
    hasPlaceholder: /【待确认/.test(body),
    hasScript: /第\s*2\s*步|纯文字文案|口播|优化后的完整脚本|台词/.test(body),
    hasShots: /镜头\s*\d|分镜|\|\s*镜头/.test(body),
    hasStructure: /二创结构|模版\s*\d|"segments"/.test(body),
    isVideo: /镜头|分镜|拍摄/.test(body) || source === 'storyboard' || source === 'remix',
    ...extra,
  };
}
