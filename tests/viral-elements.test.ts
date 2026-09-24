import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VIRAL_ELEMENTS, SCRIPT_FAMILIES } from '@/lib/viral-elements';
import { FACTS } from '@/lib/showcase';

/**
 * 「八大爆款元素」「四大脚本」是写在落地页上的对外说辞，
 * 而它们的源头是知识库里的 .md，不是代码。
 *
 * 这组用例把两者钉在一起：每一个名字都必须能在原始资料里原样找到。
 * 抄错一个字、或者哪天资料改了名字，这里就红。
 *
 * 【为什么不直接从 .md 解析】那些文档是课程的 AI 总结，格式不统一
 * （有的用「1.头牌选题」，有的是散在正文里）。解析器写出来会很脆，
 * 而且解析失败时倾向于"静默返回空数组"——那才是真正危险的。
 * 手写常量 + 回源比对，是这个项目里已经验证过好几次的做法。
 */

const KB = path.join(process.cwd(), '编导知识大全', '_导入Dify');

const readAll = (dir: string): string => {
  let out = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out += readAll(p);
    else if (e.name.endsWith('.md')) out += '\n' + e.name + '\n' + fs.readFileSync(p, 'utf8');
  }
  return out;
};

describe('八大爆款元素与原始资料一致', () => {
  const src = fs.readFileSync(
    path.join(KB, '库1_定位与选题', '八大爆款元素选题.md'),
    'utf8'
  );

  it('确实读到了那份资料（防止路径写错导致空过）', () => {
    expect(src.length, '八大爆款元素选题.md 读出来是空的').toBeGreaterThan(1000);
    expect(src).toContain('八大爆款元素选题');
  });

  it('八个名字都能在原文里原样找到', () => {
    for (const e of VIRAL_ELEMENTS) {
      expect(src, `原文里找不到「${e.name}」，名字可能抄错了`).toContain(e.name);
    }
  });

  it('确实是八个，且不重名', () => {
    expect(VIRAL_ELEMENTS.length).toBe(8);
    expect(new Set(VIRAL_ELEMENTS.map((e) => e.name)).size).toBe(8);
  });

  it('每条都给得出可套用的句式——这才是它区别于"正确的废话"的地方', () => {
    for (const e of VIRAL_ELEMENTS) {
      expect(e.patterns.length, `${e.name} 没有句式`).toBeGreaterThanOrEqual(2);
      expect(e.hook.length, `${e.name} 没说清在利用什么`).toBeGreaterThan(8);
    }
  });

  it('FACTS.elements 和实际条数一致', () => {
    expect(FACTS.elements).toBe(VIRAL_ELEMENTS.length);
  });
});

describe('四大脚本与课程原文一致', () => {
  const all = readAll(KB);

  it('确实读到了知识库（防止空过）', () => {
    expect(all.length, '知识库读出来是空的').toBeGreaterThan(100000);
  });

  it('四个名字都在课程资料里出现过', () => {
    for (const f of SCRIPT_FAMILIES) {
      expect(all, `知识库里找不到「${f.name}」`).toContain(f.name);
    }
  });

  it('课程里确实有「四大脚本」这个说法，不是我们自己归纳的', () => {
    // 原文：「四大脚本回顾：描观点、晒过程、教知识、讲故事。」
    expect(all, '课程里没有"四大脚本"的提法').toContain('四大脚本');
  });

  it('确实是四类，且每类都说清了对应哪个生意目的', () => {
    expect(SCRIPT_FAMILIES.length).toBe(4);
    expect(FACTS.families).toBe(SCRIPT_FAMILIES.length);
    for (const f of SCRIPT_FAMILIES) {
      expect(f.purpose.length, `${f.name} 没说对应什么生意目的`).toBeGreaterThan(1);
      expect(f.note.length, `${f.name} 没有说明`).toBeGreaterThan(10);
    }
  });

  it('四个目的互不重复——重复就说明这个分类没意义', () => {
    expect(new Set(SCRIPT_FAMILIES.map((f) => f.purpose)).size).toBe(4);
  });
});

describe('方法总数把八大元素算进来了', () => {
  it('100 = 起号 37 + 开篇 36 + 脚本结构 19 + 爆款元素 8', () => {
    expect(FACTS.methods).toBe(
      FACTS.tactics + FACTS.cards + FACTS.structures + FACTS.elements
    );
  });

  it('四大脚本不计入总数——它是给 19 种结构分的类，算进去就是重复计数', () => {
    expect(FACTS.methods).not.toBe(
      FACTS.tactics + FACTS.cards + FACTS.structures + FACTS.elements + FACTS.families
    );
  });
});
