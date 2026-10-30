/**
 * 身份称呼护栏（2026-10-30）：提示词里不出现「师傅」这类身份称呼的例子。
 *
 * 线上现象：锦园档案的出镜人就是那位师傅，脚本口播却写「师傅说这道菜」「今天就跟着他看」。
 * 原因之一：提示词里的举例和反例带着「师傅」「老修车师傅」「这个师傅」，模型会照着说。
 * 这类问题不止锦园：只要提示词里有某个称呼的例子，任何档案、任何行业都可能被带偏。
 * 所以扫整个 lib：提示词（非注释）里不许出现「师傅」。检测用的正则例外（见 ALLOWED）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BRIEF_FIELDS } from '@/lib/creative-brief';

const ROOT = process.cwd();

/** 不是提示词、只是拿来识别「师傅」的代码（例如第三人称检测的正则） */
const ALLOWED = new Set([
  'lib/quality-checks.ts', // 第三人称检测的正则
  'lib/speaker-check.ts', // 说话人检查：门槛正则，以及检查提示词里「要标出的例子」（检测用，不是生成的提示词）
]);

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (name.endsWith('.ts')) out.push(path);
  }
  return out;
}

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*');
}

describe('提示词里不出现「师傅」这类身份称呼', () => {
  it('lib 里的非注释代码没有「师傅」（检测正则除外）', () => {
    const offenders: string[] = [];
    for (const file of tsFiles(join(ROOT, 'lib'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (ALLOWED.has(rel)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // 禁用称呼的禁令要写明这几个字，它不是举例，允许
        if (!isComment(line) && line.includes('师傅') && !line.includes('禁用称呼')) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('简报的「我是谁」以人设事实卡为准，不另起称呼', () => {
    const persona = BRIEF_FIELDS.find((f) => f.key === 'persona');
    expect(persona?.spec).toContain('「出镜人是谁」「和店的关系」里写的原词');
    expect(persona?.spec).toContain('卡里没写就不起称呼、不编身份');
    expect(persona?.spec).toContain('不把别的行业或别的人的称呼套过来');
  });
});
