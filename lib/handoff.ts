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
