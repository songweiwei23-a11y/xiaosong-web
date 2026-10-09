/**
 * 自由对话附件正文由服务端读出、直接放进提问（2026-10-04）。
 * 线上：视频号 CSV（GBK 编码）+ 抖音 / 快手 Excel 让出方案，模型连着几次说「文档正文是空的」。
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { attachmentToText, csvToTable, xlsxToText, pptxToText } from '@/lib/document-text';
import { attachmentTextBlock, ATTACHMENT_TEXT_PER_FILE } from '@/lib/chat-attachments-server';
import { readCode } from './helpers/source';

const gbk = (s: string) => {
  // Node 没有 GBK 编码器：测试里用几个常用字的 GBK 字节拼（视=CAD3 频=C6B5 播=B2A5 放=B7C5 量=C1BF）
  const map: Record<string, number[]> = { 视: [0xca, 0xd3], 频: [0xc6, 0xb5], 播: [0xb2, 0xa5], 放: [0xb7, 0xc5], 量: [0xc1, 0xbf] };
  return Buffer.from([...s].flatMap((ch) => map[ch] ?? [...Buffer.from(ch)]));
};

async function xlsx(rows: string, opts: { shared?: string[]; styles?: string } = {}) {
  const z = new JSZip();
  z.file('xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="作品" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>');
  if (opts.shared) z.file('xl/sharedStrings.xml', `<sst>${opts.shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`);
  if (opts.styles) z.file('xl/styles.xml', opts.styles);
  z.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData>${rows}</sheetData></worksheet>`);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('读附件正文', () => {
  it('CSV：GBK 编码（视频号导出）也能读，转成表格；引号里的逗号不拆', () => {
    const csv = gbk('视频,播放量\n"视频,视频",1436\n');
    expect(attachmentToText('视频号.csv', csv)).toBe('| 视频 | 播放量 |\n| --- | --- |\n| 视频,视频 | 1436 |');
    expect(csvToTable('a,"b,c"\n1,2')).toBe('| a | b,c |\n| --- | --- |\n| 1 | 2 |');
  });

  it('Excel：共享字符串、行内字符串、数字、带日期格式的数字转回日期；空格子补齐', async () => {
    const styles = '<styleSheet><numFmts><numFmt numFmtId="176" formatCode="yyyy-mm-dd hh:mm"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="176"/><xf numFmtId="10"/></cellXfs></styleSheet>';
    const buf = await xlsx('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>样品处理</t></is></c><c r="B2" s="1"><v>46298.5</v></c><c r="C2" s="2"><v>0.1020</v></c></row>', { shared: ['作品', '完播率'], styles });
    expect(xlsxToText(buf)).toBe('| 作品 |  | 完播率 |\n| --- | --- | --- |\n| 样品处理 | 2026-10-03 12:00 | 0.1020 |');
  });

  it('PPT：逐页取文字', async () => {
    const z = new JSZip();
    z.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>公司介绍</a:t></a:r></a:p><a:p><a:r><a:t>成立 </a:t></a:r><a:r><a:t>2015 年</a:t></a:r></a:p></p:sld>');
    z.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>主营全屋定制</a:t></a:r></a:p></p:sld>');
    expect(pptxToText(await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))).toBe('#### 第 1 页\n公司介绍\n成立 2015 年\n\n#### 第 2 页\n主营全屋定制');
  });

  it('PDF、图片不自己读（交给工作流）', () => {
    expect(attachmentToText('a.pdf', Buffer.from('%PDF'))).toBeNull();
    expect(attachmentToText('a.png', Buffer.from([1]))).toBeNull();
  });
});

describe('拼进提问的附件正文', () => {
  const f = (name: string, type: 'document' | 'image' = 'document') => ({ id: name, name, size: 1, type, storagePath: `u/x/${name}`, token: '' });

  it('文档逐份放进来并说明「直接使用、不要说读不到」；图片、PDF 不放；某份读坏了写明，不影响别的', async () => {
    const files = [f('a.csv'), f('b.png', 'image'), f('c.pdf'), f('d.xlsx')];
    const block = await attachmentTextBlock(files, async (x) => (x.name === 'd.xlsx' ? Buffer.from('坏的') : Buffer.from('标题,播放\n甲,1')), (n, b) => (n.endsWith('.xlsx') ? (() => { throw new Error('这个 Excel 文件打不开'); })() : attachmentToText(n, b)));
    expect(block).toContain('【附件正文（开物服务器已读取');
    expect(block).toMatch(/直接使用，不要说读不到/);
    expect(block).toContain('### 附件1：a.csv\n| 标题 | 播放 |');
    expect(block).not.toContain('b.png');
    expect(block).not.toContain('c.pdf');
    expect(block).toContain('### 附件4：d.xlsx\n（这份没读出内容：这个 Excel 文件打不开）');
  });

  it('太长截断并说明还剩多少，不悄悄丢', async () => {
    const block = await attachmentTextBlock([f('a.txt')], async () => Buffer.from('字'.repeat(ATTACHMENT_TEXT_PER_FILE + 500)), attachmentToText);
    expect(block).toMatch(/这份还有约 500 字没放进来/);
  });

  it('没有文档附件就什么都不加', async () => {
    expect(await attachmentTextBlock([f('b.png', 'image')], async () => Buffer.from(''), attachmentToText)).toBe('');
  });

  it('接口：自由对话带附件时把正文拼进提问', () => {
    const route = readCode('app/api/dify/chat/route.ts');
    expect(route).toMatch(/fullQuery \+= await attachmentTextBlock\(files,/);
    expect(route).toMatch(/storage\.download\(file\.storagePath\)/);
    // 尽力而为：读不出来不影响这一轮
    expect(route).toMatch(/console\.warn\('\[dify\/chat\] 附件正文没读出来，只靠工作流读取:'/);
  });
});
