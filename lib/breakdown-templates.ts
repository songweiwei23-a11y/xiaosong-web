/**
 * 拆解报告里的「套用模版」（2026-10-12 按方案 2 定稿）：
 * 拆解的目的是二创。模版就是「用同一套拆解理论去二创」的完整稿：先照拆解出来的结构逐段复刻，
 * 再把新题材逐段套进去，写到能直接拍、能直接念。
 * - TEMPLATE_SPEC：视频拆解和文字拆解两种提示词共用的模版格式（写进提示词）。
 * - parseBreakdownTemplates：从模型交付的报告里切出每个模版，页面上每个模版带去选题 / 脚本 / 分镜的按钮。
 * 模版固定用「### 模版N｜名称」开头，下面是固定字段，解析靠这个格式，改格式要两边一起改。
 */

export const TEMPLATE_SPEC = `### 八、套用模版（至少 5 个，每个都是一份可以直接拍或直接念的二创稿）

拆解的目的是二创：每个模版都用上面拆解的同一套理论，把原片的结构逐段复刻到新题材上，详细程度和拆解一样。用这个固定标题开头，下面的字段一个都不能少，顺序也不变：

### 模版N｜模版名称（4–10 个字）
- **目的**：流量型 / 人设型 / 变现型，只写一个，和拆解结论保持一致
- **二创方向**：一句话，新题材是什么、拍给谁看、为什么能复刻原片的爆点
- **二创结构**：按原片的分段表逐段写，每段一行，格式：时间段 · 这段的功能（抓人 / 铺垫 / 冲突 / 证据 / 高潮 / 兑现 / 行动指令，照原片这一段的功能写）· 理论依据（用了拆解里的哪条知识，直接写名字，如「开篇 36 计：盲盒」「四大脚本：情绪型」「八大元素：反认知」，并说明它对应原片的哪一段）· 新题材的具体内容（这一段要说的话的要点，写成能直接念的句子，或要拍的事）
- **二创开篇**：照拆解的「开篇拆解」写：前 2 秒靠什么抓人（用哪个钩子或开篇 36 计）、前 5 秒埋什么期待、钩子在哪一秒兑现；给出新题材的开头第一句
- **二创情绪曲线**：沿用原片的情绪曲线类型，写出新题材里每个起伏点在第几秒、靠什么做起伏
- **二创镜头**（视频）：和拆解的逐镜头一样详细，给 3–6 个镜头，每个写景别、运镜、画面、台词、它在整条里的作用（用了哪条理论）；（文字）每一段写清表达方式和要点
- **适合的板块**：脚本 / 选题 / 分镜，写一个或几个，并说明为什么

二创要忠于原片的结构和爆点，只换题材、人物、场景和说法；不能只换词。新题材里没有的人、事、数字，一律用【待确认：…】占位，不编事实。没有档案时，行业和店铺写成【待确认：你的行业】。`;

export interface BreakdownTemplate {
  no: number;
  name: string;
  /** 「目的」字段原文（流量型 / 人设型 / 变现型） */
  purpose: string;
  /** 「二创方向」字段原文（老模版写的「方向」也认） */
  direction: string;
  /** 整个模版的正文（带去下一步时作为内容） */
  body: string;
}

const HEAD = /^#{2,4}\s*模版\s*(\d+)\s*[｜|:：]\s*(.+?)\s*$/;

function field(body: string, key: string): string {
  const m = body.match(new RegExp(`\\*{0,2}${key}\\*{0,2}\\s*[：:]\\s*\\*{0,2}\\s*([^\\n]+)`));
  return m ? m[1].replace(/\*+/g, '').trim() : '';
}

/** 切出报告里所有「### 模版N｜名称」块；遇到其他标题就结束当前模版 */
export function parseBreakdownTemplates(markdown: string): BreakdownTemplate[] {
  const out: BreakdownTemplate[] = [];
  let cur: { no: number; name: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join('\n').trim();
    out.push({ no: cur.no, name: cur.name, purpose: field(body, '目的'), direction: field(body, '二创方向') || field(body, '方向'), body });
    cur = null;
  };
  for (const line of markdown.split('\n')) {
    const h = line.match(HEAD);
    if (h) {
      flush();
      cur = { no: Number(h[1]), name: h[2].replace(/\*+/g, '').trim(), lines: [line] };
      continue;
    }
    if (cur && /^#{1,4}\s/.test(line)) {
      flush();
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  flush();
  return out;
}
