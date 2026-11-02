/**
 * 所有产出内容都能下载 Word（2026-11-02 产品方：「每一个板块都增加一个支持下载 word 文档的选项，
 * 排版要干净整洁、简约大气」）。版式在 lib/doc-export，按钮是 components/ui/WordDownloadButton。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildDocx, docFileName } from '@/lib/doc-export';
import { readCode } from './helpers/source';

const SAMPLE = `# 川菜馆选题方案

## 一、选题
1. 老板娘凌晨四点熬底料
2. 一桌客人吃哭了

> 别承诺最低价

| 选题 | 拍法 |
| --- | --- |
| 熬底料 | 跟拍 |`;

async function unzip(markdown: string, title?: string, meta = {}) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(await buildDocx(markdown, title, meta)));
  const read = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  const files = Object.keys(zip.files);
  const header = (await Promise.all(files.filter((f) => /^word\/header\d*\.xml$/.test(f)).map(read))).join('');
  const footer = (await Promise.all(files.filter((f) => /^word\/footer\d*\.xml$/.test(f)).map(read))).join('');
  return { doc: await read('word/document.xml'), header, footer };
}
const texts = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);

describe('Word 版式', () => {
  it('抬头：标题 + 「板块 · 开物生成 · 日期」；正文第一个同名标题不重复', async () => {
    const { doc } = await unzip(SAMPLE, undefined, { board: '选题策划', date: new Date('2026-11-02T04:00:00Z') });
    const t = texts(doc);
    expect(t[0]).toBe('川菜馆选题方案');
    expect(t[1]).toBe('选题策划  ·  开物生成  ·  2026年11月2日');
    expect(t.filter((x) => x === '川菜馆选题方案')).toHaveLength(1);
    expect(t).toContain('一、选题');
    expect(t).toContain('熬底料');
  });

  it('没有板块名也不留空的分隔符', async () => {
    const { doc } = await unzip('随便一段话', '回答');
    expect(texts(doc)[1]).toMatch(/^开物生成  ·  \d{4}年\d{1,2}月\d{1,2}日$/);
  });

  it('A4、页眉「开物」、页脚页码；只用深灰 + 深蓝两种文字颜色', async () => {
    const { doc, header, footer } = await unzip(SAMPLE, undefined, { board: '选题策划' });
    expect(doc).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
    expect(texts(header).join('')).toContain('开物');
    expect(footer).toMatch(/PAGE/);
    expect(texts(footer).join('')).toMatch(/第.*页/);
    const colors = new Set([...doc.matchAll(/<w:color w:val="([0-9A-F]{6})"/g)].map((m) => m[1]));
    for (const c of colors) expect(['1F2328', '1F3A68', '6B7280', '374151']).toContain(c);
  });

  it('文件名：去掉文件名里不能用的字符，接北京时间日期', () => {
    expect(docFileName('选题/方案:第1版?', new Date('2026-11-01T17:00:00Z'))).toBe('选题 方案 第1版-2026-11-02.docx');
    expect(docFileName('   ', new Date('2026-11-02T04:00:00Z'))).toBe('开物文档-2026-11-02.docx');
    expect(docFileName('长'.repeat(80)).length).toBeLessThanOrEqual(40 + '-2026-11-02.docx'.length);
  });
});

describe('每个显示产出内容的地方都有「下载 Word」', () => {
  // 产出内容都是用 Markdown 组件渲染的：凡是渲染 Markdown 的界面文件，都得能下载 Word
  const roots = ['app', 'components'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p.split(path.sep).join('/'));
    }
  };
  roots.forEach(walk);
  const rendersMarkdown = files.filter((f) => /from ['"]@\/components\/markdown['"]/.test(readCode(f)));

  it('扫描没有空转（至少扫到结果面板、拆解报告、历史记录这些）', () => {
    expect(rendersMarkdown.length).toBeGreaterThanOrEqual(12);
    for (const f of ['components/workspace/ResultPanel.tsx', 'components/benchmark/BenchmarkReport.tsx', 'components/history/HistoryPanel.tsx']) {
      expect(rendersMarkdown).toContain(f);
    }
  });

  it.each(rendersMarkdown)('%s', (f) => {
    expect(readCode(f)).toMatch(/<WordDownloadButton\b|downloadDocx\(/);
  });

  it('创作简报（文本框不是 Markdown）也有', () => {
    expect(readCode('app/dashboard/creative-brief/page.tsx')).toContain('<WordDownloadButton');
  });

  it('结果面板：Word 放在 TXT 旁边，原来的下载改叫「下载 TXT」', () => {
    const code = readCode('components/workspace/ResultPanel.tsx');
    expect(code).toContain('<WordDownloadButton');
    expect(code).toContain('下载 TXT');
  });
});
