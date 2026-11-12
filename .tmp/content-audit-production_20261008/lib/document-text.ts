/**
 * 上传的前采文档 → 纯文字。只在服务端用（要用 node:zlib）。
 *
 * 支持 .docx / .txt / .md。不加依赖：.docx 就是一个 zip，里面的 word/document.xml 是正文，
 * 用 Node 自带的 zlib 解开就够了——为了读一个 XML 装一个几百 KB 的库，
 * 还要在服务器上多一次依赖安装，不划算。
 *
 * PDF、老版 .doc、图片不支持：给一句能照着做的话，而不是一个看不懂的报错。
 */
import { inflateRawSync } from 'node:zlib';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UnsupportedDocument extends Error {}

export function documentToText(name: string, buf: Buffer): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'docx') return docxToText(buf);
  if (ext === 'txt' || ext === 'md') return decodeText(buf);
  if (ext === 'doc') throw new UnsupportedDocument('这是老版 Word（.doc）：用 Word 打开后「另存为 .docx」再传，或者直接复制文字粘贴进来');
  if (ext === 'pdf') throw new UnsupportedDocument('PDF 暂时读不了：打开 PDF 全选复制，把文字粘贴进来就行');
  if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) throw new UnsupportedDocument('图片暂时读不了：请把文字粘贴进来');
  throw new UnsupportedDocument('只支持 Word（.docx）和文本文件（.txt）；别的格式请复制文字粘贴进来');
}

/**
 * 文本文件的编码：Windows 记事本存的中文常常是 GBK，按 UTF-8 读就是一片乱码。
 * 先按 UTF-8 严格解，解不开再按 GB18030（GBK 的超集）。
 */
export function decodeText(buf: Buffer): string {
  let s: string;
  try {
    s = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    s = new TextDecoder('gb18030').decode(buf);
  }
  return s.replace(/^﻿/, '');
}

/** 从 zip 里取一个文件。只处理 .docx 用得到的两种压缩方式：不压缩、deflate */
export function readZipEntry(buf: Buffer, wanted: string): Buffer | null {
  // 目录尾（End of Central Directory）在最后 22～65557 字节里，从后往前找签名
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      if (buf.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export function docxToText(buf: Buffer): string {
  const xml = readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new UnsupportedDocument('这个 Word 文件打不开，可能已损坏：请直接复制文字粘贴进来');
  return wordXmlToText(xml.toString('utf8'));
}

/**
 * word/document.xml → 文字：段落换行、表格单元格用 | 隔开。
 *
 * 只取 <w:t> 里的字。不能"去掉所有标签剩下的就是正文"：标签之间的换行缩进
 * 也会被当成正文，每段之间多出空行；修订里删掉的字（w:delText）、
 * 域代码（w:instrText）也会混进来。
 */
export function wordXmlToText(xml: string): string {
  const TOKEN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>|<\/w:tc>|<\/w:tr>/g;
  let out = '';
  for (const m of xml.matchAll(TOKEN)) {
    const tag = m[0];
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (tag.startsWith('<w:tab')) out += '\t';
    else if (tag === '</w:p>') out += '\n';
    else if (tag === '</w:tc>') out += ' | ';
    else out += '\n';
  }
  return out
    .replace(/\n \| /g, ' | ')
    .replace(/ \| (\n|$)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---------------------------------------------------------------------------
// 自由对话附件 → 文字（2026-10-04）
//
// 线上：用户传了视频号 CSV、抖音 / 快手 Excel 让出方案，模型连着几次说「文档正文是空的」。
// 工作流里的「读取文档正文」节点单测时能读，但线上那几轮模型就是没用上。不再只靠它：
// 服务端自己把能读的格式读出来，直接放进这一轮的提问里（app/api/dify/chat），模型一定看得到。
// PDF、图片仍交给工作流（文档读取 / 视觉），这里返回 null。
// ---------------------------------------------------------------------------

const READABLE = new Set(['csv', 'tsv', 'txt', 'md', 'json', 'xml', 'html', 'docx', 'xlsx', 'pptx']);
/** 这种格式服务端能不能自己读（不能读的不用下载） */
export const attachmentReadable = (name: string) => READABLE.has(name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

/** 能自己读的返回文字；PDF、图片等返回 null（交给工作流）；文件坏了抛 UnsupportedDocument */
export function attachmentToText(name: string, buf: Buffer): string | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'csv') return csvToTable(decodeText(buf), ',');
  if (ext === 'tsv') return csvToTable(decodeText(buf), '\t');
  if (['txt', 'md', 'json', 'xml', 'html'].includes(ext)) return decodeText(buf);
  if (ext === 'docx') return docxToText(buf);
  if (ext === 'xlsx') return xlsxToText(buf);
  if (ext === 'pptx') return pptxToText(buf);
  return null;
}

/** CSV 一行拆格子：认双引号包住的格子（里面可以有逗号、换行已在外面处理） */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
    else if (ch === sep && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const mdCell = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
function toMarkdownTable(rows: string[][]): string {
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!rows.length || !width) return '';
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => mdCell(r[i] ?? ''));
  const [head, ...body] = rows;
  return [`| ${pad(head).join(' | ')} |`, `| ${Array(width).fill('---').join(' | ')} |`, ...body.map((r) => `| ${pad(r).join(' | ')} |`)].join('\n');
}

export function csvToTable(text: string, sep = ','): string {
  const rows = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim()).map((l) => splitCsvLine(l, sep));
  return toMarkdownTable(rows);
}

/** 列名 → 下标：A→0、Z→25、AA→26 */
const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Excel 的日期是数字（从 1899-12-30 起的天数），带日期格式的格子转回日期 */
function excelDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400_000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return String(serial);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  const hasTime = serial % 1 !== 0;
  return hasTime ? `${date} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
}

export function xlsxToText(buf: Buffer): string {
  const wb = readZipEntry(buf, 'xl/workbook.xml')?.toString('utf8');
  if (!wb) throw new UnsupportedDocument('这个 Excel 文件打不开，可能已损坏：请另存为 .xlsx 或导出 CSV 再传');
  // 共享字符串
  const sst = readZipEntry(buf, 'xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const shared = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => decodeEntities(t[1])).join(''));
  // 哪些样式是日期格式（内置 14–22、45–47，或自定义格式里有 y/m/d 且不是纯数字格式）
  const styles = readZipEntry(buf, 'xl/styles.xml')?.toString('utf8') ?? '';
  const customDate = new Set([...styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)].filter((m) => /[yd]|m{1,2}[^a-z]*d/i.test(m[2].replace(/"[^"]*"|\[[^\]]*\]/g, ''))).map((m) => Number(m[1])));
  const xfs = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '').match(/<xf\b[^>]*>/g) ?? [];
  const dateStyle = xfs.map((xf) => { const id = Number(xf.match(/numFmtId="(\d+)"/)?.[1] ?? 0); return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || customDate.has(id); });
  // 工作表：按工作簿里的顺序，用 rels 找到文件
  const rels = readZipEntry(buf, 'xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2].replace(/^\/?xl\//, '').replace(/^\//, '')]));
  const sheets = [...wb.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ name: decodeEntities(m[1]), path: `xl/${target.get(m[2]) ?? ''}` }));
  const parts: string[] = [];
  for (const s of sheets.slice(0, 10)) {
    const xml = readZipEntry(buf, s.path)?.toString('utf8');
    if (!xml) continue;
    const rows: string[][] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? '';
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] ?? '';
        const t = attrs.match(/\bt="([^"]+)"/)?.[1];
        const styleIdx = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let text = '';
        if (t === 's' && v !== undefined) text = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') text = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => decodeEntities(x[1])).join('');
        else if (v !== undefined) text = !t && dateStyle[styleIdx] && /^\d+(\.\d+)?$/.test(v) ? excelDate(Number(v)) : decodeEntities(v);
        const at = ref ? colIndex(ref) : cells.length;
        cells[at] = text;
      }
      if (cells.some((x) => x && x.trim())) rows.push(Array.from(cells, (x) => x ?? ''));
    }
    if (rows.length) parts.push(`${sheets.length > 1 ? `#### 工作表：${s.name}\n` : ''}${toMarkdownTable(rows)}`);
  }
  return parts.join('\n\n');
}

export function pptxToText(buf: Buffer): string {
  const parts: string[] = [];
  for (let n = 1; n <= 200; n++) {
    const xml = readZipEntry(buf, `ppt/slides/slide${n}.xml`)?.toString('utf8');
    if (!xml) break;
    const paras = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)].map((p) => [...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeEntities(t[1])).join('')).filter((s) => s.trim());
    if (paras.length) parts.push(`#### 第 ${n} 页\n${paras.join('\n')}`);
  }
  return parts.join('\n\n');
}

/** 粘贴或上传进来的文字统一整理：去掉多余空行、行尾空白 */
export function normalizeSource(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
