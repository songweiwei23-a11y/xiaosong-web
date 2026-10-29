import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// 「策划不够一针见血」这一轮的规则：内容规划、账号定位、前采问题。
// 这些都是提示词文字，直接读源码锁住关键句子，防止以后改回去。
const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('内容规划：先多后选、分散人货场、方向写到看得见', () => {
  const src = read('lib/content-plan.ts');
  it('先多后选：候选不输出，挑最好的 15～20 个', () => {
    expect(src).toMatch(/\*\*先多后选，挑最好的\*\*：心里先拟比要求多一半的候选方向（候选不输出）/);
  });
  // 2026-10-29：「出镜的人和场至少换三种」让模型机械轮换拍摄地点（镜前、试衣区、门口、走道）；改成出发点要拉开（瘦身后写法收短）
  it('方向之间要真的不一样，不能只换拍摄地点或一件货', () => {
    expect(src).toContain('方向之间要真的不一样：不能只换拍摄地点、只换一件货');
    expect(src).not.toMatch(/\*\*分散人、货、场\*\*/);
  });
  it('内容规划不写取材范围和角度，只写职能（角度和取材留给方向层，2026-10-26）', () => {
    expect(src).not.toMatch(/内容方向要写到拍的时候看得见什么/);
    expect(src).toMatch(/\*\*职能\*\*：拉新、立人设、转化、留存里选一个/);
  });
});

describe('其他策划板块：选题、起号、开篇、标题、创作简报都接上共用规则', () => {
  const cases: Array<[string, RegExp[]]> = [
    ['lib/boards/topic-query.ts', [/TITLE_CRAFT/, /ONE_POINT_RULE/, /REAL_PEOPLE_RULE/]],
    ['lib/growth-standards.ts', [/REAL_PEOPLE_RULE/, /ONE_POINT_RULE/, /OPENING_CRAFT/]],
    ['lib/title-standards.ts', [/TITLE_CRAFT/]],
    ['lib/creative-brief.ts', [/REAL_PEOPLE_RULE/]],
  ];
  for (const [file, patterns] of cases) {
    it(`${file} 引入并使用共用规则`, () => {
      const s = read(file);
      expect(s).toMatch(/from ['"][./@a-z-]*sharp-rules['"]/);
      for (const re of patterns) expect(s).toMatch(re);
    });
  }
  it('共用规则文件：标题禁用万能模板，并给平/好对照', () => {
    const s = read('lib/sharp-rules.ts');
    expect(s).toMatch(/不用「XX，怎么…」「别只…」/);
    expect(s).toMatch(/写法对照（只学写法，不照抄）/);
    expect(s).toMatch(/标题不超过 20 个字，只有一个主句/);
  });
});

describe('账号定位：一句话要有立场，前采问具体事件', () => {
  const src = read('lib/positioning-standards.ts');
  it('一句话定位要有立场：替观众做的具体事、凭什么是他、别人为什么做不了', () => {
    expect(src).toMatch(/要有\*\*立场\*\*：这个号替观众做的哪一件具体的事/);
    expect(src).toMatch(/只写身份和价值的，是平的/);
  });
  it('人和事只写真的：不替老板编性格、经历、顾客原话，缺的写待确认', () => {
    expect(src).toMatch(/\*\*人和事只写真的\*\*/);
    expect(src).toMatch(/不替老板编性格、经历、顾客原话/);
  });
  it('前采问具体事件，不问形容词', () => {
    expect(src).toMatch(/\*\*问具体事件，不问形容词\*\*/);
    expect(src).toMatch(/最近一次有顾客不满意，老板是怎么处理的/);
    expect(src).not.toMatch(/老板从业多少年、为什么做这行、最自豪的是什么/);
  });
});
