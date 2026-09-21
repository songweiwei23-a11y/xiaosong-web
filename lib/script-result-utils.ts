/**
 * 生成结果的解析工具：拆分质量报告、提取标题、估算口播时长。
 *
 * 独立成文件是为了能直接写单测——这些规则要处理历史遗留数据
 * （早期的记录把质量报告拼在正文里），出错会让用户看到脏内容。
 */

/**
 * 质量报告的起始标记，由 lib/quality-checker.ts 的 formatQualityReport 产生。
 *
 * 三个色标必须写成交替 (?:🟢|🟡|🔴) 而不是字符类 [🟢🟡🔴]：
 * 这些 emoji 在 UTF-16 里是代理对，放进字符类会被拆成单独的码元，
 * 导致匹配到半个字符、整条规则失效。
 */
const REPORT_HEADING = /##\s*(?:🟢|🟡|🔴)\s*脚本质量评分/;

/** 正文与报告之间的分隔线，可能带任意数量的空行 */
const REPORT_SPLIT = /\n*-{3,}\n*(?=##\s*(?:🟢|🟡|🔴)\s*脚本质量评分)/;

export interface SplitResult {
  /** 脚本正文，复制与下载只用这一部分 */
  body: string;
  /** 质量报告原文，没有则为空串 */
  report: string;
}

/**
 * 把质量报告从正文里拆出来。
 *
 * 早期实现把报告直接拼在正文末尾，导致用户复制脚本时会连报告一起带走，
 * 粘到剪辑脚本里还得手动删。这里统一拆开：正文归正文，报告单独展示。
 * 历史记录中已经拼在一起的旧数据，读取时同样会被拆开。
 */
export function splitQualityReport(text: string): SplitResult {
  if (!text) return { body: "", report: "" };

  const parts = text.split(REPORT_SPLIT);
  if (parts.length >= 2) {
    return { body: parts[0].trimEnd(), report: parts.slice(1).join("\n").trim() };
  }

  // 没有分隔线但有报告标题的情况（早期格式），退而从标题处切
  const idx = text.search(REPORT_HEADING);
  if (idx > 0) {
    return { body: text.slice(0, idx).replace(/\n*-{3,}\s*$/, "").trimEnd(), report: text.slice(idx).trim() };
  }

  return { body: text, report: "" };
}

export interface QualitySummary {
  /** 0–10 分，解析不到时为 null */
  score: number | null;
  /** 等级文案，如「MCN级」 */
  level: string;
  /** 是否达标 */
  passed: boolean;
}

/**
 * 从报告文本里解析出结构化的评分，用于画分数条而不是让用户读一段文字。
 *
 * 之所以从文本解析而不是直接用评分函数的返回值：历史记录里存的是成文的
 * 报告，重新跑一遍评分既慢又可能因为规则更新而和当初的结论不一致。
 */
export function parseQualitySummary(report: string): QualitySummary {
  if (!report) return { score: null, level: "", passed: false };

  const scoreMatch = report.match(/\*\*得分\*\*：\s*([\d.]+)/);
  const levelMatch = report.match(/\*\*等级\*\*：\s*(.+)/);
  const score = scoreMatch ? Number.parseFloat(scoreMatch[1]) : null;

  return {
    score: score !== null && Number.isFinite(score) ? score : null,
    level: levelMatch ? levelMatch[1].trim() : "",
    passed: /✅\s*达标/.test(report),
  };
}

/**
 * 从脚本正文里提取一个能认出是哪一条的标题。
 *
 * 历史列表原先展示的是「去掉所有格式符号后的前 80 字」，几条记录看起来
 * 几乎一样，根本分不清谁是谁。这里优先取 Markdown 标题，其次取第一句有
 * 实质内容的话。
 */
export function extractTitle(text: string, maxLen = 28): string {
  if (!text) return "未命名脚本";

  const lines = text.split("\n");

  // 优先：第一个 Markdown 标题，但跳过"脚本质量评分"这类元信息标题
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)$/);
    if (m) {
      const title = m[1].replace(/[*`_]/g, "").trim();
      if (title && !REPORT_HEADING.test(line) && !/^(脚本|结果|输出)$/.test(title)) {
        return truncate(title, maxLen);
      }
    }
  }

  // 其次：第一行足够长的正文
  for (const line of lines) {
    const clean = line.replace(/^[#>\-*\d.、\s]+/, "").replace(/[*`_|]/g, "").trim();
    if (clean.length >= 6) return truncate(clean, maxLen);
  }

  return "未命名脚本";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * 估算口播时长。
 *
 * 中文口播速度约每分钟 300 字，即每秒 5 字。编导拿到脚本后第一件事就是
 * 判断"这条能不能压进 60 秒"，把这个数直接标出来省得他自己数。
 * 只统计中文、英文单词和数字，Markdown 符号不计入。
 */
export function estimateSpeechStats(text: string): { chars: number; seconds: number } {
  if (!text) return { chars: 0, seconds: 0 };

  const stripped = text
    .replace(/```[\s\S]*?```/g, "")   // 代码块
    .replace(/[#>*`_|~\-]/g, "")      // Markdown 符号
    .replace(/\[(.*?)\]\(.*?\)/g, "$1"); // 链接只留文字

  const chinese = (stripped.match(/[一-龥]/g) || []).length;
  const words = (stripped.match(/[a-zA-Z]+/g) || []).length;
  const digits = (stripped.match(/\d+/g) || []).length;

  const chars = chinese + words + digits;
  return { chars, seconds: Math.round(chars / 5) };
}

/** 秒数格式化成「1分30秒」这种读起来直观的形式 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}分钟` : `${m}分${s}秒`;
}

/**
 * 相对时间。列表里「2小时前」比「2026/9/21 17:59:05」好认得多，
 * 超过一周才退回具体日期。
 */
export function formatRelativeTime(input: string | number | Date): string {
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "";

  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);

  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;

  const day = Math.floor(hour / 24);
  if (day === 1) return "昨天";
  if (day < 7) return `${day} 天前`;

  const d = new Date(then);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
