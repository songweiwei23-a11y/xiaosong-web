/**
 * 回答 / 方案下载成 Word、PDF（2026-10-04）。浏览器里生成，不上传、不扣次数。
 *
 * - Word：真正的 .docx（开源库 docx，点下载时才加载），标题层级、列表、表格、加粗都保留，打开能接着改
 * - PDF：浏览器自带的「打印 → 另存为 PDF」，A4 排版；用隐藏的 iframe 打印，不弹新窗口（不会被拦）
 * Markdown 怎么拆见 lib/doc-markdown。
 */
import { docTitle, docToPrintHtml, parseMarkdownDoc, type DocBlock, type InlineRun } from './doc-markdown';

const FONT = 'Microsoft YaHei';

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

/** 生成 Word 文档对象（下载和测试共用） */
export async function buildDocx(markdown: string, title = docTitle(markdown)) {
  const d = await import('docx');
  const blocks = parseMarkdownDoc(markdown);
  const runs = (rs: InlineRun[], extra: { bold?: boolean; size?: number } = {}) =>
    rs.map((r) => new d.TextRun({ text: r.text, bold: r.bold || extra.bold, italics: r.italic, font: r.code ? 'Consolas' : FONT, size: extra.size }));
  const HEADING = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4];
  const children: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
  const border = { style: d.BorderStyle.SINGLE, size: 4, color: '9AA1A9' };
  const cell = (rs: InlineRun[], head = false) => new d.TableCell({
    children: [new d.Paragraph({ children: runs(rs, { bold: head, size: 20 }) })],
    shading: head ? { type: d.ShadingType.CLEAR, color: 'auto', fill: 'EEF1F4' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
  const pushBlock = (b: DocBlock) => {
    switch (b.type) {
      case 'heading': children.push(new d.Paragraph({ heading: HEADING[b.level - 1], spacing: { before: 240, after: 120 }, children: runs(b.runs) })); break;
      case 'paragraph': children.push(new d.Paragraph({ spacing: { after: 120, line: 360 }, children: runs(b.runs) })); break;
      case 'quote': children.push(new d.Paragraph({ indent: { left: 360 }, spacing: { after: 120 }, children: runs(b.runs).map((r) => r) })); break;
      case 'code': for (const line of b.text.split('\n')) children.push(new d.Paragraph({ children: [new d.TextRun({ text: line, font: 'Consolas', size: 19 })] })); break;
      case 'hr': children.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } }, children: [] })); break;
      case 'list':
        b.items.forEach((it, n) => children.push(new d.Paragraph(b.ordered
          ? { indent: { left: 420 + it.level * 360, hanging: 300 }, spacing: { after: 60, line: 340 }, children: [new d.TextRun({ text: `${n + 1}. `, font: FONT }), ...runs(it.runs)] }
          : { bullet: { level: it.level }, spacing: { after: 60, line: 340 }, children: runs(it.runs) })));
        break;
      case 'table': {
        const cols = b.header.length || 1;
        children.push(new d.Table({
          width: { size: 100, type: d.WidthType.PERCENTAGE },
          borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
          rows: [
            new d.TableRow({ tableHeader: true, children: b.header.map((c) => cell(c, true)) }),
            ...b.rows.map((r) => new d.TableRow({ children: Array.from({ length: cols }, (_, j) => cell(r[j] ?? [])) })),
          ],
        }));
        children.push(new d.Paragraph({ children: [] }));
        break;
      }
    }
  };
  blocks.forEach(pushBlock);
  const doc = new d.Document({
    creator: '开物',
    title,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  });
  return doc;
}

export async function downloadDocx(markdown: string, title = docTitle(markdown)): Promise<void> {
  const { Packer } = await import('docx');
  saveBlob(await Packer.toBlob(await buildDocx(markdown, title)), `${title}.docx`);
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
