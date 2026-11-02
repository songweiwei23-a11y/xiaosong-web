/**
 * 回答 / 方案下载成 Word、PDF（2026-10-04）。浏览器里生成，不上传、不扣次数。
 *
 * - Word：真正的 .docx（开源库 docx，点下载时才加载），标题层级、列表、表格、加粗都保留，打开能接着改
 * - PDF：浏览器自带的「打印 → 另存为 PDF」，A4 排版；用隐藏的 iframe 打印，不弹新窗口（不会被拦）
 * Markdown 怎么拆见 lib/doc-markdown。
 *
 * 2026-11-02 产品方：所有产出内容都能下载 Word，「排版要干净整洁、简约大气」。版式：
 *   A4、页边距 2 厘米；顶部大标题 + 一行「板块 · 开物生成 · 日期」+ 细分隔线；
 *   正文微软雅黑、1.5 倍行距；二级标题深蓝、下面一条浅灰细线；表格浅灰细边框、表头浅底；
 *   引用左边一道深蓝竖线、浅底；页眉右上角小字「开物」，页脚居中页码。只用两种颜色（深灰正文 + 深蓝强调）。
 * 同日产品方：字再小一点、像飞书文档那样——正文 10.5 磅（五号，约等于飞书正文 14px），标题跟着收：
 *   大标题 16 磅、一级 14、二级 13、三级 12、四级 11，表格 9.5。
 */
import { docTitle, docToPrintHtml, parseMarkdownDoc, type DocBlock, type InlineRun } from './doc-markdown';

const FONT = 'Microsoft YaHei';
/** 字号，单位半磅（docx 的写法：21 = 10.5 磅） */
const SIZE = { body: 21, title: 32, meta: 18, table: 19, code: 18, small: 16 };
const C = { text:'1F2328', muted: '6B7280', accent: '1F3A68', line: 'D9DEE5', headFill: 'F3F5F8', quoteFill: 'F6F8FB', quoteText: '374151' };

export interface DocMeta {
  /** 哪个板块产出的（选题策划、脚本生成……），写在标题下面那一行 */
  board?: string;
  /** 文档日期，默认今天 */
  date?: Date;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 北京时间的日期：2026年11月2日 / 2026-11-02 */
function dateParts(d: Date) {
  const b = new Date(d.getTime() + 8 * 3600_000);
  const y = b.getUTCFullYear(), m = b.getUTCMonth() + 1, day = b.getUTCDate();
  return { cn: `${y}年${m}月${day}日`, iso: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

/** 文件名：标题去掉文件名里不能用的字符、最多 40 字，后面接日期 */
export function docFileName(title: string, date = new Date()): string {
  const clean = title.replace(/[\\/:*?"<>|#\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || '开物文档';
  return `${clean}-${dateParts(date).iso}.docx`;
}

/** 生成 Word 文档对象（下载和测试共用） */
export async function buildDocx(markdown: string, title = docTitle(markdown), meta: DocMeta = {}) {
  const d = await import('docx');
  const blocks = parseMarkdownDoc(markdown);
  const runs = (rs: InlineRun[], extra: { bold?: boolean; size?: number; color?: string } = {}) =>
    rs.map((r) => new d.TextRun({ text: r.text, bold: r.bold || extra.bold, italics: r.italic, font: r.code ? 'Consolas' : FONT, size: extra.size, color: extra.color, shading: r.code ? { type: d.ShadingType.CLEAR, color: 'auto', fill: C.headFill } : undefined }));
  const children: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
  const line = (color = C.line, size = 4) => ({ style: d.BorderStyle.SINGLE, size, color });

  // 抬头：标题 + 「板块 · 开物生成 · 日期」+ 细分隔线
  const { cn } = dateParts(meta.date ?? new Date());
  children.push(new d.Paragraph({ spacing: { after: 100 }, children: [new d.TextRun({ text: title, bold: true, size: SIZE.title, color: C.text, font: FONT })] }));
  children.push(new d.Paragraph({
    spacing: { after: 320 },
    border: { bottom: { ...line(C.accent, 8), space: 8 } },
    children: [new d.TextRun({ text: [meta.board, '开物生成', cn].filter(Boolean).join('  ·  '), size: SIZE.meta, color: C.muted, font: FONT })],
  }));

  const HEADING = {
    1: { size: 28, color: C.text, before: 360, after: 140 },
    2: { size: 26, color: C.accent, before: 320, after: 120 },
    3: { size: 24, color: C.text, before: 240, after: 100 },
    4: { size: 22, color: C.quoteText, before: 180, after: 80 },
  } as const;
  const cell = (rs: InlineRun[], head = false) => new d.TableCell({
    children: [new d.Paragraph({ spacing: { line: 300 }, children: runs(rs, { bold: head, size: SIZE.table, color: C.text }) })],
    shading: head ? { type: d.ShadingType.CLEAR, color: 'auto', fill: C.headFill } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });

  // 正文第一个标题就是文档标题的，抬头已经写过，不再重复
  let skippedTitle = false;
  const pushBlock = (b: DocBlock) => {
    switch (b.type) {
      case 'heading': {
        const text = b.runs.map((r) => r.text).join('').trim();
        if (!skippedTitle && b.level <= 2 && text === title.trim()) { skippedTitle = true; return; }
        const h = HEADING[b.level];
        children.push(new d.Paragraph({
          keepNext: true,
          spacing: { before: h.before, after: h.after },
          border: b.level === 2 ? { bottom: { ...line(), space: 4 } } : undefined,
          children: runs(b.runs, { bold: true, size: h.size, color: h.color }),
        }));
        break;
      }
      case 'paragraph': children.push(new d.Paragraph({ spacing: { after: 140, line: 360 }, children: runs(b.runs, { color: C.text }) })); break;
      case 'quote':
        children.push(new d.Paragraph({
          indent: { left: 240 },
          spacing: { before: 80, after: 160, line: 340 },
          border: { left: { ...line(C.accent, 18), space: 10 } },
          shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: C.quoteFill },
          children: runs(b.runs, { color: C.quoteText }),
        }));
        break;
      case 'code':
        for (const l of b.text.split('\n')) children.push(new d.Paragraph({ shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: C.headFill }, children: [new d.TextRun({ text: l || ' ', font: 'Consolas', size: SIZE.code, color: C.text })] }));
        children.push(new d.Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case 'hr': children.push(new d.Paragraph({ spacing: { before: 120, after: 240 }, border: { bottom: { ...line(), space: 1 } }, children: [] })); break;
      case 'list':
        b.items.forEach((it, n) => children.push(new d.Paragraph(b.ordered
          ? { indent: { left: 440 + it.level * 360, hanging: 300 }, spacing: { after: 80, line: 340 }, children: [new d.TextRun({ text: `${n + 1}. `, font: FONT, color: C.accent, bold: true }), ...runs(it.runs, { color: C.text })] }
          : { bullet: { level: it.level }, spacing: { after: 80, line: 340 }, children: runs(it.runs, { color: C.text }) })));
        children.push(new d.Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      case 'table': {
        const cols = b.header.length || 1;
        children.push(new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          borders: { top: line(), bottom: line(), left: line(), right: line(), insideHorizontal: line(), insideVertical: line() },
          rows: [
            new d.TableRow({ tableHeader: true, children: b.header.map((c) => cell(c, true)) }),
            ...b.rows.map((r) => new d.TableRow({ children: Array.from({ length: cols }, (_, j) => cell(r[j] ?? [])) })),
          ],
        }));
        children.push(new d.Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
      }
    }
  };
  blocks.forEach(pushBlock);

  const small = (text: string) => new d.TextRun({ text, size: SIZE.small, color: C.muted, font: FONT });
  return new d.Document({
    creator: '开物',
    title,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body, color: C.text }, paragraph: { spacing: { line: 360 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1134, right: 1134, header: 600, footer: 600 } } },
      headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [small('开物 · AI 短视频创作')] })] }) },
      footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [small('第 '), new d.TextRun({ children: [d.PageNumber.CURRENT], size: SIZE.small, color: C.muted, font: FONT }), small(' 页')] })] }) },
      children,
    }],
  });
}

/** 下载 Word。第二个参数可以只给标题（原来的写法），也可以给 { title, board } */
export async function downloadDocx(markdown: string, opts: string | (DocMeta & { title?: string }) = {}): Promise<void> {
  const o = typeof opts === 'string' ? { title: opts } : opts;
  const title = o.title?.trim() || docTitle(markdown);
  const { Packer } = await import('docx');
  saveBlob(await Packer.toBlob(await buildDocx(markdown, title, o)), docFileName(title, o.date));
}

/** 打印成 PDF：在隐藏 iframe 里排好 A4 版，弹出浏览器的打印框，选「另存为 PDF」 */
export function printPdf(markdown: string, title = docTitle(markdown)): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) { frame.remove(); throw new Error('浏览器不支持打印'); }
  win.document.open();
  win.document.write(docToPrintHtml(parseMarkdownDoc(markdown), title));
  win.document.close();
  // 打印对话框里默认的文件名取页面标题
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.onafterprint = done;
  setTimeout(() => { win.focus(); win.print(); setTimeout(done, 60_000); }, 250);
}
