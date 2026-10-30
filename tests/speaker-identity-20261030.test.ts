/**
 * 说话人（2026-10-30）：出镜人本人的台词、口播、旁白，不把他自己叫作「师傅」「主厨」，也不用「他」指自己。
 *
 * 线上现象：锦园地摊的口播写「师傅说这道菜……」「今天就跟着他看一道菜」，而出镜的人就是那位师傅本人。
 * 原因：说话人规则指向了「人设与口吻」里模型自己写的「我是谁」，那一句已经带上了「师傅」这个称呼；
 * 规则里又没有禁止把身份称呼写进台词。
 * 守的是两处：共用的创作规则（脚本、开篇、分镜、标题都用它）有说话人这一条；
 * 开篇的说话人规则以人设事实卡为准，不再指向「我是谁」。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { creativeCraftRules } from '@/lib/creative-craft';

describe('共用创作规则：说话人', () => {
  it('没有任何意图和素材时也有这一条，不依赖某个板块的输入', () => {
    const rules = creativeCraftRules({});
    expect(rules).toContain('**说话人**');
    expect(rules).toContain('以人设事实卡的「出镜人是谁」「和店的关系」为准');
  });

  it('台词和口播只用「我」「我们」「你」，不把自己叫作身份称呼，也不用「他」「她」指自己', () => {
    const rules = creativeCraftRules({ intent: '拍一道菜的过程' });
    expect(rules).toContain('只用「我」「我们」「你」');
    expect(rules).toContain('禁用称呼：「师傅」「主厨」「老板」');
    expect(rules).toContain('不用「他」「她」指他自己');
  });

  it('受访者、顾客等其他人照实称呼，不被这条规则误伤', () => {
    const rules = creativeCraftRules({ intent: '采访两家店主' });
    expect(rules).toContain('受访者、顾客等其他人照实称呼');
  });
});

describe('开篇的说话人规则：以人设事实卡为准', () => {
  it('不再指向「我是谁」，改为以人设事实卡为准', () => {
    const src = readFileSync(join(process.cwd(), 'lib/growth-standards.ts'), 'utf8');
    expect(src).toContain('以人设事实卡的「出镜人是谁」为准');
    expect(src).toContain('两边对不上时以人设事实卡为准');
    expect(src).not.toContain('看上面「人设与口吻」里「我是谁」写的那个人');
  });
});
