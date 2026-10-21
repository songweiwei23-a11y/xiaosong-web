import zlib from 'node:zlib';
import { readZipEntries } from './zip';

/**
 * 创作进度里导入的文件，统一读成文字（给分析用）。
 *   文字类：txt、md、csv、json……（中文编码会自动试 GBK 系）
 *   网页 / XML：去掉标签，留正文
 *   Word、PowerPoint、Excel（xlsx）：读 zip 里的 XML
 *   PDF：基础提取文字层，扫描件和图片版读不出来，会如实说明
 *   图片和其它格式：保存下来，但读不出文字，会说明原因
 * 读不出来不报错：返回 status 和 note，让界面告诉用户怎么处理。
 */

export type MaterialKind = 'text' | 'word' | 'sheet' | 'slides' | 'pdf' | 'image' | 'video' | 'other';

/** 视频本身读不出台词和画面（服务器没有解码器和语音识别），界面会请用户导入配套的脚本或字幕 */
export const VIDEO_NOTE =
  '视频本身读不出台词和画面。要让分析识别它的脚本、结构和开篇，请导入配套的脚本或字幕文件（txt、docx、srt）；也可以导入它的数据截图';
export type MaterialStatus = 'ok' | 'empty' | 'unsupported' | 'failed';

export interface ExtractedMaterial {
  kind: MaterialKind;
  status: MaterialStatus;
  text: string;
  note: string;
}

/** 每个文件最多保留的文字，超出部分截断（分析时还会再截） */
export const MATERIAL_TEXT_LIMIT = 120_000;

/** 字幕文件（srt、vtt、lrc）就是带时间码的台词，按文字读，分析时能看到视频的说话内容 */
const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'yaml', 'yml', 'ini', 'text', 'srt', 'vtt', 'lrc']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv']);
const MARKUP_EXT = new Set(['html', 'htm', 'xml']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic']);

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function decodeText(bytes: Uint8Array): string {
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    // Excel 另存的 CSV 常见 GBK / GB18030
    try {
      return new TextDecoder('gb18030').decode(body);
    } catch {
      return new TextDecoder('latin1').decode(body);
    }
  }
}

function stripMarkup(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

/** 一段 XML（段落级）里的文字：标签去掉，换行和制表符保留 */
function xmlParagraph(xml: string, breakTag: RegExp, tabTag: RegExp): string {
  return decodeEntities(xml.replace(breakTag, '\n').replace(tabTag, '\t').replace(/<[^>]+>/g, ''));
}

function finish(kind: MaterialKind, raw: string, emptyNote = '没有读出文字内容，可能是图片或扫描件'): ExtractedMaterial {
  const text = raw.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MATERIAL_TEXT_LIMIT);
  if (!text) return { kind, status: 'empty', text: '', note: emptyNote };
  return { kind, status: 'ok', text, note: `读出 ${text.length} 字` };
}

function docxText(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes, (n) => n === 'word/document.xml');
  const doc = entries.get('word/document.xml');
  if (!doc) throw new Error('not a docx');
  return doc
    .toString('utf8')
    .split('</w:p>')
    .map((p) => xmlParagraph(p, /<w:br\s*\/>/g, /<w:tab\s*\/>/g))
    .join('\n');
}

function pptxText(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const slides = [...entries.keys()].sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!slides.length) throw new Error('not a pptx');
  return slides
    .map((name, i) => {
      const body = entries
        .get(name)!
        .toString('utf8')
        .split('</a:p>')
        .map((p) => xmlParagraph(p, /<a:br\s*\/>/g, /<a:tab\s*\/>/g))
        .filter((s) => s.trim())
        .join('\n');
      return `【第 ${i + 1} 页】\n${body}`;
    })
    .join('\n\n');
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxText(bytes: Uint8Array): string {
  const entries = readZipEntries(bytes, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheets = [...entries.keys()]
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!sheets.length) throw new Error('not an xlsx');
  const shared = (entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? '')
    .split('</si>')
    .map((si) => xmlParagraph(si, /$^/g, /$^/g));
  return sheets
    .map((name, i) => {
      const xml = entries.get(name)!.toString('utf8');
      const lines: string[] = [];
      for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells: string[] = [];
        for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = cell[1];
          const body = cell[2] ?? '';
          const ref = attrs.match(/\br="([^"]+)"/)?.[1] ?? '';
          const t = attrs.match(/\bt="([^"]+)"/)?.[1];
          const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
          let value = v;
          if (t === 's') value = shared[Number(v)] ?? '';
          else if (t === 'inlineStr') value = xmlParagraph(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '', /$^/g, /$^/g);
          else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
          else value = decodeEntities(v);
          const idx = ref ? colIndex(ref) : cells.length;
          while (cells.length < idx) cells.push('');
          cells[idx] = value;
        }
        const line = cells.map((c) => (c ?? '').trim()).join('\t').replace(/\t+$/, '');
        if (line.trim()) lines.push(line);
      }
      return `【工作表 ${i + 1}】\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/** PDF：只读 FlateDecode 的内容流里的文字操作（Tj / TJ）。字体用了自定义编码的，读不出来 */
function unescapePdf(s: string): string {
  return s.replace(/\\(\d{1,3}|[nrtbf()\\]|[\s\S])/g, (_, c: string) => {
    if (/^\d/.test(c)) return String.fromCharCode(parseInt(c, 8));
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
    return map[c] ?? c;
  });
}

function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const latin = raw.toString('latin1');
  const pieces: string[] = [];
  let at = 0;
  while (pieces.length < 4000) {
    const s = latin.indexOf('stream', at);
    if (s < 0) break;
    const start = latin[s + 6] === '\r' ? s + 8 : s + 7;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    at = end + 9;
    const chunk = raw.subarray(start, end);
    let content: string;
    try {
      content = zlib.inflateSync(chunk).toString('latin1');
    } catch {
      content = chunk.toString('latin1');
    }
    if (!/\b(BT|Tj|TJ)\b/.test(content)) continue;
    for (const m of content.matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)\s*(?:Tj|'|")/g)) pieces.push(unescapePdf(m[1]));
    for (const arr of content.matchAll(/\[((?:\((?:\\[\s\S]|[^\\)])*\)|[^\]])*)\]\s*TJ/g)) {
      for (const m of arr[1].matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)/g)) pieces.push(unescapePdf(m[1]));
    }
    pieces.push('\n');
  }
  // 只留可读字符（ASCII 可见字符、中文和常见标点），去掉乱码
  return pieces.join('').replace(/[^\x09\x0a\x20-\x7e　-〿一-鿿＀-￯]/g, '');
}

export function extractMaterial(name: string, bytes: Uint8Array): ExtractedMaterial {
  const ext = extOf(name);
  try {
    if (TEXT_EXT.has(ext)) return finish('text', decodeText(bytes));
    if (MARKUP_EXT.has(ext)) return finish('text', stripMarkup(decodeText(bytes)));
    if (ext === 'docx') return finish('word', docxText(bytes));
    if (ext === 'pptx') return finish('slides', pptxText(bytes));
    if (ext === 'xlsx' || ext === 'xlsm') return finish('sheet', xlsxText(bytes));
    if (ext === 'pdf') {
      const r = finish('pdf', pdfText(bytes), 'PDF 里读不出文字，多半是扫描件或图片版，请改为文字或表格导入');
      return r.status === 'ok' ? { ...r, note: `${r.note}（PDF 为基础提取，可能漏字，请核对）` } : r;
    }
    if (VIDEO_EXT.has(ext)) {
      return { kind: 'video', status: 'unsupported', text: '', note: VIDEO_NOTE };
    }
    if (IMAGE_EXT.has(ext)) {
      return { kind: 'image', status: 'unsupported', text: '', note: '图片里的文字暂时读不出来，已保存；要用其中的数据，请把文字或表格导入' };
    }
    return { kind: 'other', status: 'unsupported', text: '', note: `暂不支持读取 .${ext || '无后缀'} 文件的内容，已保存` };
  } catch {
    return { kind: ext === 'docx' ? 'word' : ext === 'pptx' ? 'slides' : ext === 'xlsx' ? 'sheet' : ext === 'pdf' ? 'pdf' : 'text', status: 'failed', text: '', note: '这个文件没有读出来，可能已损坏或加密' };
  }
}
