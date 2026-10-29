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
import { seasonMisstatements } from './time-anchor';
import { topicTagIssues } from './output-tags';
import { elementTitleIssues, topicDiversityIssues, promptExampleLeaks } from './topic-element-check';
import { findUnrealisticSentences } from './reality-check';

export type QualityKind = 'taboo' | 'excluded' | 'mix' | 'years' | 'reality' | 'generation' | 'facts' | 'flaky' | 'error';

export const QUALITY_LABELS: Record<QualityKind, string> = {
  taboo: '踩禁忌',
  excluded: '用了排除的信息',
  mix: '配比对不上',
  years: '年限和人设事实卡不符',
  reality: '写了不符合现实的说法（一个小变量推出大结论、一次反应推成普遍道理、太离谱或太简单）',
  generation: '生成未完成或内容缺失',
  facts: '关键事实没有出处（价格、百分比、顾客见证、经营承诺、资历、数据、地点）',
  // 只在回归里出现：第一次没过、重跑过了。说明模型输出有波动，不算失败
  flaky: '首次未通过、重跑后通过（模型输出波动）',
  // 回归没跑成（Dify 出错、超时）。不是质量问题，不计入通过率
  error: '没跑成（运行出错，不是质量问题）',
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
const FUNCTION_AREA = /(?:衣|货|台|位|座|架|柜|物|纳|车|诊|餐|厨|洗|浴|卧|厅|房|室|吧|展|陈列|体验|互动|游戏|烟|操作|工作|生活|阅读|休闲|儿童|收银|等候|试|拍照|打卡|候|装|品|料|菜|样|材|具|工|桌|床|发|几|椅|凳|垫|灯|镜|毯|帘|子|约|风|放)$/;
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
/** 数值标准：标准词（坐深、尺寸、宽度……）后面的数字区间，或直接带厘米、公分等单位的数字（见 unsupportedFacts） */
const STANDARD_RE = /(?:坐深|尺寸|宽度|高度|深度|厚度|承重|硬度|容量|面积)[^，。！？\n]{0,8}?(?:\d+(?:\.\d+)?|[一二两三四五六七八九十百]+)(?:\s*(?:[-~～]|到|至)\s*(?:\d+(?:\.\d+)?|[一二两三四五六七八九十百]+))?\s*(?:厘米|公分|cm|CM|毫米|mm|公斤|千克|斤|克|毫升|升|平方|平米|㎡)?|\d+(?:\.\d+)?\s*(?:厘米|公分|cm|CM|毫米|mm|公斤|千克|斤|克|毫升|㎡)/g;
/** 百分比：「90%」「百分之九十」「九成的业主」（2026-10-05：原来只认带「据统计」的，裸百分比漏了） */
const PERCENT_RE = /(\d+(?:\.\d+)?)\s*[%％]|十(?:个|家|人)(?:里)?有[七八九](?:个|家|人)?|百分之[一二两三四五六七八九十百]+|([一二三四五六七八九])成(?=的|以上|左右|多|人|顾客|客|用户|业主|家长|学员|粉丝)/g;
/** 顾客见证：「很多客人说」「有位顾客告诉我」「粉丝都说」——没给过故事却写成真事 */
const TESTIMONIAL_RE = /(?:很多|好多|不少|许多|有位|有个|有一位|有一个|一位|一个|一桌|几位|好几位|两位|一群|一拨|上周|昨天|前几天|之前|老)(?:老)?(?:客人|顾客|客户|粉丝|业主|家长|学员|宝妈|会员|食客|买家)(?:都|就|还|专门|特意|跑来|过来)?(?:说|讲|告诉|跟我说|反馈|夸|评价|留言|感叹|吐槽)|(?:客人|顾客|客户|粉丝|业主|家长|学员|食客|买家)(?:都说|纷纷|一致|普遍|常说|总说|反馈说)|(?:来过|吃过|买过|用过|试过|看过|听过)的(?:人|客人|顾客|朋友)(?:都|也|还)?(?:说|夸|评价|反馈|讲)|老客(?:人)?(?:都|也)?(?:说|夸|讲)|(?:客人|顾客|客户|食客|粉丝|老客)[^，。！？\n]{0,6}(?:说|夸)|(?:客人|顾客|客户|食客|粉丝|老客)[^，。！？\n]{0,6}(?:评价|反馈)[：:“"「]/g;
/**
 * 编出来的作息（2026-10-11 企业商用检测：「今天早上六点去市场」「早上六点从批发市场拉回来的鲜毛肚」「我早上五点熬的牛油底料」）：
 * 「今天 / 每天 / 早上」+ 钟点 + 具体的动作。只认动作类的词（去、拉、熬、备、切…），「下午三点开拍」这种拍摄安排不算
 */
const ROUTINE_RE = /(?:今天|昨天|今早|今晨|昨晚|今晚|前天|每天|天天|早上|清晨|凌晨)(?:早上|凌晨|清晨|上午|下午|晚上)?([0-9一二三四五六七八九十]{1,3}点(?:半|多|钟)?)[^，。！？\n]{0,10}?(?:去|拉|熬|进|备|切|穿|烤|卸|守|收|买|拿|做|煮|炖|腌|泡|吃)/g;
/** 「如果 / 比如」开头的是假设或示例，不是在讲自己的作息 */
const HYPOTHETICAL_BEFORE = /如果|假如|假设|比如|例如|若是|要是|万一|可以|示例|举例/;
/** 经营承诺：送、包、保证、折扣——没说过就不能替老板答应 */
const PROMISE_RE = /(?:免费(?:送|赠|领|试|上门|设计|测量|量|测|看|咨询|检测|评估|安装|体验|品尝|续|加)|赠送(?!计)|买[一二两三\d]+送[一二两三\d]+|送[一二两三四五六七八九十\d]+(?:份|个|杯|串|瓶|次|张|件)|包邮|包退|包换|包教包会|包安装|包售后|无效退款|不满意(?:全额)?退|终身(?:保修|维修|免费|质保)|保修[一二两三四五六七八九十\d]+年|打[一二三四五六七八九\d](?:\.\d)?折|满\d+减\d+|优惠券|首单立减|限时特价|不好吃(?:就)?不(?:要钱|收钱|付钱)|不满意(?:就)?(?:不(?:要钱|收钱)|退钱|全额退)|吃不好(?:就)?不(?:要钱|收钱))/g;
/** 吃完了跟我说、变成了老客、老客隔三差五来：这是顾客反馈和复购结果，资料里没有就是编的（2026-10-16 摸底：「吃完了跟我说，这个价格…」「现在不少人变成了老客」） */
const EATEN_FEEDBACK_RE = /吃(?:完|过)(?:了|之后|以后)?(?:都|还|就)?(?:跟我|对我)?(?:说|夸|讲|评价|反馈)|(?:变成了?|成了)(?:老客|回头客)|(?:老客|回头客)[^，。！？\n]{0,6}(?:还带朋友|带朋友|经常来|常来|推荐朋友)|隔三差五就(?:来|过来|到店)/g;
/** 过去在别处做过的经历：「我之前在别的店做过」「之前在工厂干过」（2026-10-16 摸底：「之前在别的店做过」是编的） */
const PREVIOUS_JOB_RE = /(?:^|[，。！？\n])\s*(?:我)?(?:之前|以前|早年|从前)在[^，。！？\n]{0,8}?(?:店|公司|厂|市场|工地|门店|档口|摊)[^，。！？\n]{0,6}?(?:做|干|待|工作|上班)过/g;
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
// 「流量45% / 人设25% / 变现30%」是我们给的内容配比（2026-10-11 第三轮复测：定位板块被当成数据误报，线上还会被事实修正改掉）
const MIX_LINE = /配比|人群兴趣|品类内容|泛话题|流量型|人设型|变现型|占比|比例|流量破圈|人设温度|主赛道|内容类型|更新频率|纯流量|建立信任|蹭热点|(?:流量|人设|变现)\s*\d+\s*%\s*[/／、，,]\s*(?:流量|人设|变现)|\d+\s*%\s*[/／]\s*(?:人设|流量|变现)/;
/** 「警惕所谓『免费设计』套路」是在提醒，不是老板答应送 */
const WARNING_BEFORE = /套路|陷阱|坑|骗|小心|别信|所谓|号称|打着|警惕|假的|忽悠/;
/** 「不承诺免费上门测量」「不建议增加“免费测量”」：是提醒别这么做，不是承诺（2026-10-08 发布后复测误报） */
const PROMISE_NEGATED = /不承诺|不要承诺|别承诺|不建议|不提供|不做|不能|不许|不要|禁止|避免|去掉|删掉|不写|不提|不加|别加/;

/** 去掉模型自己写的「自检 / 核对清单」：那里列的年限、数字是它在复述事实，不是交付内容（自称自检通过照样单独查） */
export function stripSelfCheck(output: string): string {
  const lines = output.split('\n');
  const keep: string[] = [];
  let skipLevel = 0;
  let inSelfLabel = false;
  for (const line of lines) {
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) {
      inSelfLabel = false;
      // 一级标题下面的内容不是它的子项（同 lib/output-guard：一级自检标题曾把整篇删空）
      if (skipLevel && (skipLevel === 1 || h[1].length <= skipLevel)) skipLevel = 0;
      if (!skipLevel && /自检|自查|核对|核查|校验|检查清单|事实确认|三有|为什么这样写|数据说明|事实说明|数据与事实|事实卡遵守|对照事实卡/.test(h[2])) { skipLevel = h[1].length; continue; }
    }
    if (skipLevel) continue;
    // 「事实卡严格遵守：「在苏州3年」「开店2年」」是模型对照事实卡的复述，不是交付内容（2026-10-16 摸底复测）
    if (/^\s*[-*•]?\s*\**\s*(?:自检|自查|事实核对|数字来源核查|禁忌核查|三有自检|生成说明|避重原则|为什么这样写|为什么能满足三有自检|数据说明|事实卡(?:严格)?遵守|对照事实卡|事实对照)\**\s*[：:]/.test(line)) { inSelfLabel = true; continue; }
    // 标签下面缩进的子条目（「  - 有用处：…」）是同一块的内容，一起去掉；顶格的内容或空行结束这一块
    if (inSelfLabel) { if (/^\s+\S/.test(line)) continue; inSelfLabel = false; }
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
  /*
   * 数值标准（2026-10-17 链路验证：「一米六以下坐深 55 到 60」资料里没有，模型说是行业常识，审稿给了满分，分镜又写进字幕）。
   * 只认「坐深、尺寸、宽度……」这类标准词后面跟的数字，或直接带厘米、公分等单位的数字。资料里有的数字不报。
   */
  if (!opts.light) {
    for (const m of output.matchAll(STANDARD_RE)) {
      const at = m.index ?? 0;
      const nums = m[0].match(/\d+(?:\.\d+)?/g) ?? [];
      if (skipFake(at, m[0]) || (nums.length > 0 && nums.every((n) => known.includes(n)))) continue;
      out.push(`数值标准「${near(at, m[0].length)}」资料里没有依据，改成【待测量】或问题`);
    }
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
  for (const re of [LIFE_SCHEDULE_RE, LIFE_FAMILY_RE, LIFE_MONEY_RE, PREVIOUS_JOB_RE]) {
    for (const m of output.matchAll(re)) {
      const at = m.index ?? 0;
      if (marked(at) || counterExample(at) || /X|Ｘ|【换成你的|【待/.test(m[0]) || inKnown(m[1] ?? '') || inKnown(m[0].slice(1, 7))) continue;
      out.push(`个人经历「${near(at, m[0].length)}」档案和素材里没有，别写成真事`);
    }
  }
  for (const m of [...output.matchAll(TESTIMONIAL_RE), ...output.matchAll(EATEN_FEEDBACK_RE)]) {
    // 素材里本来就有这段顾客的话（比如审稿的原稿），照用不算编
    const after = output.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12).replace(/[：:“”"「」\s]/g, '');
    // 「用老顾客反馈证明手艺」是建议去收集，不是编了一段反馈
    if (marked(m.index ?? 0) || counterExample(m.index ?? 0) || inKnown(m[0]) || inKnown(after.slice(0, 6)) || /^(?:证明|来证明|做|当|截图|视频)/.test(after)) continue;
    // 「如果客人同意出镜说话」是拍摄前的安排，不是客人真说过的话
    if (HYPOTHETICAL_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 8), m.index ?? 0))) continue;
    // 占位模板：「顾客见证「换成你接待的真实客户：…」」是要用户自己填的，不是编出来的话（2026-10-11 复测）
    if (/换成|待确认|【待/.test(output.slice(Math.max(0, (m.index ?? 0) - 8), (m.index ?? 0) + m[0].length + 4))) continue;
    // 否定的说明：「顾客见证，不代替顾客说感受」「不替顾客说话」是在提醒别编，不是编出来的话（2026-10-28 大码选题误报）
    const at = m.index ?? 0;
    const lineStart = output.lastIndexOf('\n', at - 1) + 1;
    const lineEnd = output.indexOf('\n', at) === -1 ? output.length : output.indexOf('\n', at);
    if (/不代替|不替|不能替|不编|别替|别编|不写/.test(output.slice(lineStart, lineEnd))) continue;
    out.push(`顾客见证「${near(m.index ?? 0, m[0].length + 6)}」资料里没有这段经历`);
  }
  for (const m of output.matchAll(ROUTINE_RE)) {
    const at = m.index ?? 0;
    const clock = m[1] ?? '';
    // 档案或素材里写过同一个钟点，或这一句是假设、示例、标了待确认的，不算编
    if (marked(at) || counterExample(at) || /X|Ｘ|【换成你的|【待/.test(m[0]) || inKnown(clock) || HYPOTHETICAL_BEFORE.test(output.slice(Math.max(0, at - 8), at))) continue;
    out.push(`作息「${near(at, m[0].length)}」档案和素材里没有，别写成真事（写成【换成你的真实作息】）`);
  }
  if (!opts.light) {
    for (const m of output.matchAll(PROMISE_RE)) {
      const at = m.index ?? 0;
      // 同一行里前面写着「不承诺 / 不建议 / 不要」：是在提醒别这么做
      const sameLineBefore = output.slice(Math.max(0, output.lastIndexOf('\n', at - 1) + 1, at - 24), at);
      // 「不好吃不要钱」这类口语承诺只看紧挨着的几个字，不然「能不能便宜点」里的「不能」会把它压掉（2026-10-16 摸底）
      const negated = /^(?:不好吃|不满意|吃不好)/.test(m[0]) ? NEGATION_BEFORE.test(output.slice(Math.max(0, at - 6), at)) : PROMISE_NEGATED.test(sameLineBefore);
      // 「网上包邮」「别家送安装」：说的是别人家的做法，不是替老板承诺
      if (marked(at) || inKnown(m[0]) || WARNING_BEFORE.test(output.slice(Math.max(0, at - 12), at)) || negated || /网上|网店|电商|别家|同行|隔壁|有的店/.test(output.slice(Math.max(0, at - 6), at))) continue;
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
      // 「从你村出来」「各村」：紧挨着「村/镇/乡」的是代词或量词，不是地名（2026-10-11 第四轮复测误报）
      // 「开车到村」「去村里」：前面是动词或介词（到、去、回…），「村」是普通的字（2026-10-12 定向验证误报）
      if (/[你我他她咱这那每本各其某另哪用到去回进出来往向在从]$/.test(name)) continue;
      if (NOT_PLACE.test(name) || (isArea &&(FUNCTION_AREA.test(name) || AREA_NOUN_TAIL.test(name) || name.includes('的'))) || known.includes(name) || known.includes(name.slice(-2))
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
  /**
   * 是否判不通过。不写 = 判不通过（默认）。false = 只提醒，比如模型自称「自检通过」（页面会删掉这句，内容本身不一定有错）、
   * 只命中一个切碎的排除片段（多半是误报）。
   */
  blocking?: boolean;
}

/** 有问题且判不通过的才算不通过；只提醒的不影响 passed */
export function isBlockingIssue(issue: QualityIssue): boolean {
  return issue.blocking !== false;
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

/** 这句话说的是别人：碰到的姐姐、遇到的客人、同行、朋友的经历（2026-10-23：美甲回归里「碰到一个做了9年的姐姐」被误判） */
const OTHER_PERSON_RE = /碰到|遇到|遇见|认识|客人|顾客|朋友|姐姐|哥哥|姐妹|师傅|同行|别人|他的|她的|他做|她做/;

// 「年级、年代、年前、年后、年底、年轻、年龄……」里的年不是"干了几年"
const YEAR_RE = /(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3}|半)\s*年(?!级|代|前|后|内|底|初|轻|纪|龄|度|份|货|会|终|中|头|夜|糕)/g;

/**
 * 年数前面的「分句」从这里断开：句号、逗号、分号、顿号、箭头、引号、括号、冒号。
 * 不断开的话，前一个分句的词会借给这个年数（2026-10-28 回归：「在南乐开店3年、做大码女装6年」的 6 年被当成店龄，「→ 回到家具从业12年」被当成居住年限）。
 */
const CLAUSE_BREAK = /[，。！？；、→“”"「」（）()：:·\n]/;

/**
 * 年限打架：结果里"在本地 / 来 / 扎根 / 干了 / 做了 N 年"的 N，事实卡里一个都对不上。
 * 只看这几种说法附近的年数——"2026 年""一年四季"这种不算。
 */
function yearConflictHits(output: string, persona: unknown): Array<{ at: number; snippet: string }> {
  const f = readPersonaFacts(persona);
  const factText = [f.yearsInTrade, f.yearsLocal, f.story, f.others].filter(Boolean).join(' ');
  if (!factText) return [];
  const numbers = (text: string) => new Set([...text.matchAll(YEAR_RE)].map(m => toNumber(m[1])).filter((n): n is number => n !== null && n < 1900));
  const known = numbers(factText);
  if (known.size === 0) return [];
  type Dimension = 'trade' | 'local' | 'store';
  const localPlace = (f.yearsLocal ?? '').match(/(?:来|在)([\p{L}]{2,6}?)(?=半|\d|[一二两三四五六七八九十]|定居|居住|扎根)/u)?.[1];
  const dimension = (before: string, after: string): Dimension | null => {
    if (/店龄|开店|开了|开[\p{L}\d]{0,8}店|卖了|经营.{0,8}(?:店|门店)|(?:店|门店).{0,5}(?:开|经营)/u.test(before) || /^\s*(?:的)?老店/.test(after)) return 'store';
    // 「来自成都」说的是籍贯，不是来本地居住（2026-10-28：「王来自成都、做川菜 9 年」被误判成居住年限）
    if (/本地|当地|扎根|定居|居住|落户|搬来|住了|待了|呆了|来(?!自)[^，。！？；\n]{1,8}$/.test(before)) return 'local';
    if (localPlace && before.includes(localPlace) && /在/.test(before) && !/经验|从业|这行|厨师|做菜|川菜|家具行业/.test(before)) return 'local';
    if (/从业|入行|这行|厨师|做菜|川菜|粤菜|手艺|经验|干了|做了|做.{0,6}(?:菜|餐饮|美甲|家具)/.test(before) || /^\s*(?:的)?(?:经验|手艺)/.test(after)) return 'trade';
    return null;
  };
  // 「在南乐开店 3 年」这种居住年限字段里也写了店龄：店龄要认它（2026-10-28：大码选题把开店 3 年误判成对不上）
  const storeInLocal = /开店|开了|门店|店龄|开.{0,4}店/.test(f.yearsLocal ?? '');
  const allowed: Record<Dimension, Set<number>> = { trade: numbers(f.yearsInTrade ?? ''), local: numbers(f.yearsLocal ?? ''), store: storeInLocal ? numbers(f.yearsLocal ?? '') : new Set() };
  // 自由事实里的年数也按语义归类，不能把从业年数借给店龄或居住年限。
  for (const text of [f.story, f.others].filter((x): x is string => !!x)) for (const m of text.matchAll(YEAR_RE)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at).split(CLAUSE_BREAK).pop()!.slice(-20);
    const d = dimension(before, text.slice(at + m[0].length, at + m[0].length + 8));
    const n = toNumber(m[1]);
    if (d && n !== null && (d === 'store' || (d === 'trade' ? !f.yearsInTrade : !f.yearsLocal))) allowed[d].add(n);
  }
  const out: Array<{ at: number; snippet: string }> = [];
  for (const m of output.matchAll(YEAR_RE)) {
    const n = toNumber(m[1]);
    if (n === null || n >= 1900) continue;
    const at = m.index ?? 0;
    const before = output.slice(0, at).split(CLAUSE_BREAK).pop()!.slice(-20);
    const after = output.slice(at + m[0].length, at + m[0].length + 8);
    // 说的是别人（碰到的姐姐、客人、同行）的年数，不是这个号的，不比
    if (OTHER_PERSON_RE.test(before)) continue;
    // 说的是"在本地 / 干这行多久"才算：在南乐扎根 18 年、做了 8 年、18 年了、18 年的老店
    const d = dimension(before, after);
    const aboutTenure = !!d || /在|变了/.test(before) || /^\s*(?:了|的老店|老店|的经验|经验|的手艺)/.test(after);
    if (!aboutTenure) continue;
    if (d ? allowed[d].has(n) : known.has(n)) continue;
    out.push({ at, snippet: output.slice(Math.max(0, at - 10), at + m[0].length + 3).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/** 年限打架的片段（去重，最多 5 处）：给体检的提示用 */
export function yearConflicts(output: string, persona: unknown): string[] {
  return Array.from(new Set(yearConflictHits(output, persona).map((h) => h.snippet))).slice(0, 5);
}

/** 年限打架所在的整句（去重，最多 5 句）：年限修复只改这几句（lib/years-repair） */
export function yearConflictSentences(output: string, persona: unknown): string[] {
  return Array.from(new Set(yearConflictHits(output, persona).map((h) => sentenceAt(output, h.at)))).slice(0, 5);
}

/** 位置 at 所在的整句：按句号、问号、感叹号和换行切，句首的标签（「- **店主**：」）也带上 */
function sentenceAt(text: string, at: number): string {
  const start = Math.max(...'。！？\n'.split('').map((c) => text.lastIndexOf(c, at - 1))) + 1;
  const ends = '。！？\n'.split('').map((c) => text.indexOf(c, at)).filter((i) => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : text.length).trim();
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

const QUOTE_RE = /「[^」\n]*」|“[^”\n]*”|『[^』\n]*』|"[^"\n]*"/g;
/** 这一句是在说原稿、改前的样子（「原稿写的……」「原文里……」），不是在用这个词 */
const QUOTING_LINE_RE = /原稿|原文|改前|旧稿|原句|原来的/;

/**
 * 禁忌词是不是只出现在引号里，或者这一行在讲原稿：这是引用，不是在用（2026-10-23）。
 * 审稿结果里「原稿写的『全城最正宗』」这类引用，原来会被当成踩禁忌，把通过率拉低。
 */
export function tabooOnlyQuoted(output: string, word: string): boolean {
  if (!word) return false;
  let seen = false;
  for (const line of output.split('\n')) {
    let at = line.indexOf(word);
    while (at >= 0) {
      seen = true;
      const inQuote = [...line.matchAll(QUOTE_RE)].some((q) => at >= (q.index ?? 0) && at < (q.index ?? 0) + q[0].length);
      // 标记只管同一句里、出现位置之前的话：「原稿写的……」之后的那句直接用，不因为前面有「原稿」就放过
      const clause = line.slice(0, at).split(/[。！？；]/).pop() ?? '';
      if (!inQuote && !QUOTING_LINE_RE.test(clause)) return false;
      at = line.indexOf(word, at + word.length);
    }
  }
  return seen;
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

  // 占位代替内容（2026-10-17 链路验证：方向里的「（清单已按要求提供）」，小节其实是空的）
  if (/已按要求提供|内容已按要求|清单已按要求/.test(output)) {
    issues.push({ kind: 'generation', detail: '有小节只写了「已按要求提供」这类占位，没有实际内容' });
  }
  for (const h of scanTaboos(output, profile).filter((hit) => !tabooOnlyQuoted(output, hit.word)).slice(0, 5)) {
    issues.push({ kind: 'taboo', detail: `「${h.word}」— ${h.taboo.why}` });
  }
  const excluded = readTabooSettings(profile?.taboo_settings).excluded;
  for (const h of findExcludedMentions(output, excluded, String(profile?.profile_name ?? '')).slice(0, 5)) {
    // 只命中一个切碎的片段（比如「内容方」）多半是误报：只提醒，不判不通过
    issues.push({ kind: 'excluded', detail: `提到了「${h.needle}」：${h.line}${h.strong ? '' : '（只命中一个短片段，仅供参考）'}`, blocking: h.strong });
  }
  if (p.mix) {
    const c = checkMix(output, p.mix.resolved, p.mix.count);
    if (!c.ok) issues.push({ kind: 'mix', detail: c.counted ? `实际 ${c.summary}，要求 ${c.expected}${c.got.unknown ? `，${c.got.unknown} 条没标目的` : ''}` : '未识别到要求的选题或方向条目，无法确认配比' });
  }
  for (const y of yearConflicts(stripSelfCheck(output), profile?.persona_facts)) {
    issues.push({ kind: 'years', detail: `「${y}」和事实卡对不上` });
  }
  // 现实检查（2026-10-28）：创作类板块都不许写不符合现实的说法，不分行业。拆解是在分析别人的视频，自由对话是闲聊，不查
  if (p.taskType && !/拆解|自由对话/.test(p.taskType)) {
    for (const s of findUnrealisticSentences(output).slice(0, 5)) issues.push({ kind: 'reality', detail: `「${s.slice(0, 60)}」` });
  }
  // 选题的四个标签（lib/output-tags，2026-10-19）：缺了只进看板，不挡交付
  if (p.taskType === '选题策划') {
    for (const d of topicTagIssues(output)) issues.push({ kind: 'generation', detail: d, blocking: false });
    // 爆款元素（2026-10-28）：写了用哪个元素，标题就要认得出。2026-10-29 改成只提醒、不挡交付：
    // 按「标题里有没有元素关键词」挡交付，等于奖励硬套句式（「世界上最贵的衣服，贵在闲置？」能过，通顺的好标题反而被挡）
    for (const d of elementTitleIssues(output)) issues.push({ kind: 'generation', detail: d, blocking: false });
    for (const d of topicDiversityIssues(output)) issues.push({ kind: 'generation', detail: d, blocking: false });
    for (const d of promptExampleLeaks(output)) issues.push({ kind: 'generation', detail: d, blocking: false });
  }
  // 关键事实（2026-10-05 起没建档案也查：没档案时只拿这次的素材比对）；自由对话只查冒充事实的几类
  if (p.taskType && (FACT_CHECK_TASKS.has(p.taskType) || LIGHT_FACT_CHECK_TASKS.has(p.taskType))) {
    const known = `${profile ? JSON.stringify(profile) : ''}\n${p.source ?? ''}`;
    // 「模型自称自检通过」只提醒：页面会删掉这句，判断内容要看实际的编造，不看它自己怎么说
    for (const f of unsupportedFacts(output, known, { light: LIGHT_FACT_CHECK_TASKS.has(p.taskType) })) issues.push({ kind: 'facts', detail: f, blocking: f.startsWith('模型自称') ? false : undefined });
    // 时令错配（今天是什么季节，见 lib/time-anchor）：自由对话不查
    if (FACT_CHECK_TASKS.has(p.taskType)) for (const f of seasonMisstatements(output, Date.now(), known)) issues.push({ kind: 'facts', detail: f });
  }
  return { passed: !issues.some(isBlockingIssue), issues };
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
    .map((x) => ({ kind: x.kind as QualityKind, detail: String(x.detail ?? '').slice(0, 200), ...(x.blocking === false ? { blocking: false } : {}) }));
  const profileId = typeof o.profileId === 'string' && /^[0-9a-f-]{36}$/i.test(o.profileId) ? o.profileId : null;
  return { task_type: task, profile_id: profileId, passed: !issues.some(isBlockingIssue), issues, sample: typeof o.sample === 'string' ? o.sample.slice(0, 300) : '' };
}

export interface QualityRow { id?: string; task_type: string; source: string; passed: boolean; issues: QualityIssue[]; sample?: string | null; created_at: string }

/** 「没跑成」：回归运行出错（Dify 出错、超时），不是质量问题，不计入通过率 */
export function isRunError(r: Pick<QualityRow, 'issues'>): boolean {
  return (r.issues ?? []).some((i) => i.kind === 'error');
}

/** 算失败的只看阻断项：只提醒的（模型自称自检通过、切碎片段命中、重跑后通过）不算 */
export function rowFailed(r: Pick<QualityRow, 'passed' | 'issues'>): boolean {
  return !r.passed && !isRunError(r);
}

/** 北京日期（YYYY-MM-DD）。看板按天看趋势用北京日期，和管理员看到的时间一致 */
const beijingDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);

export interface RunCase {
  task: string;
  /** 这一个用例是否通过（没跑成的算不通过，但 error 为 true） */
  passed: boolean;
  error: boolean;
  blocking: string[];
  advisory: string[];
  sample: string;
}

export interface QualityRun {
  at: string;
  source: string;
  total: number;
  passed: number;
  errors: number;
  cases: RunCase[];
}

/**
 * 把同一次运行的记录分组。一次运行的记录是一条 insert 写进去的，created_at 完全相同，按它分组就是一次运行。
 * 手动和夜间分开看，不再按日期合并（2026-10-23：手动回归原来会混进「每晚回归」里）。
 */
export function groupRuns(rows: QualityRow[], source: string): QualityRun[] {
  const byAt = new Map<string, QualityRow[]>();
  for (const r of rows) if (r.source === source) byAt.set(r.created_at, [...(byAt.get(r.created_at) ?? []), r]);
  return [...byAt.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([at, list]) => ({
      at,
      source,
      total: list.length,
      passed: list.filter((r) => r.passed && !isRunError(r)).length,
      errors: list.filter(isRunError).length,
      cases: list.map((r) => {
        const error = isRunError(r);
        const label = (i: QualityIssue) => `${QUALITY_LABELS[i.kind]}：${i.detail}`;
        return {
          task: r.task_type,
          passed: r.passed && !error,
          error,
          blocking: r.issues.filter((i) => i.kind !== 'error' && isBlockingIssue(i)).map(label),
          advisory: r.issues.filter((i) => i.kind !== 'error' && (!isBlockingIssue(i) || i.kind === 'flaky')).map(label),
          sample: r.sample ?? '',
        };
      }),
    }));
}

export interface RunDiff {
  /** 这次失败、上次通过（或上次没有这个用例） */
  newFailures: string[];
  /** 连续失败 */
  stillFailing: string[];
  /** 上次失败、这次通过 */
  fixed: string[];
}

/** 和上一次同一个用例比：新增失败、持续失败、已修复。没跑成的不参与比较 */
export function diffRuns(latest: QualityRun, previous: QualityRun | null): RunDiff {
  const before = new Map((previous?.cases ?? []).filter((c) => !c.error).map((c) => [c.task, c.passed]));
  const out: RunDiff = { newFailures: [], stillFailing: [], fixed: [] };
  for (const c of latest.cases) {
    if (c.error) continue;
    const was = before.get(c.task);
    if (!c.passed) (was === false ? out.stillFailing : out.newFailures).push(c.task);
    else if (was === false) out.fixed.push(c.task);
  }
  return out;
}

export interface DayStat {
  day: string;
  live: { total: number; passed: number };
  nightly: { total: number; passed: number };
}

/** 按北京日期汇总实时体检和夜间回归的通过情况（没跑成的不算） */
export function dailyTrend(rows: QualityRow[]): DayStat[] {
  const days = new Map<string, DayStat>();
  for (const r of rows) {
    if (isRunError(r) || (r.source !== 'live' && r.source !== 'nightly')) continue;
    const day = beijingDay(r.created_at);
    const d = days.get(day) ?? { day, live: { total: 0, passed: 0 }, nightly: { total: 0, passed: 0 } };
    const bucket = r.source === 'live' ? d.live : d.nightly;
    bucket.total++;
    if (r.passed) bucket.passed++;
    days.set(day, d);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * 后台看板的汇总。默认只统计实时体检（source = live），可以按来源和板块筛选。
 * 通过率、最常见的问题只看阻断项；非阻断的单独列；没跑成的单独计数。
 */
export function summarizeQuality(rows: QualityRow[], opts: { source?: string; task?: string } = {}) {
  const source = opts.source ?? 'live';
  const scoped = rows.filter((r) => (source === 'all' || r.source === source) && (!opts.task || r.task_type === opts.task));
  const checked = scoped.filter((r) => !isRunError(r));
  const failed = checked.filter(rowFailed);

  const byTask = new Map<string, { task: string; total: number; failed: number }>();
  for (const r of checked) {
    const t = byTask.get(r.task_type) ?? { task: r.task_type, total: 0, failed: 0 };
    t.total++;
    if (rowFailed(r)) t.failed++;
    byTask.set(r.task_type, t);
  }

  const byKind = new Map<QualityKind, number>();
  for (const r of failed) for (const k of new Set(r.issues.filter(isBlockingIssue).map((i) => i.kind))) byKind.set(k, (byKind.get(k) ?? 0) + 1);

  const advisory = new Map<QualityKind, number>();
  for (const r of checked) for (const k of new Set(r.issues.filter((i) => !isBlockingIssue(i)).map((i) => i.kind))) advisory.set(k, (advisory.get(k) ?? 0) + 1);

  const runs = { nightly: groupRuns(rows, 'nightly').slice(0, 10), manual: groupRuns(rows, 'manual').slice(0, 10) };

  return {
    source,
    task: opts.task ?? null,
    total: checked.length,
    failed: failed.length,
    passRate: checked.length ? Math.round(((checked.length - failed.length) / checked.length) * 1000) / 10 : null,
    errors: scoped.filter(isRunError).length,
    byTask: [...byTask.values()].sort((a, b) => b.failed - a.failed || b.total - a.total),
    byKind: [...byKind.entries()].map(([kind, count]) => ({ kind, label: QUALITY_LABELS[kind], count })).sort((a, b) => b.count - a.count),
    advisory: [...advisory.entries()].map(([kind, count]) => ({ kind, label: QUALITY_LABELS[kind], count })).sort((a, b) => b.count - a.count),
    recentFailures: [...failed].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15),
    daily: dailyTrend(rows),
    runs,
    nightlyDiff: runs.nightly[0] ? diffRuns(runs.nightly[0], runs.nightly[1] ?? null) : null,
  };
}

/** 同一份结果只报一次（刷新、切回来恢复的不算新生成） */
export function outputKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${text.length}:${h.toString(16)}`;
}
