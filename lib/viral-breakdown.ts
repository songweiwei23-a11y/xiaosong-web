/**
 * 拆解爆款：把一条爆款视频（镜头拼图 + 分段口播 + 用户填的数据）拆成八层 + 逐镜头表。
 *
 * 拆解维度是和产品方逐条对过的（2026-09-30）：
 *   0 值不值得拆 → 1 账号 → 2 选题 → 3 开篇 → 4 结构和情绪曲线 → 5 逐镜头 → 6 包装 → 7 可复用结论
 * 依据都在知识库：拆片课（库3·16）、第79节彩蛋（前2秒/前5秒）、拍摄呈现基础/进阶课（景别、运镜、构图、写实写意）、
 * 场景课（三类置景）、情绪波点设计手册（四种曲线、六大钩子、波点数量）、八大爆款元素、四大脚本、开篇36计、起号36计。
 *
 * 分类名一律从代码里的同一份清单取（八大元素、四大脚本、开篇卡、36 计、三种作用），
 * 拆出来的结论才能和选题、脚本、开篇这些板块对得上号，后面"跨行业二创"也能直接接着用。
 */
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from './viral-elements';
import { OPENING_CARDS } from './opening-cards';
import { GROWTH_TACTICS } from './growth-tactics';
import { CONTENT_ROLE_LIST } from './content-roles';
import { fmtTime, type Shot, type KeyFrame } from './video-frames';

export const BREAKDOWN_TASK_TYPE = '拆解爆款';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/** 用户自己填的（都是选填）：判断"是不是真爆"、拆包装要用 */
export interface VideoMeta {
  title?: string;
  likes?: number;
  comments?: number;
  favorites?: number;
  shares?: number;
  followers?: number;
  /** 这条视频是什么行业的 */
  industry?: string;
  /** 用户想重点看什么 */
  focus?: string;
}

export interface BreakdownPromptInput {
  /** 拆的这一段有多长 */
  duration: number;
  /** 视频本身多长；超过 3 分钟的只拆了前面一段 */
  fullDuration?: number;
  truncated?: boolean;
  width: number;
  height: number;
  shots: Shot[];
  frames: KeyFrame[];
  sheetCount: number;
  transcript: TranscriptSegment[];
  /** 没识别出口播时，用户手贴的文案 */
  pastedScript?: string;
  meta: VideoMeta;
  /** 当前账号档案摘要：有就给"套到你的店"，没有就不给 */
  profileSummary?: string;
}

export interface ShotStats {
  count: number;
  avgLen: number;
  longest: number;
  /** 前 3 秒里切了几刀 */
  cutsInOpening: number;
}

export function shotStats(shots: Shot[]): ShotStats {
  const lens = shots.map((s) => s.end - s.start);
  return {
    count: shots.length,
    avgLen: lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0,
    longest: lens.length ? Math.max(...lens) : 0,
    cutsInOpening: shots.filter((s) => s.start > 0 && s.start < 3).length,
  };
}

/** 用户填的数：填 0 或者乱填的当没填（0 粉丝、0 点赞说明不了任何事） */
const n = (v?: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/** 用户填了多少就写多少；点赞和粉丝都有时，顺手算好比例（模型算数不可靠） */
export function metaLines(m: VideoMeta): string[] {
  const out: string[] = [];
  if (m.title?.trim()) out.push(`- 标题/文案：${m.title.trim()}`);
  if (m.industry?.trim()) out.push(`- 行业：${m.industry.trim()}`);
  const nums: [string, number | undefined][] = [
    ['点赞', n(m.likes)],
    ['评论', n(m.comments)],
    ['收藏', n(m.favorites)],
    ['转发', n(m.shares)],
    ['账号粉丝', n(m.followers)],
  ];
  const filled = nums.filter(([, v]) => v !== undefined);
  if (filled.length) out.push(`- 数据：${filled.map(([k, v]) => `${k} ${v}`).join('，')}`);
  const likes = n(m.likes);
  const followers = n(m.followers);
  if (likes !== undefined && followers) out.push(`- 点赞是粉丝数的 ${(likes / followers).toFixed(1)} 倍`);
  if (likes) {
    const r = (k: string, v?: number) => (v !== undefined ? `${k}/点赞 = ${(v / likes).toFixed(2)}` : '');
    const ratios = [r('收藏', n(m.favorites)), r('评论', n(m.comments)), r('转发', n(m.shares))].filter(Boolean);
    if (ratios.length) out.push(`- 互动比：${ratios.join('，')}`);
  }
  if (m.focus?.trim()) out.push(`- 用户想重点看：${m.focus.trim()}`);
  return out;
}

function taxonomy(): string {
  const byCat = new Map<string, string[]>();
  for (const c of OPENING_CARDS) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c.name]);
  return `## 拆解用的分类（名字要和这里一字不差，好和其他板块对上；**按这里的意思用，不要自己重新定义**）
- 八大爆款元素（名字：它利用的是什么）：
${VIRAL_ELEMENTS.map((e) => `  - ${e.name}：${e.hook}`).join('\n')}
  实测模型会把"荷尔蒙"说成"情感浓度"——不对，荷尔蒙就是颜值和异性吸引。对不上哪个元素，就说"没有明显用到"
- 四大脚本：${SCRIPT_FAMILIES.map((s) => s.name).join('、')}
- 三种作用：${CONTENT_ROLE_LIST.join('、')}
- 开篇 36 计（按心理机制分类）：${[...byCat].map(([k, v]) => `【${k}】${v.join('、')}`).join('；')}
- 起号 36 计：${GROWTH_TACTICS.map((t) => t.name).join('、')}
- 六大钩子：金钱、盲盒、对抗、验证解密、送温暖、荷尔蒙
- 情绪曲线：反转型（期待→意外骤降→反转再升）、盲盒型（好奇→半揭晓→更好奇→全揭晓）、共鸣爆发型（认同→更认同→爆发）、情感渗透型（平稳→细节温暖→最后一句击中）
- 人设：崇拜者（靠人格魅力）、教导者（靠专业能力）、分享者（不是专家但有实操经验）、陪伴者（记录成长过程）、衬托者（展示自己的弱点引发共鸣）、搞笑者（段子逗乐）
- 呈现方式：口播（自拍/偷拍/聊天/采访视角）、vlog、剧情、图文
- 景别：远景、全景、中景、近景、特写；运镜：推、拉、横移、摇、跟随、环绕、固定
- 置景：素背景、包装型背景（行业现场）、生活化背景`;
}

/**
 * 整段提示词。原则：
 * - 画面只能看拼图，声音只能看识别出来的文字——背景音乐、音效、语气听不到，这些只能推断，要标"推测"
 * - 运镜只能从同一镜头前后几张图推断（大部分镜头只截了一张），判断不了就写"固定/看不出"，不许编
 * - 数字我们算好给它（镜头数、平均时长、前 3 秒切几刀、互动比），它负责解读，不负责算
 */
export function buildBreakdownPrompt(p: BreakdownPromptInput): string {
  const st = shotStats(p.shots);
  const orientation = p.height > p.width ? '竖屏' : p.height === p.width ? '方形' : '横屏';
  const shotRows = p.shots.map((s) => `镜头${s.no}：${fmtTime(s.start)}-${fmtTime(s.end)}（${(s.end - s.start).toFixed(1)} 秒）`).join('\n');
  const transcript = p.transcript.filter((t) => t.text.trim()).length
    ? p.transcript.filter((t) => t.text.trim()).map((t) => `[${fmtTime(t.start)}-${fmtTime(t.end)}] ${t.text.trim()}`).join('\n')
    : '';
  const meta = metaLines(p.meta);

  return `【任务：拆解爆款】你是做了十年短视频的编导老师，现在带学员逐帧拆一条爆款。目的不是夸它，是拆出**能学走的东西**。

## 这条视频
- ${p.truncated && p.fullDuration
    ? `整条 ${Math.round(p.fullDuration)} 秒，**这次只拆前 ${Math.round(p.duration)} 秒**（后面的画面和口播你都没看到——结构、兑现、结尾这些判断要说明"只看了前 ${Math.round(p.duration / 60)} 分钟"，不要替后面编）`
    : `时长 ${p.duration.toFixed(1)} 秒`}，${orientation}（${p.width}×${p.height}）
- 一共 ${st.count} 个镜头，平均每个 ${st.avgLen.toFixed(1)} 秒，最长 ${st.longest.toFixed(1)} 秒；前 3 秒切了 ${st.cutsInOpening} 刀（这些数是程序算的，准的，直接用）
${meta.length ? meta.join('\n') : '- 用户没填标题和数据'}

## 画面：随消息发来的 ${p.sheetCount} 张拼图
每一格上方印着「时间  镜头号  这个镜头的起止时间」。**橙色标签**是开头 3 秒每 0.5 秒截的一张（看前 3 秒怎么抓人），
**深色标签**是后面每个镜头中间截的一张。按镜头号对应下面的镜头表。

## 镜头切分（程序按画面变化自动切的，偶尔会把一个镜头切成两个、或漏掉很快的切换；你看图发现不对，就在逐镜头表里合并或注明）
${shotRows}

## 口播和对白（语音识别出来的，带大致时间；同音字可能错，按意思理解）
${transcript || (p.pastedScript?.trim() ? `（没识别出声音，下面是用户贴的文案）\n${p.pastedScript.trim()}` : '（这条没有识别出口播，可能是纯画面 + 音乐）')}

${taxonomy()}

## 你看不到、听不到的（必须老实）
- **画面上的字（字幕、花字、招牌、墙上的字）只写看得清的**：有一个字看不清，这一句就写「看不清」，**绝对不要猜着补**。
  说了什么以上面的语音识别为准，不要从画面上的字幕去猜口播。
  （实测：拼图里字小，模型把墙上的「我是河南人」看成墓碑、把「当服务员」读成「当厨房门」，编出了原片没有的情节）
- **分清谁在说**：人物对着镜头说的是同期声；用第三人称讲"她/他"的是旁白。语音识别分不清"他"和"她"，按画面判断
- **看清道具属于哪个镜头**：这个镜头里人物拿着什么就写什么，不要把别的镜头里的东西（话筒、酒瓶）挪过来
- **声音**：识别结果里带 🎼 的那一段有背景音乐，可以直接写"有背景音乐"；具体什么曲风、有没有音效、语气语速，听不到，推断的写「（推测）」
- 大部分镜头只截了一张图，**运镜**只能从同一镜头的前后几张图判断；判断不了写「固定/看不出」，不要编
- 看不清的细节写「看不清」，不要猜内容

## 输出（Markdown，按下面的顺序和标题，一节都不能少）

### 一句话：这条为什么能火
一两句话，点出最核心的一个原因。

### 〇、值不值得学
- 是不是真爆（有粉丝数就按"点赞是粉丝的几倍"判断，没有就说看不出）；互动比说明什么（收藏高=干货、评论高=争议或共鸣、转发高=值得拿去分享）
- 有没有这三种情况：挂车营销（数据可能是投流）、靠特殊身份（明星名人）、没有商业目的（对口型、变装、跳舞）——有的话明说"不建议照着学"，后面照样拆

### 一、账号层
人设（六种里哪种、凭什么这么判断）、呈现方式和视角、看得出是不是系列内容

### 二、选题层
- 写作对象：拍给谁看（越具体越好）
- 爆款元素：八大里用了哪个（最多两个），落在哪句话、哪个画面上
- 作用：流量型/人设型/变现型，判断依据
- 如果是实体店：观众看完为什么想去（成交理由），没有就写"没有转化设计"

### 三、开篇拆解（最重要的一节）
- **前 2 秒**：第一眼靠什么抓人——画面、声音还是第一句话；引发了什么情绪；对应开篇 36 计里哪一计、六大钩子里哪一种
- **前 5 秒**：用什么让人想看下去（埋了什么期待）
- 钩子在后面**兑现了没有**，在第几秒兑现

### 四、结构骨架和情绪曲线
- 脚本类型：四大脚本里哪一种；如果是按起号 36 计的打法拍的，写出是哪一计
- 分段表：| 时间 | 这一段干什么（抓人/铺垫/冲突/证据/高潮/兑现/行动指令） | 具体内容 |
- 情绪曲线：四种里哪种；情绪起伏点在第几秒、靠什么；按时长看起伏点够不够（15 秒 1 个、1 分钟 2～3 个、3 分钟 3～5 个）

### 五、逐镜头拆解
**不要用一张十几列的大表**——列太多，页面上挤成一团没法看。分两部分写：

**1. 节奏一览**：一个镜头一行，只有这 5 列，每格不超过 12 个字：
| 镜头 | 时间 | 景别 | 这一镜干什么 | 情绪 |
情绪用圆点表示强弱，比如 3 分写 ●●●○○

**2. 逐个镜头**：每个镜头一段，**严格照这个格式**（标题用四级标题，下面 5 行列表，不要表格）：

#### 镜头 3｜00:12.3–00:29.3｜17.0 秒｜●●●○○
- **画面**：这一镜拍了什么（人物在干什么、手里拿着什么）
- **镜头语言**：景别 · 运镜 · 构图和光线 · 写实/写意 · 置景（用 · 隔开，一行写完）
- **说了什么**：「口播或字幕原话」（标明同期声/旁白/字幕）
- **声音**：有没有背景音乐、音效
- **作用**：这一镜在整条里干什么（抓人/铺垫/证据/情绪点/兑现/行动指令），为什么放在这

**一个镜头一段，不要把几个镜头合成一段**（开头 3 秒那几张属于同一个镜头，合成那个镜头的一段）。
只有你看图确认前后两个镜头其实是同一个画面，才合并，并在"画面"里写明"和镜头 X 是同一个画面"——
实测模型把 7 个镜头合成一行、说"程序切碎了"，结果把中间一段唱歌的空镜漏了。

最后写 3～5 条**镜头层面的发现**：节奏（平均时长、前 3 秒切得够不够快）、景别怎么跟着情绪变、画面和口播是"说什么拍什么"还是互相补充、置景对内容有没有加分

### 六、包装
标题（用户给了才拆）、第一帧能不能当封面、字幕花字的用法；看不到的写"看不到"

### 七、能学走什么
- **能照搬的**：结构骨架写成可以直接套的公式（例：「反常识结论 → 3 秒证据 → 原理 → 你也能用」）、开篇句式、镜头节奏
- **不能照搬的**：靠身份、高成本、偶然性的部分，说清为什么学不来
${p.profileSummary?.trim()
    ? `- **套到这个账号上**：按下面的档案，给 3 个马上能拍的选题，每个写清用上面哪条骨架、开头第一句怎么说、在哪拍

## 当前账号档案（只在"套到这个账号上"时用）
${p.profileSummary.trim()}`
    : '- 用户还没有选账号档案，"套到自己店上"这一步先不做，最后提醒一句：选好档案可以一键套用'}

## 要求
- 每个判断都要有依据：指得出是第几秒、哪个镜头、哪句话
- 用大白话，不要"赋能""打造""矩阵"这类词
- 禁忌：不诋毁原作者和同行，不说"揭秘"，不用绝对化用语`;
}
