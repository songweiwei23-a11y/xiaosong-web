/**
 * 自动质检（2026-10-03）：每次生成完都体检一遍，记一笔，后台看板看趋势；每晚再拿固定档案回归一次。
 *
 * 查的都是这几天线上真出过的事，规则复用已有的扫描，不另起一套：
 * - taboo      踩禁忌（平台红线 + 行业禁忌词，lib/taboos 的 scanTaboos）
 * - excluded   漏出排除清单里的东西（建档时没选的，lib/interview-exclusions）
 * - mix        配比条数对不上（选题、方向按配比出时，lib/content-mix 的 checkMix）
 * - years      年限和人设事实卡打架（「南乐 18 年」那次：事实卡写半年，结果写 18 年）
 *
 * 纯函数：浏览器（实时体检）和服务器（每晚回归）共用。
 */
import { scanTaboos } from './taboos';
import { findExcludedMentions } from './interview-exclusions';
import { readTabooSettings } from './taboos';
import { readPersonaFacts } from './persona-facts';
import { checkMix, type ResolvedMix } from './content-mix';

export type QualityKind = 'taboo' | 'excluded' | 'mix' | 'years' | 'generation' | 'facts';

export const QUALITY_LABELS: Record<QualityKind, string> = {
  taboo: '踩禁忌',
  excluded: '用了排除的信息',
  mix: '配比对不上',
  years: '年限和人设事实卡不符',
  generation: '生成未完成或内容缺失',
  facts: '关键事实没有出处（价格、百分比、顾客见证、经营承诺、资历、数据、地点）',
};

/**
 * 关键事实核对（2026-10-04）：结果里出现的价格、地名、资历荣誉、"据统计"这类说法，档案和这次的素材里都找不到，就标出来请人核对。
 *
 * 只做"有没有出处"的比对，不判断真假：档案里写了 38 元、素材里有濮阳，结果照用就不报；
 * 模型自己编出来的"人均 68""开了 5 家分店""据统计 80% 的人"会报。
 * 局限：同义说法（"三十八块" vs "38 元"）、档案外但用户口头说过的事实会误报；它是提醒，不是事实核验系统。
 * 只查创作类板块：拆解是在分析别人的视频，出现原片里的价格地名是正常的。
 */
export const FACT_CHECK_TASKS = new Set(['脚本生成', '审稿优化', '分镜脚本', '标题封面', '开篇钩子', '跨行业二创', '选题策划', '起号方案', '创作方向', '内容规划']);
/**
 * 自由对话（2026-10-05 质量整改）：什么都能问，回答里给建议价格、做促销方案是正常的，所以只查
 * 「冒充事实」的几类：百分比、顾客见证、「据统计」、模型自称自检通过。
 */
export const LIGHT_FACT_CHECK_TASKS = new Set(['自由对话']);

const CN_DIGIT: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 「三十八」→ 38，认不出返回 null（够用就行：价格、分店数都在一百以内居多） */
function cnNumber(s: string): number | null {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^([一二两三四五六七八九])?(十)?([一二三四五六七八九])?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  if (!m[2]) return m[1] ? CN_DIGIT[m[1]] : CN_DIGIT[m[3]!];
  return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[3] ? CN_DIGIT[m[3]] : 0);
}

const PRICE_RE = /(?:¥\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})\s*(?:元|块钱|块(?![\p{L}])))/gu;
// 「区间、区域、区别、区分、区块」不是地名（2026-10-08 发布后复测：「相同时间区间」「最佳完播区间」被当成地名）
const PLACE_RE = /([\p{Script=Han}]{2,4})(?:市|县|镇|乡|村|区(?!间|域|别|分|块))(?![\p{Script=Han}]{0,1}(?:场|长|民|委|政府|级))/gu;
const HONOR_RE = /(?:(\d+|[一二两三四五六七八九十]{1,3})\s*家(?:分店|门店|连锁)|(?:\d+|[一二两三四五六七八九十]{1,3})\s*年(?:的)?老店|老字号|非遗|获奖|冠军|金奖|排名第一|销量第一|全网第一|全国第一|全市第一|百年老店)/g;
// 「依据（检测报告」「根据实际数据调整」不是在引用统计（2026-10-09 修复后复测误报）
const STAT_RE = /(?:(?:(?<![依证根])据|根据(?=[^，。！？\n]{0,6}(?:统计|调查)))(?!实际|自己|你的|你自己|真实|后台|前几条)[^，。！？\n]{0,10}(?:统计|调查|报告|数据)|数据显示|研究表明|调查显示|有数据(?:显示|表明)|权威机构)/g;
/** 我每天 / 天天 + 几点：作息（「每天早上五点到店」） */
const LIFE_SCHEDULE_RE = /我(?:每天|天天|每天早上|每天晚上|每天凌晨)[^，。！？,.!?\n]{0,6}?((?:早上|凌晨|晚上|下午)?[0-9一二三四五六七八九十]{1,3}点)/g;
/** 我 / 我家的家人 + 具体的事：生病、上学、离世、欠钱（「我妈住院那年」「我女儿考上大学」） */
const LIFE_FAMILY_RE = /我(?:家)?(孩子|儿子|女儿|老婆|媳妇|老公|爸|妈|父母|爷爷|奶奶|姥姥|姥爷)[^，。！？,.!?\n]{0,12}?(?:生病|病了|住院|手术|去世|走了|欠|借钱|学费|上学|考上|毕业|离婚|结婚)/g;
/** 我 / 我们家 + 钱的处境：欠债、存款、贷款（「我欠了二十万」） */
const LIFE_MONEY_RE = /(?:我|我们家)[^，。！？,.!?\n]{0,6}?(欠了|借了|存款|积蓄|贷款)[^，。！？,.!?\n]{0,10}/g;
/** 这一行自己带了出处：「来源：」「出处：」、网址、[1] / 【1】这类引用编号 */
const CITED_LINE = /来源[：:]|出处[：:]|https?:\/\/|\[\d+\]|【\d+】|\[来源/;
/** 这些"区"不是地名 */
const NOT_PLACE = /^(?:评论|弹幕|直播|后厨|用餐|就餐|等候|办公|休息|商|景|社|小|市|城|老城|新城|开发|功能|服务|片|郊|山|园|校|营业|核心|中心|热门|黄金|繁华|误|盲|雷|禁|灾|重灾|保护|无人|安全|危险|舒适)$/;
/** 「挂衣区」「收银区」「儿童区」：以这些字结尾的是店里的功能区，不是地名（2026-10-05 质量研究复现的误报） */
// 2026-10-09 实测补：家具店的「餐桌区 / 床区 / 沙发区 / 茶几区」也是功能区
const FUNCTION_AREA = /(?:衣|货|台|位|座|架|柜|物|纳|车|诊|餐|厨|洗|浴|卧|厅|房|室|吧|展|陈列|体验|互动|游戏|烟|操作|工作|生活|阅读|休闲|儿童|收银|等候|试|拍照|打卡|候|装|品|料|菜|样|材|具|工|桌|床|发|几|椅|凳|垫|灯|镜|毯|帘|子|约|风)$/;
/** 拍摄、剪辑指令里的百分比（「语速慢 20%」「音量调低 30%」）不是事实数据 */
/** 「占全片 79% 的镜头」：说的是这份分镜自己的镜头占比 */
const SHOOT_PERCENT_AFTER = /^\s*(?:的)?(?:镜头|画面|时长|篇幅)/;
const SHOOT_PERCENT_BEFORE = /语速|音量|音乐|亮度|速度|放慢|加快|调低|调高|缩放|放大|缩小|裁切|透明|饱和|曝光|比日常|比平时|慢|快/;
/**
 * 编出来的客户故事（2026-10-09 全板块实测：16 个板块里 5 个写了「前两天来了对小夫妻」「上周来了一个客人」）：
 * 时间 + 来了 + 一对 / 一位 / 两拨客人
 */
const CUSTOMER_STORY_RE = /(?:前两天|前几天|上周|上个月|昨天|今天上午|今天下午|今天|那天|有一次|国庆过完第[一二三四五六七八九十\d]+天|节后第[一二三四五六七八九十\d]+天)[^，。！？\n]{0,8}?来了(?:一|两|几|个)?(?:对|位|个|拨|家|批)[^，。！？\n]{0,14}|(?:这个|那个|有个)(?:客人|顾客|客户)[^，。！？\n]{0,4}我认识(?:他|她)?[一二两三四五六七八九十\d]+年/g;
/**
 * 替老板定的经营做法（实测：「报价就是底价，砍我也不降」「直接跟厂家拿货，省了三层代理商的钱」「比网上还便宜」「价格能多留点空间」）
 */
const POLICY_RE = /报价就是底价|(?:从来|一律)?不(?:讲|还|砍)价|砍(?:我)?也不降|(?:直接)?(?:跟|从)厂家?(?:直接)?拿货|厂家直(?:供|销|发)|工厂直(?:供|销)|省了?[一二两三四五六七八九十\d]+(?:层|道)(?:代理|中间|经销)|没有中间商|比网上(?:还|更)?便宜|价格上?(?:确实)?(?:能|可以)?(?:给你)?多留(?:点|一点)?空间|(?:入户|送货|安装)[^，。！？\n]{0,6}(?:不对|不满意)[^，。！？\n]{0,6}(?:帮你|给你)(?:调|换|退)/g;
/**
 * 编出来的效果基准（实测：「完播率低于 40%（抖音同类口播视频基准）」「关注转化低于 3%」「每周核销 5 单以上 = 跑通」）
 */
const BENCHMARK_RE = /(?:完播率?|5\s*秒完播|关注转化|转化率|互动率|点赞率|跳出率|关注率)[^，。！？\n]{0,8}?(?:低于|高于|超过|达到|不到|不足)\s*\d+(?:\.\d+)?\s*[%％]|每周[^，。！？\n]{0,10}?\d+\s*单(?:以上)?\s*[=＝]?\s*跑通|(?:抖音)?同类[^，。！？\n]{0,8}基准/g;
/** 百分比：「90%」「百分之九十」「九成的业主」（2026-10-05：原来只认带「据统计」的，裸百分比漏了） */
const PERCENT_RE = /(\d+(?:\.\d+)?)\s*[%％]|十(?:个|家|人)(?:里)?有[七八九](?:个|家|人)?|百分之[一二两三四五六七八九十百]+|([一二三四五六七八九])成(?=的|以上|左右|多|人|顾客|客|用户|业主|家长|学员|粉丝)/g;
/** 顾客见证：「很多客人说」「有位顾客告诉我」「粉丝都说」——没给过故事却写成真事 */
const TESTIMONIAL_RE = /(?:很多|好多|不少|许多|有位|有个|有一位|有一个|一位|一个|上周|昨天|前几天|之前|老)(?:老)?(?:客人|顾客|客户|粉丝|业主|家长|学员|宝妈|会员|食客|买家)(?:都|就|还|专门|特意|跑来|过来)?(?:说|讲|告诉|跟我说|反馈|夸|评价|留言|感叹|吐槽)|(?:客人|顾客|客户|粉丝|业主|家长|学员|食客|买家)(?:都说|纷纷|一致|普遍|常说|总说|反馈说)/g;
/** 经营承诺：送、包、保证、折扣——没说过就不能替老板答应 */
const PROMISE_RE = /(?:免费(?:送|赠|领|试|上门|设计|测量|安装|体验|品尝|续|加)|赠送(?!计)|买[一二两三\d]+送[一二两三\d]+|送[一二两三四五六七八九十\d]+(?:份|个|杯|串|瓶|次|张|件)|包邮|包退|包换|包教包会|包安装|包售后|无效退款|不满意(?:全额)?退|终身(?:保修|维修|免费|质保)|保修[一二两三四五六七八九十\d]+年|打[一二三四五六七八九\d](?:\.\d)?折|满\d+减\d+|优惠券|首单立减|限时特价)/g;
/**
 * 「X区」不是地名的（2026-10-05 第二阶段对比实测误报：一道题标出「常见误区」「被褥区」「分区」「样柜展示区」6 个假地名）：
 * 名字里带「的」，或者最后一个字和「区」连起来是个普通词（误区、分区、专区、园区、景区、地区……）
 */
const AREA_NOUN_TAIL = /[误分专园社展示厂景城市郊山地辖片校灾雷盲禁小商街新老营功能用常款式域储收纳候待褥衣柜货售验列一个每]$/;
/**
 * 「X市 / X乡 / X村 / X镇」里的普通词（第二轮对比实测误报：「这个城市」「其他城市」「夜市」「成都老乡」）：
 * 名字最后一个字和后缀连起来是个普通词，就不是地名
 */
const SUFFIX_NOUN_TAIL: Record<string, RegExp> = {
  市: /[城夜超菜集门早黑股闹上开花]$/,
  乡: /[老家故同下城水他异外]$/,
  村: /[乡农山渔新]$/,
  镇: /[城坐]$/,
  县: /[郡州]$/,
};
/** 「没有"全网第一"这类绝对化用语」是在说避开了，不是在吹 */
const NEGATION_BEFORE = /没有|不说|不用|别说|避免|不能|禁止|不许|杜绝|去掉|删掉|删除|不写|不提|不是|并非|并不是/;
/** 「拿起一块」「切一块」：中文数字 + 块 多半是量词；前面有价格字眼才当价格 */
const PRICE_WORD_BEFORE = /价|卖|只要|才|花|收|仅|一共|总共|一份|一串|一碗|一位|人均|起步|元/;

/** 内容配比（流量型 60% / 人设型 25%）是我们自己给的比例，不是统计数据 */
const MIX_LINE = /配比|人群兴趣|品类内容|泛话题|流量型|人设型|变现型|占比|比例|流量破圈|人设温度|主赛道|内容类型|更新频率|纯流量|建立信任|蹭热点/;
/** 「警惕所谓『免费设计』套路」是在提醒，不是老板答应送 */
const WARNING_BEFORE = /套路|陷阱|坑|骗|小心|别信|所谓|号称|打着|警惕|假的|忽悠/;
/** 「不承诺免费上门测量」「不建议增加“免费测量”」：是提醒别这么做，不是承诺（2026-10-08 发布后复测误报） */
const PROMISE_NEGATED = /不承诺|不要承诺|别承诺|不建议|不提供|不做|不能|不许|不要|禁止|避免|去掉|删掉|不写|不提|不加|别加/;

/** 去掉模型自己写的「自检 / 核对清单」：那里列的年限、数字是它在复述事实，不是交付内容（自称自检通过照样单独查） */
export function stripSelfCheck(output: string): string {
  const lines = output.split('\n');
  const keep: string[] = [];
  let skipLevel = 0;
  for (const line of lines) {
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) {
      if (skipLevel && h[1].length <= skipLevel) skipLevel = 0;
      if (!skipLevel && /自检|自查|核对|校验|检查清单|事实确认/.test(h[2])) { skipLevel = h[1].length; continue; }
    }
    if (skipLevel) continue;
    if (/^\s*[-*•]?\s*\**\s*(?:自检|自查|事实核对)\**\s*[：:]/.test(line)) continue;
    keep.push(line);
  }
  return keep.join('\n');
}

/** 模型给自己发的合格证：以程序核对为准，不能信这句 */
const SELF_CERT_RE = /(?:自检(?:已)?通过|已自检|无编造|没有编造|未编造|无虚构|全部(?:属实|真实)|数据(?:均|都)?真实可靠|事实(?:均|都)?已核实)/g;

/** 资料里写的价格：数字要挨着价格单位（元、块、¥）或价格字眼（价、人均、客单、套餐），「38 年」不能顶「38 元」 */
function knownPrices(known: string): Set<number> {
  const out = new Set<number>();
  for (const m of known.matchAll(PRICE_RE)) { const n = cnNumber(m[1] ?? m[2] ?? ''); if (n !== null) out.add(n); }
  for (const m of known.matchAll(/(?:价格?|人均|客单|消费|套餐|单价|均价|收费|费用|报价|起步)[^，。；\n]{0,12}/g)) {
    for (const d of m[0].matchAll(/\d+(?:\.\d+)?/g)) out.add(Number(d[0]));
  }
  return out;
}

export interface FactCheckOptions {
  /** light = 只查百分比、顾客见证、「据统计」、自称自检通过（自由对话） */
  light?: boolean;
}

/**
 * 结果里没有出处的事实，按严重程度排：价格、百分比、顾客见证、经营承诺、资历荣誉、统计说法、地名，最后是模型自称自检通过。
 * 每条都带原句片段，页面上用它标位置、「按资料修正」时只改这几句。
 */
export function unsupportedFacts(raw: string, knownText: string, opts: FactCheckOptions = {}): string[] {
  // 模型自己写的自检清单里复述的数字、年限不算交付内容（自称自检通过照样在 raw 上查）
  const output = stripSelfCheck(raw);
  const known = knownText || '';
  const lineAt = (at: number) => output.slice(output.lastIndexOf('\n', at - 1) + 1, (output.indexOf('\n', at) + 1 || output.length + 1) - 1);
  const prices = knownPrices(known);
  const knownNumbers = new Set([...known.matchAll(/\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3}/g)].map((m) => cnNumber(m[0])).filter((n): n is number => n !== null));
  const out: string[] = [];
  const near = (at: number, len: number) => output.slice(Math.max(0, at - 8), at + len + 4).replace(/\s+/g, ' ').trim();
  const inKnown = (s: string) => s.length >= 2 && known.includes(s);
  // 事前采访设计不能变成已经采访过的报道；只在用户明确没有采访素材时检查。
  /*
   * 模型自己列的反例不算（2026-10-08 发布后复测）：「九、不可用示范（明确禁止）」下面一排 ❌ 开头的错误写法、
   * 禁止语句和错误示范不算交付事实；“采访后可用”不能让一个待发布候选免检。
   */
  const counterExample = (at: number) => {
    const line = lineAt(at);
    const lineStart = output.lastIndexOf('\n', at - 1) + 1;
    if (/^\s*(?:[-*>]\s*)?(?:❌|✗|×|🚫)/.test(line)) return true;
    if (/禁止|不编|不要写|不能写|不许写|错误示范|不可用示范/.test(output.slice(lineStart, at))) return true;
    const heading = [...output.slice(0, lineStart).matchAll(/(?:^|\n)\s*#{1,6}\s*([^\n]*)/g)].at(-1)?.[1] ?? '';
    return /不可用|禁止|错误示范|反例|不要这样/.test(heading);
  };
  // 「尚未采访时写提问型开头」是提示词里的通用写法规则，不代表这条是采访题（2026-10-09 修复后复测：选题被它误触发）
  if (/尚未采访(?!时)|还没采访(?!时)|没有采访(?:素材|结果|实录|回答)|不编造采访答案/.test(known)) {
    for (const m of output.matchAll(/(?:我[^，。！？\n]{0,8})?(?:问了|问过|采访了|走访了)[^，。！？\n“”"]{0,24}/g)) {
      const at = m.index ?? 0;
      const before = output.slice(Math.max(0, at - 16), at);
      if (inKnown(m[0]) || counterExample(at) || /如果|假设|不要|不能|不得|示例|采访后|采访结束后/.test(before)) continue;
      out.push(`采访经历「${m[0]}」用户尚未提供采访素材，请改成准备验证的问题或行动，不预写发现与答案`);
    }
    // A fabricated result need not contain "问了". These are actual failed candidates from model probes.
    const findings = /有人说[^，。！？\n]{1,18}[，,、]有人说[^。！？\n]{1,18}|(?:每家|每个老板|他们|老板们|大家)[^，。！？\n]{0,6}(?:答案|回答|感受)[^，。！？\n]{0,8}(?:不一样|不同|一样|一致)|店里(?:突然|一下子)?(?:安静|冷清|热闹|忙碌)(?:下来|起来|了)/g;
    for (const m of output.matchAll(findings)) {
      const at = m.index ?? 0;
      const before = output.slice(Math.max(0, at - 20), at);
      const after = output.slice(at + m[0].length, at + m[0].length + 6);
      if (inKnown(m[0]) || counterExample(at) || /如果|假设|可能|也许|不预设|不要|不能|不得/.test(before) || /^(?:吗|呢)?[？?]/.test(after)) continue;
      out.push(`采访结果「${m[0]}」尚未提供采访实录，不能预设变化或答案，改为准备验证的问题`);
    }
  }
  /** 已经标了【示例】【待确认】的不算冒充事实（lib/output-rules 让模型这样标） */
  const marked = (at: number) => {
    const line = output.slice(output.lastIndexOf('\n', at) + 1, at + 40);
    return /【示例|示例】|【待确认|待确认】|（示例）|\(示例\)/.test(line.slice(0, line.indexOf('\n') >= 0 ? line.indexOf('\n') : undefined));
  };

  if (!opts.light) {
    for (const m of output.matchAll(PRICE_RE)) {
      const n = cnNumber(m[1] ?? m[2] ?? '');
      if (n === null || prices.has(n) || marked(m.index ?? 0) || counterExample(m.index ?? 0)) continue;
      // 「拿起一块」：中文数字 + 块、后面没有「钱」，前面也没有价格字眼，当量词
      if (m[2] && /^[一二两三四五六七八九十]+$/.test(m[2]) && /块$/.test(m[0]) && !PRICE_WORD_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 6), m.index ?? 0))) continue;
      out.push(`价格「${near(m.index ?? 0, m[0].length)}」档案和素材里都没有`);
    }
  }
  /*
   * 2026-10-09 全板块实测补的三类（自由对话也查：它同样写了客户故事）：客户故事、替老板定的经营做法、编出来的效果基准。
   * 反例行（「不要编"前两天来了对小夫妻"」）、标了【换成你的】【待确认】的不算
   */
  const skipFake = (at: number, text: string) => marked(at) || counterExample(at) || /【换成|【待|X|Ｘ/.test(text) || inKnown(text.slice(0, 8))
    || /如果|假如|假设|改成|换成/.test(output.slice(Math.max(0, at - 10), at));
  for (const m of output.matchAll(CUSTOMER_STORY_RE)) {
    // 「不是在讲"今天只来了几个人"」：在说别这么讲
    if (skipFake(m.index ?? 0, m[0]) || NEGATION_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 8), m.index ?? 0))) continue;
    out.push(`客户故事「${near(m.index ?? 0, m[0].length)}」资料里没有这件事，别写成真事（写成【换成你接待的真实客户】）`);
  }
  for (const m of output.matchAll(POLICY_RE)) {
    const at = m.index ?? 0;
    // 否定只看紧挨着的几个字：「不是卖完就完了，入户效果不对我还得帮你调」前面的「不是」管不到后半句
    const justBefore = output.slice(Math.max(0, output.lastIndexOf('\n', at - 1) + 1, at - 6), at);
    if (skipFake(at, m[0]) || PROMISE_NEGATED.test(justBefore) || NEGATION_BEFORE.test(justBefore)) continue;
    out.push(`经营做法「${near(at, m[0].length)}」老板没说过，别替他定（写成【换成你店里的真实做法】）`);
  }
  const benchmarkLines = new Set<number>();
  for (const m of output.matchAll(BENCHMARK_RE)) {
    const at = m.index ?? 0;
    if (skipFake(at, m[0])) continue;
    benchmarkLines.add(output.lastIndexOf('\n', at - 1));
    out.push(`效果基准「${near(at, m[0].length)}」没有依据，改成和你自己前几条的数据比`);
  }
  for (const m of output.matchAll(PERCENT_RE)) {
    const at = m.index ?? 0;
    if (counterExample(at) || marked(at) || MIX_LINE.test(lineAt(at)) || inKnown(m[0].replace(/\s+/g, '')) || (m[1] && new RegExp(`${m[1].replace('.', '\\.')}\\s*[%％]`).test(known))) continue;
    // 拍摄指令（「语速慢 20%」）不是数据；已按效果基准报过的同一行不重复报
    if (SHOOT_PERCENT_BEFORE.test(output.slice(Math.max(0, at - 10), at)) || SHOOT_PERCENT_AFTER.test(output.slice(at + m[0].length, at + m[0].length + 4)) || benchmarkLines.has(output.lastIndexOf('\n', at - 1))) continue;
    out.push(`百分比「${near(at, m[0].length)}」没有出处`);
  }
  /*
   * 编出来的个人经历（2026-10-07 体检 A04）：方案里的示范时间被写成「我每天五点起」，
   * 还写出孩子、父母病情、存款——原来只查价格、百分比、年限、地名，这类一个都查不出。
   * 只认「我 / 我家」开头、说作息钟点或家人 / 钱的具体事；档案和素材里有、或者标了 X / 待确认的不算
   */
  for (const re of [LIFE_SCHEDULE_RE, LIFE_FAMILY_RE, LIFE_MONEY_RE]) {
    for (const m of output.matchAll(re)) {
      const at = m.index ?? 0;
      if (marked(at) || counterExample(at) || /X|Ｘ|【换成你的|【待/.test(m[0]) || inKnown(m[1] ?? '') || inKnown(m[0].slice(1, 7))) continue;
      out.push(`个人经历「${near(at, m[0].length)}」档案和素材里没有，别写成真事`);
    }
  }
  for (const m of output.matchAll(TESTIMONIAL_RE)) {
    // 素材里本来就有这段顾客的话（比如审稿的原稿），照用不算编
    const after = output.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12).replace(/[：:“”"「」\s]/g, '');
    // 「用老顾客反馈证明手艺」是建议去收集，不是编了一段反馈
    if (marked(m.index ?? 0) || counterExample(m.index ?? 0) || inKnown(m[0]) || inKnown(after.slice(0, 6)) || /^(?:证明|来证明|做|当|截图|视频)/.test(after)) continue;
    out.push(`顾客见证「${near(m.index ?? 0, m[0].length + 6)}」资料里没有这段经历`);
  }
  if (!opts.light) {
    for (const m of output.matchAll(PROMISE_RE)) {
      const at = m.index ?? 0;
      // 同一行里前面写着「不承诺 / 不建议 / 不要」：是在提醒别这么做
      const sameLineBefore = output.slice(Math.max(0, output.lastIndexOf('\n', at - 1) + 1, at - 24), at);
      // 「网上包邮」「别家送安装」：说的是别人家的做法，不是替老板承诺
      if (marked(at) || inKnown(m[0]) || WARNING_BEFORE.test(output.slice(Math.max(0, at - 12), at)) || PROMISE_NEGATED.test(sameLineBefore) || /网上|网店|电商|别家|同行|隔壁|有的店/.test(output.slice(Math.max(0, at - 6), at))) continue;
      out.push(`经营承诺「${near(at, m[0].length)}」老板没说过要这样做`);
    }
    for (const m of output.matchAll(HONOR_RE)) {
      if (known.includes(m[0]) || (m[1] && knownNumbers.has(cnNumber(m[1]) ?? -1) && /分店|门店|连锁/.test(known))) continue;
      if (NEGATION_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 16), m.index ?? 0))) continue;
      out.push(`资历/荣誉「${near(m.index ?? 0, m[0].length)}」档案里没有`);
    }
  }
  /*
   * 逐句看出处（2026-10-07 体检 A06）：原来全文只要出现一个网址或「来源：」，所有「据统计」都不提醒了——
   * 一个不相干的主页链接就能让别的统计句全部放行。现在这一句（所在行）自己带了出处才算
   */
  for (const m of output.matchAll(STAT_RE)) {
    if (CITED_LINE.test(lineAt(m.index ?? 0)) || counterExample(m.index ?? 0)) continue;
    out.push(`「${near(m.index ?? 0, m[0].length)}」引用了数据但没给出处`);
  }
  if (!opts.light) {
    // 普通词里的乡/县/区不能被正则吞成地名，否则自动修正会删掉创作主题。
    const ordinaryPlaces = [...output.matchAll(/县城|返乡|回乡|下乡|家乡|故乡|老乡|同乡|异乡|城乡|乡村|农村|评论区|弹幕区/g)]
      .map(m => ({ start: m.index!, end: m.index! + m[0].length }));
    for (const m of output.matchAll(PLACE_RE)) {
      const start = m.index!;
      if (ordinaryPlaces.some(span => start < span.end && start + m[0].length > span.start)) continue;
      const name = m[1];
      const isArea = m[0].endsWith('区');
      const tail = SUFFIX_NOUN_TAIL[m[0].slice(-1)];
      if (tail && tail.test(name)) continue;
      // 正则会多吞前面的字（「多人从莘县」）：只要后缀前面一两个字连着后缀在资料里出现过（「莘县」），就是资料里的地名
      const suffix = m[0].slice(-1);
      if (NOT_PLACE.test(name) || (isArea && (FUNCTION_AREA.test(name) || AREA_NOUN_TAIL.test(name) || name.includes('的'))) || known.includes(name) || known.includes(name.slice(-2))
        || known.includes(name.slice(-1) + suffix) || known.includes(name.slice(-2) + suffix) || counterExample(start)) continue;
      out.push(`地名「${m[0]}」档案和素材里都没有`);
    }
  }
  /** 教用户编数字（实测：「如果没有具体数字就说沙发三千多、茶几一千多」） */
  for (const m of output.matchAll(/没有(?:具体|真实|准确)?(?:的)?(?:数字|价格|数据|报价)(?:的话)?[，,]?\s*就(?:说|写|按|填)[^。！？\n]{0,24}/g)) {
    out.push(`教用户编数字「${near(m.index ?? 0, m[0].length)}」没有真实数字就该留【待确认】，不能给一个编的数`);
  }
  // 模型自称自检通过放最前面：用户最容易被这句话骗过去
  const selfCert = [...raw.matchAll(SELF_CERT_RE)].map((m) => `模型自称「${m[0]}」——以这里的核对为准，别信这句`);
  // 最多 8 条：页面上显示前 5 条（components/workspace/FactCheckNotice），后台看板全记
  return Array.from(new Set([...selfCert.slice(0, 1), ...out])).slice(0, 8);
}

export interface QualityIssue {
  kind: QualityKind;
  /** 一句话说清是什么问题（给后台看） */
  detail: string;
}

export interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
}

/** 中文数字也认：十八 → 18、半 → 0.5 */
function toNumber(s: string): number | null {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === '半') return 0.5;
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === '十') return 10;
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? map[m[1]] : 1) * 10 + (m[2] ? map[m[2]] : 0);
  return map[s] ?? null;
}

// 「年级、年代、年前、年后、年底、年轻、年龄……」里的年不是"干了几年"
const YEAR_RE = /(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3}|半)\s*年(?!级|代|前|后|内|底|初|轻|纪|龄|度|份|货|会|终|中|头|夜|糕)/g;

/**
 * 年限打架：结果里"在本地 / 来 / 扎根 / 干了 / 做了 N 年"的 N，事实卡里一个都对不上。
 * 只看这几种说法附近的年数——"2026 年""一年四季"这种不算。
 */
export function yearConflicts(output: string, persona: unknown): string[] {
  const f = readPersonaFacts(persona);
  const factText = [f.yearsInTrade, f.yearsLocal, f.story, f.others].filter(Boolean).join(' ');
  if (!factText) return [];
  const numbers = (text: string) => new Set([...text.matchAll(YEAR_RE)].map(m => toNumber(m[1])).filter((n): n is number => n !== null && n < 1900));
  const known = numbers(factText);
  if (known.size === 0) return [];
  type Dimension = 'trade' | 'local' | 'store';
  const localPlace = (f.yearsLocal ?? '').match(/(?:来|在)([\p{L}]{2,6}?)(?=半|\d|[一二两三四五六七八九十]|定居|居住|扎根)/u)?.[1];
  const dimension = (before: string, after: string): Dimension | null => {
    if (/店龄|开店|开了|卖了|经营.{0,8}(?:店|门店)|(?:店|门店).{0,5}(?:开|经营)/.test(before) || /^\s*(?:的)?老店/.test(after)) return 'store';
    if (/本地|当地|扎根|定居|居住|落户|搬来|住了|待了|呆了|来[^，。！？；\n]{1,8}$/.test(before)) return 'local';
    if (localPlace && before.includes(localPlace) && /在/.test(before) && !/经验|从业|这行|厨师|做菜|川菜|家具行业/.test(before)) return 'local';
    if (/从业|入行|这行|厨师|做菜|川菜|粤菜|手艺|经验|干了|做了|做.{0,6}(?:菜|餐饮|美甲|家具)/.test(before) || /^\s*(?:的)?(?:经验|手艺)/.test(after)) return 'trade';
    return null;
  };
  const allowed: Record<Dimension, Set<number>> = { trade: numbers(f.yearsInTrade ?? ''), local: numbers(f.yearsLocal ?? ''), store: new Set() };
  // 自由事实里的年数也按语义归类，不能把从业年数借给店龄或居住年限。
  for (const text of [f.story, f.others].filter((x): x is string => !!x)) for (const m of text.matchAll(YEAR_RE)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at).split(/[，。！？；\n]/).pop()!.slice(-20);
    const d = dimension(before, text.slice(at + m[0].length, at + m[0].length + 8));
    const n = toNumber(m[1]);
    if (d && n !== null && (d === 'store' || (d === 'trade' ? !f.yearsInTrade : !f.yearsLocal))) allowed[d].add(n);
  }
  const out: string[] = [];
  for (const m of output.matchAll(YEAR_RE)) {
    const n = toNumber(m[1]);
    if (n === null || n >= 1900) continue;
    const at = m.index ?? 0;
    const before = output.slice(0, at).split(/[，。！？；\n]/).pop()!.slice(-20);
    const after = output.slice(at + m[0].length, at + m[0].length + 8);
    // 说的是"在本地 / 干这行多久"才算：在南乐扎根 18 年、做了 8 年、18 年了、18 年的老店
    const d = dimension(before, after);
    const aboutTenure = !!d || /在|变了/.test(before) || /^\s*(?:了|的老店|老店|的经验|经验|的手艺)/.test(after);
    if (!aboutTenure) continue;
    if (d ? allowed[d].has(n) : known.has(n)) continue;
    out.push(output.slice(Math.max(0, at - 10), at + m[0].length + 3).replace(/\s+/g, ' ').trim());
  }
  return Array.from(new Set(out)).slice(0, 5);
}

/** 审稿只检查明确交付的改写稿；诊断中引用的错误原文不是交付内容。 */
export function reviewedQualityOutput(answer: string): string {
  const lines = answer.split('\n');
  const start = lines.findIndex(line => /^\s*#{1,4}\s+/.test(line) && /(?:优化|修改|改写)后的(?:完整)?(?:脚本|文案)|优化稿|最终稿/.test(line));
  if (start < 0) return '';
  const level = lines[start].match(/^\s*(#+)/)![1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const heading = lines[i].match(/^\s*(#{1,4})\s+(.*)$/);
    if (heading && heading[1].length <= level && !/^[^\p{L}\p{N}]*【/u.test(heading[2])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

export function runQualityChecks(p: {
  output: string;
  profile: object | null | undefined;
  taskType?: string;
  /** 按配比出的选题、方向：要求的配比和条数 */
  mix?: { resolved: ResolvedMix; count: number } | null;
  /** 这次带进来的素材（源资料、原稿）：结果里的价格、地名在这里找得到就不算编的 */
  source?: string | null;
}): QualityResult {
  const issues: QualityIssue[] = [];
  const profile = (p.profile ?? null) as Record<string, unknown> | null;
  const reviewed = reviewedQualityOutput(p.output);
  const output = p.taskType && /审稿|review/i.test(p.taskType) ? reviewed : reviewed && /问题清单|审稿|修改建议/.test(p.output) ? reviewed : p.output;
  if (!/[\p{L}\p{N}]/u.test(output ?? '')) {
    return { passed: false, issues: [{ kind: 'generation', detail: p.taskType && /审稿|review/i.test(p.taskType) ? '未找到优化后的脚本正文，无法完成质检' : '未收到有效正文，不能判为通过' }] };
  }

  for (const h of scanTaboos(output, profile).slice(0, 5)) {
    issues.push({ kind: 'taboo', detail: `「${h.word}」— ${h.taboo.why}` });
  }
  const excluded = readTabooSettings(profile?.taboo_settings).excluded;
  for (const h of findExcludedMentions(output, excluded, String(profile?.profile_name ?? '')).slice(0, 5)) {
    issues.push({ kind: 'excluded', detail: `提到了「${h.needle}」：${h.line}` });
  }
  if (p.mix) {
    const c = checkMix(output, p.mix.resolved, p.mix.count);
    if (!c.ok) issues.push({ kind: 'mix', detail: c.counted ? `实际 ${c.summary}，要求 ${c.expected}${c.got.unknown ? `，${c.got.unknown} 条没标目的` : ''}` : '未识别到要求的选题或方向条目，无法确认配比' });
  }
  for (const y of yearConflicts(stripSelfCheck(output), profile?.persona_facts)) {
    issues.push({ kind: 'years', detail: `「${y}」和事实卡对不上` });
  }
  // 关键事实（2026-10-05 起没建档案也查：没档案时只拿这次的素材比对）；自由对话只查冒充事实的几类
  if (p.taskType && (FACT_CHECK_TASKS.has(p.taskType) || LIGHT_FACT_CHECK_TASKS.has(p.taskType))) {
    const known = `${profile ? JSON.stringify(profile) : ''}\n${p.source ?? ''}`;
    for (const f of unsupportedFacts(output, known, { light: LIGHT_FACT_CHECK_TASKS.has(p.taskType) })) issues.push({ kind: 'facts', detail: f });
  }
  return { passed: issues.length === 0, issues };
}

const KINDS = Object.keys(QUALITY_LABELS) as QualityKind[];

/** 上报的体检结果校验一遍再入库（请求来自浏览器，不能原样信） */
export function sanitizeQualityReport(v: unknown): { task_type: string; profile_id: string | null; passed: boolean; issues: QualityIssue[]; sample: string } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const task = typeof o.taskType === 'string' ? o.taskType.trim().slice(0, 40) : '';
  if (!task) return null;
  const issues = (Array.isArray(o.issues) ? o.issues : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && KINDS.includes((x as Record<string, unknown>).kind as QualityKind))
    .slice(0, 20)
    .map((x) => ({ kind: x.kind as QualityKind, detail: String(x.detail ?? '').slice(0, 200) }));
  const profileId = typeof o.profileId === 'string' && /^[0-9a-f-]{36}$/i.test(o.profileId) ? o.profileId : null;
  return { task_type: task, profile_id: profileId, passed: issues.length === 0, issues, sample: typeof o.sample === 'string' ? o.sample.slice(0, 300) : '' };
}

export interface QualityRow { task_type: string; source: string; passed: boolean; issues: QualityIssue[]; sample?: string | null; created_at: string }

/** 后台看板的汇总：通过率、哪个板块问题多、最常见的问题、最近不合格的样例、最近一次每晚回归 */
export function summarizeQuality(rows: QualityRow[]) {
  const live = rows.filter((r) => r.source === 'live');
  const failed = live.filter((r) => !r.passed);
  const byTask = new Map<string, { task: string; total: number; failed: number }>();
  for (const r of live) {
    const t = byTask.get(r.task_type) ?? { task: r.task_type, total: 0, failed: 0 };
    t.total++;
    if (!r.passed) t.failed++;
    byTask.set(r.task_type, t);
  }
  const byKind = new Map<QualityKind, number>();
  for (const r of failed) for (const k of new Set(r.issues.map((i) => i.kind))) byKind.set(k, (byKind.get(k) ?? 0) + 1);
  const nightly = rows.filter((r) => r.source === 'nightly').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastNight = nightly[0]?.created_at.slice(0, 10);
  return {
    total: live.length,
    failed: failed.length,
    passRate: live.length ? Math.round(((live.length - failed.length) / live.length) * 1000) / 10 : null,
    byTask: [...byTask.values()].sort((a, b) => b.failed - a.failed || b.total - a.total),
    byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, label: QUALITY_LABELS[kind], count })).sort((a, b) => b.count - a.count),
    recentFailures: failed.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15),
    nightly: lastNight ? nightly.filter((r) => r.created_at.slice(0, 10) === lastNight) : [],
  };
}

/** 同一份结果只报一次（刷新、切回来恢复的不算新生成） */
export function outputKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${text.length}:${h.toString(16)}`;
}
