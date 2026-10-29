/**
 * 内容规划、创作方向写成了观点（2026-10-29 产品方：「每一个方向更像是一个观点」）。
 *
 * 真实输出：规划里「宝妈出门穿衣的顾虑」「买裤子时的尺码困惑」「让顾客慢慢试的态度」；
 * 方向展开的 10 个里有 7 个是「先留给谁 / 先顾哪类 / 怎么选」——同一道选择题换个生活处境再问。
 * 规则在 lib/direction-standard 的「好方向标准」，这里是体检：只提醒，不挡交付。
 */

/** 方向名用议题、态度词收尾 */
const OPINION_TAIL = /(顾虑|困惑|态度|取舍|两难|难题|落差|怎么选|怎么想|怎么分|观察|需求|共鸣|介绍|日常)[」』"”]?$/;
/**
 * 只抛一道题让观众选：先买谁、先顾哪类、怎么选。
 * 第四轮真实核验（10-29）：方向名都改成了看得见的东西（「帆布袋里的衣柜账」「试衣间外的三格衣篮」），
 * 但十个里有六个的看点还是「先补哪类」——道具换了，题没换。所以也认取舍、优先级、排序、先补、缺哪
 */
const CHOICE = /先(?:买|选|顾|留|补|放|花)(?:给|在)?(?:谁|哪)|怎么选|怎么分|选哪|选谁|投票|选择题|取舍|优先(?:级|顺序)|排序|先补|缺哪/;
/** 一批里选择题、投票类方向的上限（2026-10-29 产品方定：最多 3 个） */
export const MAX_CHOICE_DIRECTIONS = 3;

interface DirectionBlock { name: string; body: string }

function directionBlocks(output: string): DirectionBlock[] {
  return output
    .split(/\n(?=###\s*方向\s*\d+)/)
    .map((b) => b.trim())
    .filter((b) => /^###\s*方向\s*\d+/.test(b))
    .map((b) => ({ name: b.match(/^###\s*方向\s*\d+\s*[：:]\s*(.+)$/m)?.[1]?.replace(/\*\*/g, '').trim() ?? '', body: b }));
}

/** 方向的「看点」一栏（出发点里「看点：……」那一段） */
function hookOf(body: string): string {
  return body.match(/看点[：:]\s*([^｜|\n]+)/)?.[1] ?? '';
}

/** 方向的「内容方向」一栏 */
function scopeOf(body: string): string {
  return body.match(/内容方向\**\s*[：:]\s*([^\n]+)/)?.[1] ?? '';
}

/**
 * 第五轮真实核验（10-29）：展开的 10 个方向成了身体部位清单（肩背、腰头、衣长、袖口……），
 * 10 个都围绕货、都是「有用」，「正面 vs 侧面」「敞开 vs 拉合」被标成反差。下面三条认这三种。
 */
/** 流量方向才有「三有」：只认写了三有的那几个 */
const isTraffic = (b: DirectionBlock) => /三有[：:]/.test(b.body);
const aroundOf = (b: DirectionBlock) => (b.body.match(/围绕[：:]\s*\**\s*(人|货|场)/)?.[1] ?? '') as '' | '人' | '货' | '场';
const sanyouOf = (b: DirectionBlock) => {
  const v = b.body.match(/三有[：:]\s*\**\s*(有用|有趣|有兴趣|有共鸣)/)?.[1] ?? '';
  return v === '有兴趣' ? '有趣' : v;
};
/** 爆款元素那一段（到下一个「｜」） */
const elementOf = (b: DirectionBlock) => b.body.match(/爆款元素[：:]([^｜|\n]*)/)?.[1] ?? '';
/** 反差两边是视角、动作、挂着/穿上，或处境上的落差（「衣架很多」和「缺一件」）：变的不是货 */
const SAME_ITEM_CONTRAST = /同一件|正面|侧面|侧身|背面|视角|敞开|拉合|站立|站着|坐下|静止|动作|挂着|衣架上|衣架很多|落差/;
/** 写明换了货的不算（「同一个人、同样动作下更换不同裤子」） */
const GOODS_SWAPPED = /更换|换上|换成|两(?:条|件|样|款)|不同(?:的)?(?:裤子|外套|衣服|女装|货|款)/;

/**
 * 流量方向在证明成交理由（第七轮真实核验：「看衣服不能只看挂着效果」「先在店里通过动作确认」「怕买回去闲置」——
 * 都是在说「到店试穿有用」，那是变现型的活）。只看出发点和内容方向；sellingPoints 是档案的核心卖点，原样出现也算。
 */
// 「怕买错」「买回去闲置」是人群处境，流量型可以用，不算（拿第六轮原稿校过：算进去会误报）
const PROOF = /(?:到店|进店|现场|店里)[^｜|。\n]{0,8}(?:试穿|确认)|只看(?:挂着|衣架|图片|吊牌)/;

/**
 * 第十轮真实核验（10-29）：流量方向「同一个人穿不同版型外套」「大码裤子的不同轮廓」和变现方向「同一人、同一镜子更换不同商品」
 * 是同一种拍法；7 个流量方向只有 3 个带大码身份。下面两条认这两种。
 */
const SAME_PERSON_SWAP = /同一(?:个|位)?(?:人|出镜者|试穿者|出镜人)[^｜|。\n]{0,16}(?:换|更换)/;
/** 方向名 + 出发点（不看内容方向：那一栏写的是货，「旧款大码女装」不算带人群身份） */
const headOf = (b: DirectionBlock) => `${b.name}\n${b.body.match(/出发点[^\n]*/)?.[0] ?? ''}`;
/** 常见的人群身份词：档案的品类、赛道、人群兴趣、档案名里出现了，就当这个号的身份词 */
const IDENTITY_WORDS = ['大码', '微胖', '小个子', '高个子', '孕妇', '孕妈', '宝妈', '学生', '中老年', '老年', '儿童', '上班族', '新手'];
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[、，,；;]/) : []).map((s) => s.trim()).filter(Boolean);

/**
 * 这个号的人群身份词：只在品类、赛道、人群兴趣、档案名里认出明确的身份词（大码、孕妇……）时才算有，
 * 再加上档案的目标职业。认不出就返回空，不提醒。
 * 第十一轮真实核验：川味烧烤号的人群是「下班吃夜宵、朋友聚餐的本地人」，档案只有职业（学生、白领……），
 * 拿职业当身份词会把「地摊夜宵饭桌问答」这类本来就带人群的方向误报成没带身份
 */
export function identityTermsOf(profile: Record<string, unknown> | null | undefined): string[] {
  if (!profile) return [];
  const where = [profile.product_category, profile.account_track, profile.target_interests, profile.profile_name].map((v) => listOf(v).join('、')).join('、');
  const strong = IDENTITY_WORDS.filter((w) => where.includes(w));
  return strong.length ? [...new Set([...listOf(profile.target_occupation), ...strong])] : [];
}

const isMonetize = (b: DirectionBlock) => /成交理由[：:]/.test(b.body.match(/出发点[^\n]*/)?.[0] ?? '');

/**
 * 话题扎堆（第十二轮真实核验：大码号 7 个流量方向的名字里 5 个带「换季」）。
 * 看流量方向名里的两字词，同一个词出现在 3 个及以上方向名里就提醒。
 * 「片段」「现场」这类收尾词、这个号的身份词（大码、宝妈……）不算话题。
 */
const TOPIC_STOP = new Set(['片段', '现场', '画面', '记录', '过程', '瞬间', '日常', '方向', '系列', '真实', '门店', '店内', '店里', '时刻', '内容', '顾虑', '困惑', '态度', '取舍']);
// 返工核验（10-29）：原来只报最多的那个词，「换季」「衣柜」都是 3 个时只报了换季，返工改掉换季、衣柜还在。改成全报
function topicClusters(traffic: DirectionBlock[], identityTerms: string[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of traffic) {
    const name = b.name.replace(/[^一-鿿]/g, '');
    const seen = new Set<string>();
    for (let i = 0; i + 2 <= name.length; i++) seen.add(name.slice(i, i + 2));
    for (const w of seen) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([w, n]) => n >= 3 && !TOPIC_STOP.has(w) && !identityTerms.some((t) => t.includes(w) || w.includes(t)))
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }));
}

export function directionShapeIssues(output: string, sellingPoints: string[] = [], identityTerms: string[] = []): string[] {
  const blocks = directionBlocks(output);
  if (!blocks.length) return [];
  const issues: string[] = [];
  const traffic = blocks.filter(isTraffic);
  for (const c of topicClusters(traffic, identityTerms)) issues.push(`流量方向里有 ${c.count} 个都在讲「${c.word}」，同一个话题最多 2 个`);
  if (blocks.filter(isMonetize).some((b) => SAME_PERSON_SWAP.test(b.body))) {
    for (const b of traffic) {
      if (SAME_PERSON_SWAP.test(b.body)) issues.push(`流量方向「${b.name.slice(0, 20)}」和变现方向用的是同一种拍法（同一人换货），流量方向换一个看点`);
    }
  }
  const terms = identityTerms.filter((t) => t.length >= 2);
  if (terms.length && traffic.length >= 4) {
    const withIdentity = traffic.filter((b) => terms.some((t) => headOf(b).includes(t))).length;
    if (withIdentity * 2 < traffic.length) issues.push(`流量方向只有 ${withIdentity}/${traffic.length} 个带这群人的身份（${terms.slice(0, 4).join('、')}），至少要一半`);
  }
  for (const b of traffic) {
    const text = `${b.body.match(/出发点[^\n]*/)?.[0] ?? ''}\n${scopeOf(b.body)}`;
    const point = sellingPoints.find((s) => s.length >= 2 && text.includes(s));
    if (point || PROOF.test(text)) issues.push(`流量方向「${b.name.slice(0, 20)}」的看点在证明成交理由${point ? `「${point}」` : '（到店确认、买前先试这类）'}，这是变现型的活`);
  }
  const around = traffic.map(aroundOf).filter(Boolean);
  if (around.length >= 3) {
    const need = around.length >= 6 ? 2 : 1;
    const count = { 人: 0, 货: 0, 场: 0 } as Record<'人' | '货' | '场', number>;
    for (const a of around) count[a as '人' | '货' | '场']++;
    const short = (['人', '货', '场'] as const).filter((k) => count[k] < need);
    if (short.length) issues.push(`流量方向的人货场没搭开（人 ${count.人}、货 ${count.货}、场 ${count.场}），${short.join('、')}至少要 ${need} 个`);
  }
  for (const b of traffic) {
    const el = elementOf(b);
    if (el.includes('反差') && SAME_ITEM_CONTRAST.test(el) && !GOODS_SWAPPED.test(el)) {
      issues.push(`方向「${b.name.slice(0, 20)}」的反差变的是视角或动作，不是货（两边要是两样货、两类人或两个时代）`);
    }
  }
  // 三有只认三个词（第六轮真实核验：「三有：有参与感」）
  for (const b of traffic) {
    if (!sanyouOf(b)) issues.push(`方向「${b.name.slice(0, 20)}」的三有写的不是有用、有趣、有共鸣其中一个`);
  }
  const sanyou = traffic.map(sanyouOf).filter(Boolean);
  if (sanyou.length >= 4) {
    const useful = sanyou.filter((s) => s === '有用').length;
    if (new Set(sanyou).size < 2) issues.push(`流量方向的三有只用了「${sanyou[0]}」一种，至少要用到两种`);
    else if (useful * 2 > sanyou.length) issues.push(`流量方向里「有用」占了 ${useful}/${sanyou.length}，超过一半`);
  }
  for (const b of blocks) {
    if (OPINION_TAIL.test(b.name)) issues.push(`方向「${b.name.slice(0, 30)}」像一个议题或态度，不是一类看得见的内容`);
  }
  const choices = blocks.filter((b) => CHOICE.test(b.name) || CHOICE.test(hookOf(b.body)) || CHOICE.test(scopeOf(b.body)));
  if (choices.length > MAX_CHOICE_DIRECTIONS) {
    issues.push(`有 ${choices.length} 个方向只是抛一道选择题（${choices.slice(0, 4).map((b) => `「${b.name.slice(0, 16)}」`).join('')}…），一批最多 ${MAX_CHOICE_DIRECTIONS} 个`);
  }
  return issues;
}
