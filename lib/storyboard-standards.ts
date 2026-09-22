/**
 * 分镜脚本的专业标准。
 *
 * 改造前，分镜的提示词只有格式约束：表格必须有哪几列、景别要用哪个 emoji、
 * 输出 8-12 个镜头、后面再跟拍摄清单和拍摄技巧。一条方法论都没有——
 * 没说景别各自该干什么、运镜和情绪怎么对应、镜头该多长、画面和口播是
 * 什么关系。结果是产出「格式正确的表」，而不是「专业分镜」：
 * 列填满了，但每个镜头为什么是这个景别、为什么在这里切，说不出来。
 *
 * 这里补的是编导真正在用的判断依据：
 *   1. 景别的语言——每种景别承担什么任务，什么时候该用、什么时候会滥用
 *   2. 景别节奏——景别跟着情绪走，而不是随机分配
 *   3. 镜头时长——短视频的平均镜头时长和掉完播的临界点
 *   4. 运镜与情绪的对应，以及手机拍摄的现实约束
 *   5. 画面与口播的关系——「说什么拍什么」是新手最大的坑
 *   6. 剪辑点——镜头之间靠什么接得上
 *   7. 拍摄顺序——按机位合并，这是真正省时间的专业做法
 *   8. 轴线——跨轴会让观众瞬间失去方向感
 */

/** 五种景别各自的任务。这是整套方法论的地基 */
const SHOT_SIZE_LANGUAGE = `### 景别不是随便选的，每一种都有它的活儿

| 景别 | 它在替你说什么 | 什么时候用 | 滥用会怎样 |
|---|---|---|---|
| 远景 📷 | 交代这是哪儿、什么氛围 | 开场建立场景、结尾留白收束 | 短视频里超过 2 个远景就显得拖沓，观众等不及 |
| 全景 🎥 | 人和环境的关系、完整动作 | 展示全身动作、人物进出场 | 竖屏里人物太小，细节全丢，不能当主力 |
| 中景 📹 | 承载信息，最接近日常对话的距离 | 口播主体、讲解、访谈 | 全片都是中景 = 没有情绪起伏，像念稿 |
| 近景 📸 | 表情和态度，让观众读到人 | 情绪转折、强调观点、建立信任 | 连续超过 3 个会让人喘不过气 |
| 特写 🔍 | 感叹号：这个细节你必须看见 | 关键物件、微表情、情绪最高点 | **最容易被滥用**。用多了就不再是感叹号，全片建议不超过总镜头数的 1/4 |

**硬规则**：
- 同一景别连续超过 3 个镜头，观众会视觉疲劳，必须插入一个不同景别
- 相邻两个镜头的景别不要只差一档还拍同一主体（中景接近景拍同一个人），
  剪出来像跳帧；要么差两档，要么换角度
- 每条视频至少要有一个特写，否则整条片子没有「重音」`;

/** 景别随情绪推进，而不是均匀分配 */
const RHYTHM_GUIDE = `### 景别节奏：跟着情绪走

短视频的景别分布不是平均的，它应该画出一条和情绪一样的曲线：

- **开场（0-3秒）**：近景或特写起手。竖屏里观众第一眼只看得清脸和大物件，
  用远景开场等于把最宝贵的 3 秒浪费在交代环境上。
- **展开段**：中景为主，穿插近景。信息靠中景传递，观点靠近景加重。
- **情绪高潮**：特写 + 缩短镜头时长。这里是全片唯一该密集切的地方。
- **收尾**：拉回中景或全景。情绪需要一个"呼气"的位置，一直怼脸收不住。

**镜头时长**：
- 短视频平均镜头时长 **2-4 秒**
- 开场 3 秒内至少切 **2 个**镜头，静止不动的开场是完播率杀手
- 单个镜头超过 **6 秒**不切，除非画面里有持续发生的变化（动作、字幕递进）
- 高潮段可以压到 1-1.5 秒一切，但前后必须有慢镜头衬托，全片都快等于都不快`;

/** 运镜与情绪的对应，以及手机拍摄的现实约束 */
const CAMERA_MOVE_GUIDE = `### 运镜：每一个运动都要有理由

| 运镜 | 它制造什么感觉 | 适合放在哪 |
|---|---|---|
| 固定 | 稳定、可信、便于读信息 | 口播、讲解、需要看清字幕的地方 |
| 推镜 | 注意力收拢，情绪递进、压迫感 | 讲到关键点、抛出结论前 |
| 拉镜 | 揭示更大的真相、释然、收束 | 反转揭晓、结尾 |
| 摇镜 | 展示空间关系、罗列 | 展示店面、一排东西 |
| 移镜/跟随 | 代入感，观众"跟着走" | 探店进门、走动中的讲述 |

**手机拍摄的现实约束（必须遵守）**：
- 没有稳定器时，运动镜头很难稳。**运动镜头占比不超过总镜头数的 1/3**，
  其余用固定镜头 + 剪辑节奏来制造动感——这是低成本拍摄的正解
- 推拉优先用「走近/走远」而不是变焦，手机数码变焦会糊
- 每个运动镜头前后各留 1 秒静止，剪辑时才有干净的出入点`;

/** 画面与口播的关系——新手最大的坑 */
const VISUAL_VS_NARRATION = `### 画面不要复述台词

这是新手分镜最常见、也最致命的问题：台词说"我们的牛肉很新鲜"，
画面就拍一块牛肉。观众同时用眼睛和耳朵接收到同一条信息，
等于有一半带宽被浪费了。

画面应该做三件事之一：
1. **佐证**——台词说"老板每天五点去市场"，画面拍凌晨的市场和挂着水珠的箱子
2. **补充**——台词讲道理，画面给具体场景，让抽象的话落地
3. **反差**——台词说"看起来很简单"，画面拍手忙脚乱的失败现场，制造张力

每个镜头的「画面内容」栏，都要能回答：**这一格画面提供了台词没说的什么信息？**
答不上来的，这个镜头就是废镜头，该删或该换。`;

/** 剪辑点与轴线 */
const EDITING_GUIDE = `### 镜头之间靠什么接上

给出分镜时要顺带想清楚剪辑点，否则拍回来接不上：
- **动作接动作**：上一个镜头手伸出去，下一个镜头手已经碰到——动作连贯，切口隐形
- **视线引导**：人物看向画外，下一个镜头就是他看的东西
- **同形状匹配**：圆形的锅接圆形的盘子，视觉上顺滑
- **声音先入**：下一个镜头的声音提前 0.5 秒进来，是最自然的过渡

**轴线（180度法则）**：同一场戏里，机位要待在主体连线的同一侧。
跨到另一侧，观众会觉得人物突然"调了个头"，方向感瞬间混乱。
一个人的口播不涉及轴线，但只要出现两个人或"人看物"的关系，就必须守住。`;

/** 各内容类型的分镜设计要点。泛泛的方法论到这里才落地 */
const CONTENT_TYPE_GUIDE: Record<string, string> = {
  food: `**美食类的分镜重点**：
- 必须有至少 2 个特写：食材细节、成品的热气/拉丝/切开的瞬间
- "声音画面"很关键：下锅的滋啦、切开的脆响，分镜里要标出收音点
- 顺序遵循"诱惑 → 过程 → 兑现"：先给成品最勾人的那一口，再回到制作
- 人物出镜的镜头不要多，观众想看的是食物`,

  vlog: `**VLOG 类的分镜重点**：
- 景别可以更松，但必须有明确的"时间推进感"：光线变化、地点转换、动作节点
- 空镜（不含人的环境镜头）是 VLOG 的呼吸口，每 3-4 个镜头插一个
- 第一人称视角镜头（手持向前走、低头看手里的东西）能大幅提升代入感
- 避免流水账：每一段都要有一个小的"发生了什么"，没事发生的段落直接砍`,

  tutorial: `**教程类的分镜重点**：
- 开场先给**成品**，让观众知道学完能得到什么，再回到第一步
- 每个操作步骤至少两个景别：中景看整体姿势，特写看手上细节
- 关键手部动作必须用特写 + 放慢，这是教程能不能"学会"的分水岭
- 步骤之间用统一的转场（如同一机位的切换），让结构感清晰`,

  product: `**产品类的分镜重点**：
- 开箱/揭示的瞬间必须是特写 + 略慢速，这是唯一的"哇"点
- 产品的质感靠光走：侧光打出纹理，分镜里要标明光位
- 功能演示要"before / after"成对出现，观众信的是对比不是形容词
- 手持产品的镜头，手要干净、动作要慢，快了显廉价`,

  story: `**故事类的分镜重点**：
- 严守轴线。剧情类一旦跨轴，观众会立刻出戏
- 冲突点用特写捕捉微表情，这是故事类唯一不能省的镜头
- 对话戏用"正反打"：A 的过肩镜头 + B 的过肩镜头，两个机位交替
- 开场用一个能立刻建立处境的画面，不要用字幕交代背景`,

  interview: `**访谈类的分镜重点**：
- 主机位固定中景（受访者），副机位近景（捕捉表情），交替剪辑
- 提问者的镜头只在必要时给，观众来听的是受访者
- 关键观点出现时切近景，这是访谈类制造重音的唯一手段
- 必须准备 B-roll（受访者工作/生活的空镜）覆盖剪辑点，否则跳剪会很硬`,
};

/** 视觉风格落到可执行的光线与色彩 */
const VISUAL_STYLE_GUIDE: Record<string, string> = {
  cinematic: '低饱和、暗部保留细节、侧逆光勾边；镜头少而稳，宁可长一点',
  bright: '顺光或大面积柔光、高饱和、白平衡偏冷一点点；镜头切换可以更快',
  warm: '暖色调、黄昏或暖灯光、柔焦；运镜缓慢，多用固定和轻推',
  cool: '冷白光、高对比、硬光影；可用快切和硬转场',
  vintage: '降低对比、加轻微颗粒、色偏黄绿；固定镜头为主，少运镜',
  minimal: '大面积留白、单一光源、构图居中或三分；镜头数少，每个镜头都干净',
};

/** 各平台的画幅与安全区——分镜阶段就要定，拍完再发现被遮就晚了 */
const PLATFORM_FRAME: Record<string, string> = {
  抖音: '竖屏 9:16。主体放在画面中上部——底部约 1/5 会被文案和按钮遮住，重要信息不要放那里',
  小红书: '竖屏 3:4 或 9:16。3:4 更适合展示物品和排版文字，画面上下更充裕',
  视频号: '竖屏 9:16。中老年观众多，主体要大、字幕要大，别用小字和细线条',
  B站: '横屏 16:9。可以承载更复杂的构图和更长的镜头，信息密度可以高',
  快手: '竖屏 9:16。真实感优先，不要过度构图，手持的轻微晃动反而加分',
};

export interface StoryboardPromptParams {
  scriptContent: string;
  platform: string;
  /** 形如 "60秒" */
  duration: string;
  /** CONTENT_TYPES 的 value：food/vlog/tutorial/product/story/interview */
  contentType: string;
  /** VISUAL_STYLES 的 value */
  visualStyle: string;
  /** 视觉风格的中文标签 */
  visualStyleLabel: string;
  additionalInfo: string;
}

/** 把目标时长解析成秒数，顺带给出建议镜头数 */
function planShots(duration: string): { seconds: number; min: number; max: number } {
  // "3-5分钟" 这类取上界的分钟数；"60秒" 直接取数字
  const minuteMatch = duration.match(/(\d+)\s*-\s*(\d+)\s*分/);
  const seconds = minuteMatch
    ? Number(minuteMatch[2]) * 60
    : /分/.test(duration)
      ? (Number(duration.match(/\d+/)?.[0]) || 1) * 60
      : Number(duration.match(/\d+/)?.[0]) || 60;

  // 按平均 2-4 秒一个镜头反推。上限压一压：镜头太碎拍不完也剪不动
  const min = Math.max(4, Math.round(seconds / 4));
  const max = Math.max(6, Math.min(40, Math.round(seconds / 2)));
  return { seconds, min, max };
}

/**
 * 先用代码量一遍脚本，把客观数据交给模型。
 * 和审稿那边同一个思路：数得清的交给代码，判断力的交给模型。
 */
function scriptFacts(script: string, targetSeconds: number): string {
  const words = script.replace(/\s/g, '').length;
  // 口播按 5 字/秒，与脚本页和审稿的统计口径一致
  const spokenSeconds = Math.round(words / 5);
  const hasTiming = /\d+\s*-\s*\d+\s*秒/.test(script);
  const existingShots = (script.match(/【?镜头\s*\d+】?/g) || []).length;
  // 中文句读切分，用来估算能拆出多少个信息单元
  const sentences = script.split(/[。！？\n]/).filter((s) => s.trim().length > 4).length;

  const lines = [
    '## 🔍 系统预检（客观数据，请以此为准，不要另行估算）',
    '',
    `- 脚本正文：${words} 字，按口播 5 字/秒约 **${spokenSeconds} 秒**`,
    `- 目标时长：**${targetSeconds} 秒**`,
    `- 可切分的信息单元：约 ${sentences} 句`,
    `- 脚本自带秒数标注：${hasTiming ? '有' : '无'}`,
    `- 脚本自带镜头编号：${existingShots > 0 ? `${existingShots} 个` : '无'}`,
  ];

  const gap = spokenSeconds - targetSeconds;
  if (gap > targetSeconds * 0.2) {
    lines.push(
      '',
      `⚠️ **口播时长超出目标 ${gap} 秒**。请在分镜里明确标出哪几句建议删减或压缩，`,
      '不要硬塞进时长表——分镜表里的秒数必须是真的拍得出来的。'
    );
  } else if (gap < -targetSeconds * 0.2) {
    lines.push(
      '',
      `⚠️ **口播只够 ${spokenSeconds} 秒，比目标短 ${Math.abs(gap)} 秒**。`,
      '请用空镜、演示动作、字幕停留把时长补足，并在拍摄要点里说明补在哪。'
    );
  }

  return lines.join('\n');
}

export interface StoryboardAudit {
  /** 表格里识别到的镜头数 */
  shots: number;
  /** 各镜头时长相加 */
  totalSeconds: number;
  /** 目标时长 */
  target: number;
  /** 实际减目标，正为超时、负为不足 */
  diff: number;
  longest: number;
  closeUpRatio: number;
  moveRatio: number;
  /** 不达标的地方，给用户看的话 */
  issues: string[];
}

const MOVE_WORDS = ['推镜', '拉镜', '摇镜', '移镜', '跟随'];

/**
 * 核对模型排出来的分镜表。
 *
 * 为什么必须在代码里再算一遍：实测中模型的自检栏写着「总时长：60s（已对账）」，
 * 而表格实际相加是 55s——它声称加过了，其实没加。这和审稿模块把
 * 「2.5/100」写成「2.5 分」是同一类问题：模型会自信地断言一个它没真算过的数。
 *
 * 往提示词里再加几句「务必相加」解决不了，只能由代码来数。
 * 数出来的结果直接摆给用户，他拍之前就知道素材够不够。
 */
export function auditStoryboard(markdown: string, duration: string): StoryboardAudit | null {
  const target = planShots(duration || '60秒').seconds;

  // 只取分镜表的数据行：以 | 开头、第二格是纯数字（镜号）
  const rows = (markdown || '')
    .split('\n')
    .filter((line) => /^\s*\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split('|').map((c) => c.trim()));

  if (rows.length === 0) return null;

  const durations: number[] = [];
  let closeUps = 0;
  let moves = 0;

  for (const cells of rows) {
    // 表格列序：| 镜号 | 景别 | 运镜 | 画面 | 台词 | 时长 | 拍摄要点 |
    // split('|') 后首尾各有一个空串，所以镜号在 [1]、时长在 [6]
    const size = cells[2] ?? '';
    const move = cells[3] ?? '';
    const dur = cells[6] ?? '';

    const n = Number((dur.match(/[\d.]+/) || [])[0] || 0);
    if (n > 0) durations.push(n);

    if (size.includes('特写')) closeUps++;
    if (MOVE_WORDS.some((w) => move.includes(w))) moves++;
  }

  const shots = rows.length;
  const totalSeconds = Math.round(durations.reduce((a, b) => a + b, 0) * 10) / 10;
  const longest = durations.length ? Math.max(...durations) : 0;
  const closeUpRatio = shots ? Math.round((closeUps / shots) * 100) : 0;
  const moveRatio = shots ? Math.round((moves / shots) * 100) : 0;
  const diff = totalSeconds - target;

  const issues: string[] = [];
  // 2 秒以内的出入属于正常取整，不值得打扰用户
  if (Math.abs(diff) > 2) {
    issues.push(
      diff > 0
        ? `镜头时长合计 ${totalSeconds}s，比目标多 ${diff}s，拍出来会超时`
        : `镜头时长合计 ${totalSeconds}s，比目标少 ${Math.abs(diff)}s，素材会不够`
    );
  }
  if (closeUpRatio > 25) issues.push(`特写占 ${closeUpRatio}%，超过 25% 的建议上限，感叹号用多了就不响了`);
  if (moveRatio > 33) issues.push(`运动镜头占 ${moveRatio}%，手机没有稳定器时建议不超过 33%`);
  if (longest > 6) issues.push(`最长镜头 ${longest}s，超过 6s 不切容易掉完播，确认画面里有持续变化`);

  return { shots, totalSeconds, target, diff, longest, closeUpRatio, moveRatio, issues };
}

export function buildStoryboardPrompt(p: StoryboardPromptParams): string {
  const script = p.scriptContent || '';
  const { seconds, min, max } = planShots(p.duration || '60秒');
  const parts: string[] = [];

  parts.push('# 短视频分镜脚本');
  parts.push('');
  parts.push('你是一位拍过上千条短视频的执行导演，现在要把这条口播稿拆成');
  parts.push('拍摄当天能直接照着执行的分镜。拿到你这份分镜的人可能只有一部手机、');
  parts.push('一个人、没有灯——你给的每一个镜头都必须是他真的拍得出来的。');
  parts.push('');

  parts.push('## 📄 待拆解的脚本');
  parts.push('');
  parts.push(script || '未提供脚本内容');
  parts.push('');

  parts.push('## 📌 拍摄条件');
  parts.push(`- 发布平台：${p.platform}`);
  parts.push(`- 目标时长：${p.duration}（${seconds} 秒）`);
  parts.push(`- 视觉风格：${p.visualStyleLabel}`);
  if (p.additionalInfo) parts.push(`- 补充说明：${p.additionalInfo}`);
  parts.push('');

  if (script) {
    parts.push(scriptFacts(script, seconds));
    parts.push('');
  }

  parts.push('## 🎬 分镜方法论（判断依据，不是可选项）');
  parts.push('');
  parts.push(SHOT_SIZE_LANGUAGE);
  parts.push('');
  parts.push(RHYTHM_GUIDE);
  parts.push('');
  parts.push(CAMERA_MOVE_GUIDE);
  parts.push('');
  parts.push(VISUAL_VS_NARRATION);
  parts.push('');
  parts.push(EDITING_GUIDE);
  parts.push('');

  const typeGuide = CONTENT_TYPE_GUIDE[p.contentType];
  if (typeGuide) {
    parts.push('## 🎯 本类内容的特殊要求');
    parts.push('');
    parts.push(typeGuide);
    parts.push('');
  }

  const frame = PLATFORM_FRAME[p.platform];
  const style = VISUAL_STYLE_GUIDE[p.visualStyle];
  if (frame || style) {
    parts.push('## 🖼 画幅与影调');
    parts.push('');
    if (frame) parts.push(`- **${p.platform}**：${frame}`);
    if (style) parts.push(`- **${p.visualStyleLabel}**：${style}`);
    parts.push('');
  }

  parts.push('## 📤 输出格式（严格按顺序，不要有任何前言）');
  parts.push('');
  parts.push('### 第一行必须是');
  parts.push('```');
  parts.push('# 🎬 分镜脚本表');
  parts.push('```');
  parts.push('');
  parts.push('### 1. 分镜表（markdown 表格）');
  parts.push('');
  parts.push('| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |');
  parts.push('|---|---|---|---|---|---|---|');
  parts.push('');
  parts.push(`共 **${min}-${max} 个镜头**。`);
  parts.push('');
  // 实测里模型排出来的总时长是 56 秒而不是 60 秒，自检那栏也没抓出来。
  // 时长对不上，拍摄当天就会发现素材不够或者超时，必须写死对账动作。
  parts.push(`**时长必须对账**：把「时长」这一列的数字全部相加，结果必须**正好等于 ${seconds}**。`);
  parts.push('写完表之后自己加一遍：');
  parts.push(`- 少了就把差额补在信息量最大的那个镜头上，或者加一个空镜；`);
  parts.push(`- 多了就压缩重复的镜头，不要靠删内容凑数。`);
  parts.push(`加不到 ${seconds} 就回去改表，不允许写一个对不上的数字。`);
  parts.push('');
  parts.push('每一栏的要求：');
  parts.push('- **景别**：中文 + emoji（远景📷 / 全景🎥 / 中景📹 / 近景📸 / 特写🔍）');
  parts.push('- **运镜**：固定 / 推镜 / 拉镜 / 摇镜 / 移镜 / 跟随');
  parts.push('- **画面内容**：具体到「谁在哪做什么、镜头对着什么」，');
  parts.push('  且必须提供台词之外的信息（见上文「画面不要复述台词」）');
  parts.push('- **台词/旁白**：从原脚本里摘的原句，不要改写；没有台词写「无」');
  parts.push('- **时长**：数字 + s，如 3s');
  parts.push('- **拍摄要点**：这一个镜头拍的时候最容易失败的地方，一句话说清');
  parts.push('');

  parts.push('### 2. 📊 节奏自检');
  parts.push('');
  parts.push('把你自己排的表数一遍，如实填写（数字对不上就回去改表，不要改数）：');
  parts.push('');
  parts.push('- 景别分布：特写 X 个 / 近景 X 个 / 中景 X 个 / 全景 X 个 / 远景 X 个');
  parts.push('- 特写占比：X%（应 ≤ 25%）');
  parts.push('- 运动镜头占比：X%（手机拍摄应 ≤ 33%）');
  parts.push('- 最长镜头：Xs（超过 6s 需说明画面里在持续发生什么）');
  parts.push('- 开场 3 秒内镜头数：X 个（应 ≥ 2）');
  parts.push('- 总时长：Xs（必须等于 ' + seconds + 's）');
  parts.push('- 是否存在同一景别连续超过 3 个：是/否');
  parts.push('');

  parts.push('### 3. 🎥 拍摄顺序建议');
  parts.push('');
  parts.push('**不按镜号顺序拍**——按机位和场景合并，这是真正省时间的地方。');
  parts.push('用表格给出：| 拍摄批次 | 包含镜号 | 机位/场景 | 一次布置能拍完的理由 |');
  parts.push('');

  parts.push('### 4. 🧰 拍摄清单');
  parts.push('');
  parts.push('- **必备**：手机 + 哪些最低限度的东西（三脚架/支架等）');
  parts.push('- **加分项**：有了会明显更好的（补光灯/领夹麦等），并说明它解决什么问题');
  parts.push('- **道具与场地**：从分镜表里反推出来的清单，拍之前要备齐的');
  parts.push('');

  parts.push('### 5. ⚠️ 这条片子最容易翻车的 3 个地方');
  parts.push('');
  parts.push('结合这份分镜的具体内容说，不要写「注意光线」这种放之四海皆准的话。');
  parts.push('每条格式：【风险】会发生什么 →【怎么避】具体动作');
  parts.push('');

  parts.push('---');
  parts.push('');
  parts.push('**禁止**：输出纯文字描述而不给表格；说「希望对你有帮助」之类的话；');
  parts.push('反问用户要更多信息——信息不足的地方按最常见的情况假设，并在拍摄要点里注明。');

  return parts.join('\n');
}
