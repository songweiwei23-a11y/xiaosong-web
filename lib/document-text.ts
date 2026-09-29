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

/** 粘贴或上传进来的文字统一整理：去掉多余空行、行尾空白 */
export function normalizeSource(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
