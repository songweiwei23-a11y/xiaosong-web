/**
 * 审稿的改动范围：先看编导的个人要求点名了什么，只在这个范围里动笔。
 *
 * 【为什么要有这个】线上实测：编导只要求「口语化一些」，审稿却把开头钩子、意境、整段结构全改了。
 * 原因是「个人要求优先级最高」只说了优先级，没说范围；没说范围，模型就把"口语化"理解成可以整篇重写。
 * 所以把要求拆成类别，每一类写明只改什么；范围外的内容一律原样保留。
 *
 * 类别用关键词识别（只是提示模型的分类，不替模型做判断）；识别不出来的，要求模型自己先写清范围再改。
 */

export type ReviewScope = 'colloquial' | 'facts' | 'duration' | 'marketing' | 'opening' | 'rhythm';

export interface ReviewScopeRule {
  scope: ReviewScope;
  label: string;
  test: RegExp;
  rule: string;
}

export const REVIEW_SCOPE_RULES: ReviewScopeRule[] = [
  {
    scope: 'colloquial',
    label: '口语化',
    test: /口语|说话|口吻|拗口|书面|接地气|像人说|念起来/,
    rule: '只把书面腔、拗口、像念稿的句子改成作者能自然说出口的话。意思不变，不换场景，不增删段落，不加新的事实或动作。',
  },
  {
    scope: 'facts',
    label: '改错误',
    test: /写错|写成|错了|不对|错误|价格|数字|年限|事实|应该是|改成/,
    rule: '只改个人要求点名的那几处（错的数字、事实、称呼），改成要求的内容；其它句子一字不动。',
  },
  {
    scope: 'duration',
    label: '调时长',
    test: /时长|太短|太长|秒|分钟|缩短|扩充|加长|压缩/,
    rule: '只按要求增删内容：删的先从重复和解释过满的句子开始；扩充只用原稿已有的素材深化，缺素材写【待补】，不编情节。钩子和意境保留。',
  },
  {
    scope: 'marketing',
    label: '去营销腔',
    test: /营销|广告|推销|硬广|套路|带货/,
    rule: '只改带营销味的句子（硬推销、催促、夸张承诺），换成平实的说法；其它句子不动。',
  },
  {
    scope: 'opening',
    label: '改开头',
    test: /开头|开场|钩子|前三秒|前 3 秒|前3秒/,
    rule: '只改开头这几句，正文和结尾不动。',
  },
  {
    scope: 'rhythm',
    label: '调节奏',
    test: /节奏|停顿|断句|啰嗦|重复|拖沓/,
    rule: '只调整句子长短、断句和停顿位置，不改内容和用词。',
  },
];

/** 不论个人要求写什么，这些都不动（除非个人要求点名要改，比如"改开头"则开头可改） */
export const ALWAYS_PROTECTED = [
  '开头钩子（编导没点名改开头时）',
  '意境和氛围',
  '结构和段落顺序',
  '人物原话和访谈回答',
  '结尾的收束句',
  '有依据的数字和事实（档案、材料或编导的要求里有；没有依据的见事实依据预检，不在保护之列）',
];

export interface ReviewScopePlan {
  request: string;
  matched: ReviewScopeRule[];
}

export function reviewScopePlan(request: string | undefined): ReviewScopePlan {
  const text = (request ?? '').trim();
  const matched = text ? REVIEW_SCOPE_RULES.filter((r) => r.test.test(text)) : [];
  return { request: text, matched };
}

/**
 * 写进提示词的「本轮改动范围」块。
 * 没有个人要求：只修问题清单里有依据的句子。
 * 有要求但识别不出类别：让模型先用一句话写清它理解的范围，只在这个范围里改。
 */
export function reviewScopeBlock(request: string | undefined): string {
  const plan = reviewScopePlan(request);
  const lines: string[] = ['## 🎯 本轮改动范围（先定范围，再动笔）', ''];
  if (!plan.request) {
    lines.push('编导没有额外要求：只修问题清单里有依据的句子，其余原样保留。');
  } else {
    lines.push(`编导的要求：「${plan.request}」`);
    lines.push('');
    if (plan.matched.length) {
      lines.push(`识别为：${plan.matched.map((r) => r.label).join('、')}`);
      for (const r of plan.matched) lines.push(`- ${r.label}：${r.rule}`);
    } else {
      lines.push('这条要求没有落在常见类别里。先用一句话写清你理解的改动范围（写在总评的「本轮改动范围」里），再只在这个范围里改。拿不准就只改最明显的问题句。');
    }
  }
  lines.push('');
  lines.push('**范围外一律原样保留**，包括：' + ALWAYS_PROTECTED.join('、') + '。');
  lines.push('要求没点名的问题，不改，也不列进问题清单；可以放进「值得保留」或文案外的建议里提一句。');
  return lines.join('\n');
}
