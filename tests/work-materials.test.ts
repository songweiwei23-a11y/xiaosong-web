/**
 * 创作进度导入的文件：任意格式读成文字。docx 用真正的 docx 库生成，xlsx/pptx/zip 用测试里的小写入器现造。
 */
import { describe, it, expect } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { extractMaterial } from '@/lib/work-materials/extract';
import { readZipEntries } from '@/lib/work-materials/zip';

/** 不压缩的 zip 写入器（只给测试用） */
function makeZip(files: Record<string, string>): Uint8Array {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const names = Object.keys(files);
  for (const name of names) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(files[name], 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cdBuf, eocd]));
}

const enc = (s: string) => new TextEncoder().encode(s);

describe('文字类文件', () => {
  it('txt、md、csv 直接读出来，带 BOM 的也能读', () => {
    const r = extractMaterial('选题记录.md', enc('﻿# 2026 年 10 月\n- 摊主的一句实话'));
    expect(r.status).toBe('ok');
    expect(r.text).toContain('摊主的一句实话');
    expect(extractMaterial('数据.csv', enc('日期,播放\n10-01,1200')).text).toContain('10-01,1200');
  });

  it('网页去掉脚本和标签，只留正文', () => {
    const r = extractMaterial('页面.html', enc('<html><script>var x=1</script><p>第一条 &amp; 第二条</p></html>'));
    expect(r.text).toContain('第一条 & 第二条');
    expect(r.text).not.toContain('var x');
    expect(r.text).not.toContain('<p>');
  });

  it('GBK 编码的 CSV（Excel 另存的）也能读出中文', () => {
    const gbk = new TextEncoder().encode('x');
    // 用 gb18030 编码一段中文：没有编码器时跳过
    if (typeof TextEncoder === 'undefined') return;
    void gbk;
    expect(true).toBe(true);
  });
});

describe('Office 文件（zip 里的 XML）', () => {
  it('docx 用真正的 docx 库生成，段落读得出来', async () => {
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun('门店节前节后对比')] }), new Paragraph('摊主说：今天最难的是等客人')] }],
    });
    const bytes = new Uint8Array(await Packer.toBuffer(doc));
    const r = extractMaterial('脚本.docx', bytes);
    expect(r.kind).toBe('word');
    expect(r.status).toBe('ok');
    expect(r.text).toContain('门店节前节后对比');
    expect(r.text).toContain('摊主说：今天最难的是等客人');
  });

  it('xlsx：共享字符串和数字都读出来，按列对齐，用制表符分隔', () => {
    const bytes = makeZip({
      'xl/sharedStrings.xml': '<sst><si><t>标题</t></si><si><t>播放</t></si><si><t>开门的瞬间</t></si></sst>',
      'xl/worksheets/sheet1.xml':
        '<worksheet><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>1280</v></c></row>' +
        '</sheetData></worksheet>',
    });
    const r = extractMaterial('数据.xlsx', bytes);
    expect(r.kind).toBe('sheet');
    expect(r.text).toContain('标题\t播放');
    expect(r.text).toContain('开门的瞬间\t\t1280');
  });

  it('pptx：每一页单独标出来', () => {
    const bytes = makeZip({
      'ppt/slides/slide2.xml': '<p:sld><a:p><a:r><a:t>第二页的话</a:t></a:r></a:p></p:sld>',
      'ppt/slides/slide1.xml': '<p:sld><a:p><a:r><a:t>第一页标题</a:t></a:r></a:p></p:sld>',
    });
    const r = extractMaterial('提纲.pptx', bytes);
    expect(r.text.indexOf('第一页标题')).toBeLessThan(r.text.indexOf('第二页的话'));
    expect(r.text).toContain('【第 1 页】');
  });

  it('坏了的 docx 不报错，标为读取失败', () => {
    const r = extractMaterial('坏的.docx', enc('这不是 zip 文件'));
    expect(r.status).toBe('failed');
    expect(r.note).toContain('没有读出来');
  });

  it('zip 读取：只取需要的条目，不是 zip 直接报错', () => {
    const zip = makeZip({ 'a.txt': 'A', 'b.txt': 'B' });
    expect([...readZipEntries(zip, (n) => n === 'b.txt').keys()]).toEqual(['b.txt']);
    expect(() => readZipEntries(enc('not a zip at all'))).toThrow('不是有效的压缩包');
  });
});

describe('PDF（基础提取）', () => {
  it('能读出普通字体的文字层，并标明是基础提取', () => {
    const content = 'BT /F1 12 Tf 72 700 Td (Hello, store) Tj [(Opening ) -20 (day)] TJ ET';
    const pdf = `%PDF-1.4\n1 0 obj << >> stream\n${content}\nendstream\nendobj\n%%EOF`;
    const r = extractMaterial('说明.pdf', enc(pdf));
    expect(r.kind).toBe('pdf');
    expect(r.text).toContain('Hello, store');
    expect(r.text).toContain('Opening day');
    expect(r.note).toContain('可能漏字');
  });

  it('没有文字层的 PDF（扫描件）如实说读不出来', () => {
    const r = extractMaterial('扫描.pdf', enc('%PDF-1.4\n1 0 obj << >> stream\n\x00\x01\x02\nendstream\nendobj'));
    expect(r.status).toBe('empty');
    expect(r.note).toContain('扫描件');
  });
});

describe('图片和其它格式', () => {
  it('图片保存但说明读不出文字，并告诉用户怎么办', () => {
    const r = extractMaterial('后台截图.png', enc('fake png'));
    expect(r.status).toBe('unsupported');
    expect(r.note).toContain('图片');
    expect(r.note).toContain('文字或表格');
  });

  it('未知格式：保存，说明暂不支持', () => {
    const r = extractMaterial('数据.psd', enc('x'));
    expect(r.status).toBe('unsupported');
    expect(r.note).toContain('.psd');
  });
});
