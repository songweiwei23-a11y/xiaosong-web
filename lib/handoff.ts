/**
 * 功能之间的内容交接。
 *
 * 改版前九个功能互不相通：选中一条选题要手动复制到脚本页，脚本写完再手动
 * 复制到分镜页、审稿页、标题页——同一条内容一路要粘贴四五次。
 * 这里提供一个轻量的中转：发起方存下要带走的字段，目标页进入时取出填好。
 *
 * 为什么用 sessionStorage 而不是 URL 参数：脚本正文动辄两三千字，放进
 * 地址栏会超长（多数浏览器约 2000 字符上限），且会把内容暴露在历史记录里。
 * 又为什么不用全局状态：跳转会重新挂载页面，内存态活不过这一跳。
 *
 * 数据是一次性的：取出即清除，避免用户下次自己进这个页面时又被填一遍。
 */

const KEY = "xiaosong-handoff";

/** 各功能页用来接收的字段名，与页面里的 state 对应 */
export interface HandoffPayload {
  /** 来源功能名，用于在目标页提示「内容来自哪里」 */
  from: string;
  /** 视频主题 / 选题：脚本页、标题页用 */
  topic?: string;
  /** 脚本正文：分镜页、审稿页用 */
  scriptContent?: string;
  /** 选题列表：从选题结果里解析出来，供脚本页挑一条 */
  topicOptions?: string[];
  /** 补充说明 */
  note?: string;
  /**
   * 所属作品。带着它，下一个环节生成出来的内容才会挂到同一条内容下，
   * 而不是变成又一条互不相干的零散记录。
   */
  workId?: string;
  /**
   * 现有的开头，开篇钩子页用来做优化。
   * 从脚本带过去时自动截取正文开头那几句——用户想换的就是这几句，
   * 让他自己从两千字里找出来再粘过去是多余的。
   */
  currentOpening?: string;
  /** 目标页要落在哪个标签上（起号页有「起号打法」和「开篇钩子」两个） */
  tab?: string;
  /**
   * 这条内容用的起号计（计名，取自 lib/growth-tactics）。
   *
   * 打法不是选题，是拍法——同一个选题套「反向操作」和套「情境还原」
   * 拍出来是两条完全不同的片子。所以它要跟着选题一路传到脚本，
   * 脚本才能按那一计的结构公式来排，并守住那一计的边界。
   */
  tactic?: string;
  /**
   * 这条内容用的开篇卡（卡名，取自 lib/opening-cards）。
   * 传给标题页时，标题会和开头赌同一个钩子，不会自己跟自己打架。
   */
  openingCards?: string[];
}

/**
 * 从脚本正文里截出开头那几句。
 *
 * 脚本动辄两三千字，而「开篇」指的是前 3 秒念出来的那句话。
 * 带整篇过去，模型要在里面猜哪句是开头；用户自己找又麻烦。
 * 所以这里按结构标记和句读取前面一小段。
 */
export function extractOpening(script: string, maxLen = 120): string {
  if (!script?.trim()) return "";
  // 去掉【开场】0-5秒 这类结构标记，留下真正要念的话
  const cleaned = script
    .replace(/^#+.*$/gm, "")
    .replace(/【[^】]*】/g, "")
    .replace(/^\s*\d+[.、)]\s*/gm, "")
    .replace(/\d+\s*[-–]\s*\d+\s*秒[：:]?/g, "")
    .trim();
  const firstPara = cleaned.split(/\n\s*\n/)[0]?.trim() || cleaned;
  if (firstPara.length <= maxLen) return firstPara;
  // 超长就按句号断，宁可短也不要切在半句上
  const cut = firstPara.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
  return lastStop > 20 ? cut.slice(0, lastStop + 1) : cut;
}

/** 存下要交接的内容。调用方随后自行跳转 */
export function putHandoff(payload: HandoffPayload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式下写不进去，那就退化成「跳过去但不带内容」，不影响跳转本身
  }
}

/** 取出并清除。目标页在挂载时调用一次 */
export function takeHandoff(): HandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 从选题结果里解析出每一条选题的标题。
 *
 * 生成出来的格式形如：
 *   ## 选题1：濮阳开店三年，我用手机拍了60条视频
 *   ### 选题 2 - 三个月帮 7 家饭店从冷清到爆满
 * 序号、分隔符、标题层级都不完全统一，所以放宽匹配，
 * 只要是「选题 + 数字」开头的标题行就算。
 */
export function parseTopicOptions(markdown: string): string[] {
  if (!markdown) return [];

  const out: string[] = [];
  for (const line of markdown.split("\n")) {
    const m = line.match(/^#{1,4}\s*\**\s*选题\s*\d+\s*[：:\-—、.]\s*(.+)$/);
    if (m) {
      const title = m[1]
        .replace(/\*\*/g, "")
        .replace(/\s*[（(].*?[）)]\s*$/, "") // 去掉结尾的括号备注
        .trim();
      if (title) out.push(title);
    }
  }
  return out;
}
