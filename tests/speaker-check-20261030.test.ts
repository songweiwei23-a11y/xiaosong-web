/**
 * 出镜人本人台词的说话人检查（2026-10-30，lib/speaker-check）。
 *
 * 守的是：口播里「师傅说这道菜……」这类用身份称呼指自己的句子，生成后能被标出来，
 * 修正只改这几句；改动超标就不采用；别人（顾客、受访者）怎么称呼不误伤。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SPEAKER_CHECK_TASKS,
  needsSpeakerCheck,
  buildSpeakerCheckPrompt,
  parseSpeakerCheck,
  buildSpeakerFixPrompt,
} from '@/lib/speaker-check';
import { fixTooBig } from '@/lib/fact-fix';

const SCRIPT = [
  '第一次吃川菜的人，可能觉得难的是翻炒，但师傅说这道菜最不能省的，不一定在锅里。',
  '锅一热，油烟一起来，大家的眼睛都盯着锅铲。',
  '今天就跟着看这道菜，从准备到出锅。',
].join('\n');

describe('门槛：稿子里没有身份称呼就不用查', () => {
  it('有「师傅」「老板」这类称呼才需要查', () => {
    expect(needsSpeakerCheck(SCRIPT)).toBe(true);
    expect(needsSpeakerCheck('今天就跟着看这道菜，我先说一句。')).toBe(false);
  });

  it('只查有口播台词的板块', () => {
    expect(SPEAKER_CHECK_TASKS.has('脚本生成')).toBe(true);
    expect(SPEAKER_CHECK_TASKS.has('开篇钩子')).toBe(true);
    expect(SPEAKER_CHECK_TASKS.has('分镜脚本')).toBe(true);
    expect(SPEAKER_CHECK_TASKS.has('选题策划')).toBe(false);
  });
});

describe('检查提示词', () => {
  it('稿子和已知素材都放进去，要求只标出口播里指自己的称呼', () => {
    const prompt = buildSpeakerCheckPrompt(SCRIPT, '人设事实卡：出镜人是成都来的川菜师傅');
    expect(prompt).toContain(`【稿子】\n${SCRIPT}`);
    expect(prompt).toContain('【已知素材】\n人设事实卡：出镜人是成都来的川菜师傅');
    expect(prompt).toContain('{"self":');
    // 别人的称呼、画面里的第三人称不标
    expect(prompt).toContain('顾客、受访者、路人怎么称呼，不算');
    expect(prompt).toContain('画面、拍摄要点里的第三人称');
  });

  it('已知素材超长时截断', () => {
    const prompt = buildSpeakerCheckPrompt(SCRIPT, '素材'.repeat(20_000));
    expect(prompt.length).toBeLessThan(30_000);
  });
});

describe('解析检查结果', () => {
  it('标出的原句转成「按资料修正」认得的格式，「」去掉', () => {
    expect(parseSpeakerCheck('{"self":["师傅说这道菜最不能省的"]}')).toEqual([
      '「师傅说这道菜最不能省的」：出镜人本人的台词不用这个称呼指自己，改成「我」「我们」，保留主语',
    ]);
  });

  it('没有问题、读不出、格式不对，都返回空，不误报', () => {
    expect(parseSpeakerCheck('{"self":[]}')).toEqual([]);
    expect(parseSpeakerCheck('没有结构的文字')).toEqual([]);
    expect(parseSpeakerCheck('{"self":"不是数组"}')).toEqual([]);
    expect(parseSpeakerCheck('{"other":["师傅说"]}')).toEqual([]);
  });

  it('带代码块也能取出；重复只留一条；单字不要；最多 8 条', () => {
    expect(parseSpeakerCheck('```json\n{"self":["师傅说"]}\n```')).toHaveLength(1);
    expect(parseSpeakerCheck('{"self":["师傅说","师傅说","师"]}')).toHaveLength(1);
    expect(parseSpeakerCheck(JSON.stringify({ self: Array.from({ length: 12 }, (_, i) => `师傅说第${i}句`) }))).toHaveLength(8);
  });
});

describe('修正只改标出的几句，超标不采用（和事实修正同一套判断）', () => {
  const issues = parseSpeakerCheck('{"self":["师傅说这道菜最不能省的"]}');

  it('只改这一句，其余原样保留：采用', () => {
    const fixed = SCRIPT.replace('但师傅说这道菜最不能省的', '但我说这道菜最不能省的');
    expect(fixTooBig(SCRIPT, fixed, issues)).toBe(false);
  });

  it('整段都改了：不采用', () => {
    expect(fixTooBig(SCRIPT, '完全不同的一段话，没有原来的任何句子。', issues)).toBe(true);
  });

  it('修正提示词只要求改这几处，并且不动画面里的第三人称', () => {
    const prompt = buildSpeakerFixPrompt({ text: SCRIPT, issues });
    expect(prompt).toContain('只改这几处');
    expect(prompt).toContain('1. 「师傅说这道菜最不能省的」');
    expect(prompt).toContain('不改画面、拍摄要点里的第三人称');
    // 不能鼓励删掉主语（2026-10-30 实测：「直接说事」让首句变成「但这道……不能省的那一步」）
    expect(prompt).not.toContain('直接说事');
    expect(prompt).toContain('保留主语');
  });
});

describe('接进生成路由', () => {
  it('路由在编造细节检查之后、待确认占位之前，检查并修正说话人', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/dify/stream/route.ts'), 'utf8');
    expect(route).toContain("from '@/lib/speaker-check'");
    expect(route).toContain("'speaker_check_steps'");
    expect(route).toContain("'speaker_fix_steps'");
    const detail = route.indexOf("'detail_check_steps'");
    const speaker = route.indexOf("'speaker_check_steps'");
    const hold = route.indexOf('仍然没有出处的句子直接换成');
    expect(detail).toBeLessThan(speaker);
    expect(speaker).toBeLessThan(hold);
  });
});
