/**
 * 标题生成的专业标准。
 *
 * 改造前，标题的整个提示词是五条通用要求：符合平台特点、使用某技巧、
 * 包含情绪钩子、控制在 15-25 字、标注核心卖点。页面上明明配了 12 种
 * 标题类型和 8 套公式，每一条都带着示例，但提示词里只塞了标签文字，
 * 公式结构和示例全部丢掉——等于让模型自己猜「数字+动词+结果」是什么意思。
 *
 * 更要命的是平台。抖音靠推荐流，标题的作用是三秒内制造点击冲动；
 * 小红书靠搜索，标题里必须埋关键词；B 站标题要留悬念但忌标题党。
 * 原提示词里平台只是一个被插值进去的字符串，模型对它做不出任何区分。
 *
 * 这里补上三样东西：平台各自的规则、公式的分段结构与范例、
 * 一套能自查的评判标准。
 */

/** 各平台的标题逻辑差异。同一个主题在不同平台该起不同的标题 */
const PLATFORM_RULES: Record<string, string[]> = {
  抖音: [
    '推荐流场景：用户是被动刷到的，标题要在 1 秒内制造点击冲动',
    '前 8 个字最重要——信息流里经常只显示这么多，钩子必须前置',
    '善用数字、对比、反常识；疑问句比陈述句点击率高',
    '长度 12-20 字为宜，太长会被截断',
  ],
  小红书: [
    '搜索场景为主：标题里必须自然嵌入用户真会去搜的词',
    '允许并鼓励用 emoji 分隔，但不超过 3 个',
    '第一人称、真实感强的表达更吃香（「我」「亲测」「踩坑」）',
    '长度 15-25 字，可以带一个副标题式的后缀',
  ],
  视频号: [
    '社交传播场景：标题要让人愿意转发给朋友，带点观点或情绪立场',
    '中年用户占比高，少用网络黑话，把话说明白',
    '长度 12-22 字',
  ],
  B站: [
    '标题党会被弹幕骂，承诺什么就要给什么',
    '可以更长、更具体，允许专业术语',
    '长度 15-30 字',
  ],
  快手: [
    '老铁文化：口语化、接地气，像跟人唠嗑',
    '真实、具体的生活场景比精致的文案更有效',
    '长度 12-20 字',
  ],
};

/**
 * 公式的分段蓝图。
 * 只给一个标签（「数字+动词+结果」）模型是照着造不出来的，
 * 得说清每一段放什么、为什么有效、正反例各一个。
 */
const FORMULA_BLUEPRINTS: Record<string, { structure: string; why: string; good: string; bad: string }> = {
  'number-action': {
    structure: '[具体数字] + [动作动词] + [可衡量的结果]',
    why: '数字提供确定感，结果提供收益预期，两者都降低了「值不值得看」的判断成本',
    good: '3个动作，让你的视频完播率翻一倍',
    bad: '几个提升完播率的小技巧（数字模糊、结果不可衡量）',
  },
  'time-twist': {
    structure: '[时间/年龄节点] + [身份] + [反转结果]',
    why: '时间节点建立代入感，反转制造「凭什么」的好奇',
    good: '35岁被裁员，我靠一部手机月入两万',
    bad: '中年人的逆袭故事（没有具体节点，没有反转张力）',
  },
  'pain-solution': {
    structure: '[用户的原话痛点] + [解决方案的钩子]',
    why: '痛点用用户自己的说法写出来，才会让人觉得「说的就是我」',
    good: '拍了半年没人看？问题出在开头这 3 秒',
    bad: '短视频运营技巧分享（没有痛点，没有指向性）',
  },
  'negative-positive': {
    structure: '[承认一个负面事实] + [转折] + [正面结论]',
    why: '先说负面能建立可信度，转折处产生信息落差',
    good: '这家店环境一般、服务也慢，但我一个月去了四次',
    bad: '一家很不错的店（没有张力，没有信息量）',
  },
  'why-reason': {
    structure: '为什么 + [一个反常识的现象] + [暗示有意外原因]',
    why: '反常识制造认知缺口，人会本能地想把缺口补上',
    good: '为什么点赞很高的视频，反而涨不了粉？',
    bad: '关于涨粉的一些思考（没有缺口，没有张力）',
  },
  'before-after': {
    structure: '[改变前的具体状态] vs [改变后的具体状态]',
    why: '可视化的落差是最直接的说服，适合有画面对比的内容',
    good: '同样的文案，改了 3 个字，播放量从 500 到 5 万',
    bad: '优化前后效果对比（两端都不具体）',
  },
  'secret-reveal': {
    structure: '[圈内人视角] + [外行不知道的判断依据]',
    why: '信息不对称带来价值感',
    good: '干了十年装修，我只看这 3 个地方就知道值不值',
    bad: '装修行业内幕大曝光（空洞，且容易被同行举报）',
  },
  'warning-tip': {
    structure: '千万别 + [具体行为] + [否则会付出的具体代价]',
    why: '损失厌恶比收益承诺更能驱动点击',
    good: '签合同前千万别交定金，我这一下亏了八千',
    bad: '一些需要注意的事项（没有代价，没有紧迫感）',
  },
};

/**
 * 产品级禁忌。
 * 「揭秘」一词在账号定位模块里已经被明令禁止（容易招同行诋毁、也容易被平台限流），
 * 标题模块此前不知道这条规矩——同一个产品里两套口径。
 */
const FORBIDDEN_WORDS = [
  { word: '揭秘', why: '容易招同行举报，也容易被判定为夸大', instead: '教你看懂、带你了解、对比分析' },
  { word: '震惊', why: '典型标题党用词，平台会降权', instead: '用具体数字替代情绪词' },
  { word: '第一/最好/最强', why: '绝对化用语违反广告法，会被限流', instead: '我用过最顺手的、我个人最推荐的' },
  { word: '100%/彻底根治', why: '绝对化承诺，有违规风险', instead: '大多数情况下、我这几次都有效' },
];

export interface TitlePromptParams {
  topic: string;
  /** 标题类型的中文标签，如「痛点式」 */
  titleTypeLabel: string;
  /** 公式的 value，如 'number-action' */
  titleFormulaValue: string;
  /** 公式的中文标签 */
  titleFormulaLabel: string;
  keywordStrategyLabel: string;
  keywordStrategyDesc: string;
  platform: string;
  targetAudience: string;
  count: number;
}

export function buildTitlePrompt(p: TitlePromptParams): string {
  const parts: string[] = [];

  parts.push('# 短视频标题创作');
  parts.push('');
  parts.push('你是一位专做爆款标题的短视频编导，日常工作就是给同一条内容写出多个');
  parts.push('可以拿去 A/B 测试的标题，并说清每个标题赌的是哪一类用户的点击动机。');
  parts.push('');

  parts.push('## 🎬 视频主题');
  parts.push('');
  parts.push(p.topic);
  parts.push('');

  parts.push('## ⚙️ 本次要求');
  parts.push(`- 标题类型：${p.titleTypeLabel}`);
  parts.push(`- 使用公式：${p.titleFormulaLabel}`);
  parts.push(`- 关键词策略：${p.keywordStrategyLabel}（${p.keywordStrategyDesc}）`);
  parts.push(`- 发布平台：${p.platform}`);
  if (p.targetAudience) parts.push(`- 目标人群：${p.targetAudience}`);
  parts.push(`- 生成数量：${p.count} 个`);
  parts.push('');

  // 公式蓝图。这是原提示词最大的缺口：只给标签，模型只能靠猜
  const blueprint = FORMULA_BLUEPRINTS[p.titleFormulaValue];
  if (blueprint) {
    parts.push(`## 📐 公式拆解：${p.titleFormulaLabel}`);
    parts.push('');
    parts.push(`**结构**：${blueprint.structure}`);
    parts.push(`**为什么有效**：${blueprint.why}`);
    parts.push(`**达标示例**：${blueprint.good}`);
    parts.push(`**不达标示例**：${blueprint.bad}`);
    parts.push('');
    parts.push('照着这个结构写，但每个标题都要跟本次主题强相关，不要套用示例里的行业。');
    parts.push('');
  }

  // 平台规则
  const rules = PLATFORM_RULES[p.platform];
  if (rules) {
    parts.push(`## 📱 ${p.platform}的标题逻辑`);
    parts.push('');
    for (const r of rules) parts.push(`- ${r}`);
    parts.push('');
  }

  parts.push('## 🚫 违规与风险词');
  parts.push('');
  for (const f of FORBIDDEN_WORDS) {
    parts.push(`- **禁用「${f.word}」**：${f.why}。改用：${f.instead}`);
  }
  parts.push('');

  parts.push('## 📏 每个标题的自查项（不达标就重写，不要输出不达标的）');
  parts.push('');
  parts.push('1. **前 8 个字是否已经有钩子**——信息流里经常只显示这么多');
  parts.push('2. **有没有一个具体的锚点**——数字、时间、身份、场景，四者至少占一个');
  parts.push('3. **是否避免了形容词堆砌**——「很棒」「超赞」「绝了」不算信息');
  parts.push('4. **换个人能不能用**——如果这个标题套在任何视频上都成立，它就太空了');
  parts.push('5. **是否命中风险词**');
  parts.push('');

  parts.push('## 📤 输出格式');
  parts.push('');
  parts.push(`请输出 ${p.count} 个标题，**每个标题赌的点击动机必须不同**，`);
  parts.push('这样 A/B 测试才有意义——同一个套路换几个词不算多个方案。');
  parts.push('');
  parts.push('每个标题按下面的格式写：');
  parts.push('');
  parts.push('```');
  parts.push('### N. 标题原文');
  parts.push('- **字数**：X 字');
  parts.push('- **赌的动机**：好奇 / 恐惧 / 获得感 / 认同 / 窥私 / 省钱（选一个，并说明为什么这类人会点）');
  parts.push('- **核心卖点**：这条视频真正要交付的东西');
  parts.push('- **埋的关键词**：（搜索型策略必填，其他可写"无"）');
  parts.push('- **适合场景**：什么情况下优先用这一个');
  parts.push('```');
  parts.push('');
  parts.push('最后追加一段：');
  parts.push('');
  parts.push('### 🎯 投放建议');
  parts.push('- **首选**：哪一个，为什么');
  parts.push('- **备选**：数据不好时换哪一个，观察哪个指标做判断');
  parts.push('- **封面配合**：封面上应该出现的 4-6 个大字（与标题互补，不要重复标题）');
  parts.push('');
  parts.push('⚠️ 直接输出标题，不要写「以下是我为你准备的」这类开场白。');

  return parts.join('\n');
}
