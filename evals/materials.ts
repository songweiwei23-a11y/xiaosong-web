/**
 * 每个节点的「本次输入」（2026-11-01，整改方案阶段 0.2）：无关信息检测拿输出到这里面找。
 * 评测（chain-eval）和重算（recompute）共用这一份，口径才一致。
 *
 * 只放用户材料：档案摘要、配比块（页面真的会传）、上游选中的内容、门店信息、原片。
 * 不放规则文字——规则里的举例（「12 条里 5 条」）会把真正新出现的数字遮住。
 */
export interface MaterialContext {
  summary: string;
  /** 百分比版配比块（定位、简报、起号、规划用） */
  mixBlock?: string;
  /** 带条数的配比块（方向、选题用） */
  mixBlockCount?: string;
  P?: string | null;
  B?: string | null;
  C?: string | null;
  CP?: string | null;
  DR?: string | null;
  T?: string | null;
  S?: string | null;
  topicLine?: string;
  /** 带去写脚本的那一条选题的正文（和线上选题页「带去写脚本」一样只带一条） */
  topicBody?: string;
  storeText?: string;
  viralSample?: string;
  benchmarkSample?: string;
  interviewNotes?: string;
  adviceInput?: string;
}

export function nodeMaterials(node: string, c: MaterialContext): string[] {
  const pick = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x && x.trim().length > 0);
  switch (node) {
    case '01-账号定位': return pick(c.summary, c.mixBlock);
    case '02-商业定位': return pick(c.summary, c.P);
    case '03-内容定位': return pick(c.summary, c.P, c.mixBlock);
    case '04-创作简报': return pick(c.summary, c.P, c.B, c.C, c.mixBlock);
    case '05-行业建议': return pick(c.summary, c.P, c.B, c.C, c.adviceInput);
    case '06-起号方案': return pick(c.summary, c.C, c.mixBlock);
    case '07-内容规划': return pick(c.summary, c.mixBlock);
    case '08-创作方向': return pick(c.summary, c.C, c.CP, c.mixBlockCount);
    case '09-选题': return pick(c.summary, c.DR, c.mixBlockCount);
    // 2026-11-01 起按线上交接只带一条选题（加上它来自的创作方向）；之前的评测带的是整份选题
    case '10-脚本': return c.topicBody ? pick(c.summary, c.topicBody, c.topicLine, c.DR, c.C ?? c.P) : pick(c.summary, c.T, c.topicLine, c.C ?? c.P);
    case '11-分镜': return pick(c.summary, c.S);
    case '12-标题封面': return pick(c.summary, c.topicLine, c.S);
    case '13-开篇钩子': return pick(c.summary, c.topicLine);
    case '14-审稿': return pick(c.summary, c.S);
    case '15-跨行业二创': return pick(c.summary, c.viralSample, c.storeText);
    case '16-拆解爆款': return pick(c.summary, c.viralSample);
    case '17-成交理由': return pick(c.summary, c.storeText);
    case '18-对标分析': return pick(c.summary, c.benchmarkSample);
    case '19-前采提取': return pick(c.interviewNotes);
    default: return pick(c.summary);
  }
}

/**
 * 选题输出里的第一个《标题》；没有就用档案的预设题目。
 * 只给重算 2026-11-01 之前的评测用：那时的评测就是这样取主题的（选题改成「## 选题1：标题」后总是落到预设题目）。
 */
export function topicLineOf(T: string | null | undefined, preset: string): string {
  return (T?.match(/《([^》]{4,60})》/)?.[1]) ?? preset;
}

const TOPIC_HEAD = /^#{2,3}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+/;

/** 选题输出按「## 选题N：标题」切成一条一条（标题里的序号、「选题N：」去掉） */
export function topicSections(T: string | null | undefined): { title: string; body: string }[] {
  if (!T) return [];
  return T.split(/(?=^#{2,3}\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+)/m)
    .filter((p) => TOPIC_HEAD.test(p))
    .map((p) => {
      const body = p.trim();
      const title = body.split('\n')[0].replace(/^#+\s*(?:✅\s*)?选题\s*[\d一二三四五六七八九十]+\s*[：:]?\s*/, '').replace(/【[^】]*】/g, '').trim();
      return { title, body };
    });
}
