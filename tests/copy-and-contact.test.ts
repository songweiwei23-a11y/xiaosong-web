import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readCode, readSource } from './helpers/source';

const listFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : /\.(tsx?|ts)$/.test(e.name) ? [path.join(dir, e.name)] : []
  );

const SOURCES = [...listFiles('app'), ...listFiles('components'), ...listFiles('lib')];

describe('客服联系方式：全站只定义一处', () => {
  it('扫描：源码里只有 lib/config/contact.ts 写了客服号码', () => {
    expect(SOURCES.length).toBeGreaterThan(150); // 自证不是空转
    const hits = SOURCES.filter((f) => readCode(f).includes('13240286600')).map((f) => f.split(path.sep).join('/'));
    expect(hits).toEqual(['lib/config/contact.ts']);
  });
});

describe('文案：不说没有依据的断言', () => {
  const BANNED = [
    '月薪数千到上万',
    '常编数据',
    '编经历、编来源',
    '注册就有免费体验',
    '立即免费开始',
    '资料里没有的标【待确认】',
  ];
  it('扫描：不再出现这些说法', () => {
    expect(SOURCES.length).toBeGreaterThan(150);
    const bad: string[] = [];
    for (const f of SOURCES) {
      const src = readSource(f);
      for (const phrase of BANNED) if (src.includes(phrase)) bad.push(`${f}: ${phrase}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('安全响应头', () => {
  it('next.config.js 同时带 HSTS 和 CSP，且 CSP 不允许外部脚本、外部 iframe、对象标签', () => {
    const src = readSource('next.config.js');
    expect(src).toMatch(/Strict-Transport-Security/);
    expect(src).toMatch(/Content-Security-Policy/);
    expect(src).toMatch(/object-src 'none'/);
    expect(src).toMatch(/frame-ancestors 'self'/);
    expect(src).not.toMatch(/script-src[^'"]*\*/);
  });
});

describe('隐私政策与实际功能一致', () => {
  it('注销改成了自助，政策里不再说「需要联系客服」', () => {
    const src = readCode('app/privacy/page.tsx');
    expect(src).toMatch(/自助注销/);
    expect(src).not.toMatch(/目前需要联系客服微信/);
  });

  it('政策写明结果反馈会被保存', () => {
    expect(readCode('app/privacy/page.tsx')).toMatch(/有用 \/ 没用/);
  });
});
