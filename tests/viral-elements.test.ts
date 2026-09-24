import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  VIRAL_ELEMENTS, SCRIPT_FAMILIES, viralElementById, viralElementPrompt,
} from '@/lib/viral-elements';
import { FACTS } from '@/lib/showcase';
import { readCode } from './helpers/source';

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

/**
 * 选题页选了元素，提示词里必须真的带上句式。
 *
 * 【这组用例守的是什么】
 * 改造前，选题页只把元素名发给模型——「爆款元素：成本、人群」。
 * 模型拿到两个词，只能猜，出来的选题和这套方法基本无关。
 * 八个按钮点了等于没点，而且**不报错、看不出来**，
 * 只有真读一遍生成出来的提示词才知道。
 */
describe('选中的元素会把句式带进提示词', () => {
  it('带上了名字、机制和全部句式', () => {
    const out = viralElementPrompt(['worst']);
    const worst = VIRAL_ELEMENTS.find((e) => e.id === 'worst')!;
    expect(out).toContain(worst.name);
    expect(out).toContain(worst.hook);
    for (const p of worst.patterns) {
      expect(out, `句式「${p}」没进提示词`).toContain(p);
    }
  });

  it('明确要求按句式出题、并标注用了哪条——否则模型会自由发挥', () => {
    const out = viralElementPrompt(['worst', 'cost']);
    expect(out).toContain('必须落在上面某一个句式上');
    expect(out).toContain('不要自己另造');
    expect(out).toMatch(/标注用的是哪个元素/);
  });

  it('多选时每个元素各占一段', () => {
    const out = viralElementPrompt(['worst', 'cost', 'curious']);
    for (const id of ['worst', 'cost', 'curious']) {
      expect(out).toContain(VIRAL_ELEMENTS.find((e) => e.id === id)!.name);
    }
    expect(out.match(/可套句式：/g)?.length).toBe(3);
  });

  it('没选就返回空串，不往提示词里塞空段落', () => {
    expect(viralElementPrompt([])).toBe('');
  });

  it('认不出的 id 直接跳过，不会把原始 id 当成元素名塞进去', () => {
    // 宁可少给一条，也不要让提示词里出现「爆款元素：xxx」
    expect(viralElementPrompt(['不存在的id'])).toBe('');
    const out = viralElementPrompt(['不存在的id', 'worst']);
    expect(out).not.toContain('不存在的id');
    expect(out).toContain('最差选题');
  });

  it('每个 id 都取得到，且 id 不重复', () => {
    expect(new Set(VIRAL_ELEMENTS.map((e) => e.id)).size).toBe(VIRAL_ELEMENTS.length);
    for (const e of VIRAL_ELEMENTS) {
      expect(viralElementById(e.id), `${e.id} 取不到`).toBe(e);
    }
  });
});

describe('选题页用的是同一份数据，没有第二份手写清单', () => {
  const code = readCode('app/dashboard/topic/page.tsx');

  it('从 lib/viral-elements 取，不自己写死八个元素', () => {
    expect(code).toContain('@/lib/viral-elements');
    expect(code).toContain('VIRAL_ELEMENTS');
    // 旧写法的特征：一整排带 zhName 的字面量
    expect(code, '又出现了手写的元素清单').not.toMatch(/zhName:\s*["']成本["']/);
  });

  it('提示词由 viralElementPrompt 拼，不再只发名字', () => {
    expect(code).toContain('viralElementPrompt');
    expect(code, '还在只发元素名').not.toMatch(/八大爆款元素：\$\{elementsText\}/);
  });

  it('页面里没有原文没有的元素名', () => {
    /*
     * 旧清单把「猎奇选题」叫成「奇葩」、「对立选题」叫成「反差」。
     * 这两个词在知识库里根本不是元素名，发给模型等于给了个不存在的角度。
     * 注意「反差萌」是风格选项，不是元素，所以要精确匹配。
     */
    expect(code).not.toMatch(/["']奇葩["']/);
    expect(code).not.toMatch(/爆款元素（[^）]*反差/);
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
