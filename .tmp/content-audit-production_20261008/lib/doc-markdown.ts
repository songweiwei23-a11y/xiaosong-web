/**
 * 把 AI 回答的 Markdown 拆成文档块（2026-10-04，自由对话「下载 Word / PDF」用）。
 *
 * 只认模型实际会写的那几种：标题、段落、有序 / 无序列表（含一层缩进）、表格、引用、分隔线、代码块；
 * 行内认加粗、斜体、行内代码、链接（只留文字和地址）。Word 和 PDF 共用这一份，两边排出来一致。
 * 纯函数，不依赖浏览器，能直接测。
 */

export interface InlineRun { text: string; bold?: boolean; italic?: boolean; code?: boolean }

export type DocBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; runs: InlineRun[] }
  | { type: 'paragraph'; runs: InlineRun[] }
  | { type: 'list'; ordered: boolean; items: { runs: InlineRun[]; level: number }[] }
  | { type: 'table'; header: InlineRun[][]; rows: InlineRun[][][] }
  | { type: 'quote'; runs: InlineRun[] }
  | { type: 'code'; text: string }
  | { type: 'hr' };

/** 行内：**加粗**、*斜体* / _斜体_、`代码`、[文字](地址) */
export function parseInline(src: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /(\*\*|__)(.+?)\1|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\p{L}\p{N}*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\p{L}\p{N}*])/gu;
  let last = 0;
  for (const m of src.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ text: src.slice(last, at) });
    if (m[2] !== undefined) runs.push(...parseInline(m[2]).map((r) => ({ ...r, bold: true })));
    else if (m[3] !== undefined) runs.push({ text: m[3], code: true });
    else if (m[4] !== undefined) runs.push({ text: m[5] && m[5] !== m[4] ? `${m[4]}（${m[5]}）` : m[4] });
    else if (m[6] !== undefined) runs.push(...parseInline(m[6]).map((r) => ({ ...r, italic: true })));
    last = at + m[0].length;
  }
  if (last < src.length) runs.push({ text: src.slice(last) });
  return runs.filter((r) => r.text);
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cellsOf = (l: string) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
const LIST_RE = /^(\s*)([-*+]|\d+[.、)])\s+(.*)$/;

export function parseMarkdownDoc(md: string): DocBlock[] {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', runs: parseInline(para.join(' ').trim()) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    // 代码块：原样保留
    if (/^\s*```/.test(line)) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const h = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) { flush(); blocks.push({ type: 'heading', level: Math.min(4, h[1].length) as 1 | 2 | 3 | 4, runs: parseInline(h[2]) }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ type: 'hr' }); continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const header = cellsOf(line).map(parseInline);
      const rows: InlineRun[][][] = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push(cellsOf(lines[i]).map(parseInline));
      i--;
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      const body: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) body.push(lines[i].replace(/^\s*>\s?/, ''));
      i--;
      blocks.push({ type: 'quote', runs: parseInline(body.join(' ')) });
      continue;
    }
    const li = line.match(LIST_RE);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items: { runs: InlineRun[]; level: number }[] = [];
      for (; i < lines.length; i++) {
        const m = lines[i].match(LIST_RE);
        if (m) { items.push({ runs: parseInline(m[3]), level: m[1].replace(/\t/g, '  ').length >= 2 ? 1 : 0 }); continue; }
        // 列表项折行：下一行缩进着、又不是新块，接到上一项后面
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1].runs.push(...parseInline(' ' + lines[i].trim())); continue; }
        break;
      }
      i--;
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** 文档标题：第一个一级 / 二级标题，没有就用第一行 */
export function docTitle(md: string, fallback = '开物方案'): string {
  const h = String(md || '').match(/^\s*#{1,2}\s+(.+?)\s*$/m)?.[1];
  const first = String(md || '').split('\n').find((l) => l.trim())?.trim();
  return (h || first || fallback).replace(/[*_`#]/g, '').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40) || fallback;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const runsHtml = (runs: InlineRun[]) => runs.map((r) => {
  let t = esc(r.text);
  if (r.code) t = `<code>${t}</code>`;
  if (r.italic) t = `<em>${t}</em>`;
  if (r.bold) t = `<strong>${t}</strong>`;
  return t;
}).join('');

/** 打印 / 存 PDF 用的整页 HTML（A4 排版） */
export function docToPrintHtml(blocks: DocBlock[], title: string): string {
  const body = blocks.map((b) => {
    switch (b.type) {
      case 'heading': return `<h${b.level}>${runsHtml(b.runs)}</h${b.level}>`;
      case 'paragraph': return `<p>${runsHtml(b.runs)}</p>`;
      case 'quote': return `<blockquote>${runsHtml(b.runs)}</blockquote>`;
      case 'code': return `<pre>${esc(b.text)}</pre>`;
      case 'hr': return '<hr>';
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map((it) => `<li${it.level ? ' class="sub"' : ''}>${runsHtml(it.runs)}</li>`).join('')}</${tag}>`;
      }
      case 'table': return `<table><thead><tr>${b.header.map((c) => `<th>${runsHtml(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${b.header.map((_, j) => `<td>${runsHtml(r[j] ?? [])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
  }).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:18mm 16mm}
body{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif;color:#1f2328;font-size:11pt;line-height:1.75;margin:0}
h1{font-size:20pt;margin:0 0 12pt;border-bottom:1.5pt solid #1f2328;padding-bottom:6pt}
h2{font-size:15pt;margin:18pt 0 8pt}h3{font-size:12.5pt;margin:14pt 0 6pt}h4{font-size:11.5pt;margin:12pt 0 4pt}
h1,h2,h3,h4{page-break-after:avoid}p{margin:0 0 7pt}ul,ol{margin:0 0 8pt;padding-left:20pt}li{margin:2pt 0}li.sub{margin-left:16pt}
table{width:100%;border-collapse:collapse;margin:6pt 0 10pt;font-size:10pt;page-break-inside:auto}tr{page-break-inside:avoid}
th,td{border:0.75pt solid #9aa1a9;padding:4pt 6pt;text-align:left;vertical-align:top}th{background:#eef1f4}
blockquote{margin:6pt 0 10pt;padding:4pt 10pt;border-left:3pt solid #9aa1a9;color:#444}
pre{white-space:pre-wrap;background:#f4f5f7;padding:6pt 8pt;font-size:9.5pt}code{font-family:Consolas,monospace}hr{border:0;border-top:0.75pt solid #ccc;margin:12pt 0}
</style></head><body>${body}</body></html>`;
}
