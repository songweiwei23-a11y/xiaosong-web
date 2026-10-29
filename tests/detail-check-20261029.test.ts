/**
 * 生成稿的编造细节检查（lib/detail-check，2026-10-29）。
 *
 * 守的是"模型把原文扩写成了没有出处的道具、动作、时间场景，却看着像真的"：
 *   - 核对员的回答读不出来，就不能误报，也不能让生成失败
 *   - 标出的原句要能被「按资料修正」认得（取「」里的字，去掉引号）
 *   - 只把具体到能拍的说法交给核对，价格、顾客见证这些有别的检查
 */
import { describe, it, expect } from 'vitest';
import { DETAIL_CHECK_TASKS, buildDetailCheckPrompt, parseDetailCheck } from '@/lib/detail-check';

describe('DETAIL_CHECK_TASKS：哪些板块要查', () => {
  it('定位类、简报、规划、方向要查', () => {
    for (const t of ['账号定位', '内容定位', '商业定位', '创作简报', '内容规划', '创作方向']) {
      expect(DETAIL_CHECK_TASKS.has(t)).toBe(true);
    }
  });

  it('选题、脚本不在这里查（它们有各自的检查）', () => {
    expect(DETAIL_CHECK_TASKS.has('选题策划')).toBe(false);
    expect(DETAIL_CHECK_TASKS.has('脚本生成')).toBe(false);
  });
});

describe('buildDetailCheckPrompt：提示词', () => {
  const text = '午休赶时间，拿空饭盒合盖。';
  const known = '档案：下班打包，装盒。';

  it('稿子和已知素材都放进去，并要求只输出 JSON', () => {
    const prompt = buildDetailCheckPrompt(text, known);
    expect(prompt).toContain(`【稿子】\n${text}`);
    expect(prompt).toContain(`【已知素材】\n${known}`);
    expect(prompt).toContain('{"unsupported":');
  });

  it('列出的例子里包含这次实测的「午休」「空饭盒」「合盖」，判断标准写明', () => {
    const prompt = buildDetailCheckPrompt(text, known);
    expect(prompt).toContain('午休');
    expect(prompt).toContain('空饭盒');
    expect(prompt).toContain('合盖');
    expect(prompt).toContain('通用的拍摄建议');
    expect(prompt).toContain('价格、顾客见证、经营承诺不在这里标');
  });

  it('已知素材超长时截断，不把整份档案塞进去', () => {
    const long = '档案'.repeat(20_000);
    const prompt = buildDetailCheckPrompt(text, long);
    expect(prompt.length).toBeLessThan(long.length);
  });
});

describe('parseDetailCheck：读核对员的回答', () => {
  it('标出的几处转成「按资料修正」认得的格式，「」里的原句去掉引号', () => {
    const raw = '{"unsupported":["午休赶时间","空饭盒、合盖"]}';
    expect(parseDetailCheck(raw)).toEqual([
      '「午休赶时间」：素材里找不到这个具体说法，删掉，或改成素材里有的说法',
      '「空饭盒、合盖」：素材里找不到这个具体说法，删掉，或改成素材里有的说法',
    ]);
  });

  it('没有问题输出空数组', () => {
    expect(parseDetailCheck('{"unsupported":[]}')).toEqual([]);
  });

  it('模型带了代码块或前后解释，仍能取出 JSON', () => {
    const raw = '好的，结果如下：\n```json\n{"unsupported":["饭盒装菜"]}\n```';
    expect(parseDetailCheck(raw)).toEqual(['「饭盒装菜」：素材里找不到这个具体说法，删掉，或改成素材里有的说法']);
  });

  it('读不出 JSON、字段类型不对，都返回空数组，不误报', () => {
    expect(parseDetailCheck('没有任何结构的文字')).toEqual([]);
    expect(parseDetailCheck('{"unsupported":')).toEqual([]);
    expect(parseDetailCheck('{"unsupported":"不是数组"}')).toEqual([]);
    expect(parseDetailCheck('{"other":["饭盒"]}')).toEqual([]);
  });

  it('重复的只留一条，单字不要（不够定位原句）', () => {
    const raw = '{"unsupported":["饭盒","饭盒","合","合盖"]}';
    const items = parseDetailCheck(raw);
    expect(items).toHaveLength(2);
    expect(items.some((s) => s.startsWith('「合」'))).toBe(false);
  });

  it('最多 8 条', () => {
    const many = Array.from({ length: 12 }, (_, i) => `道具${i}`);
    const raw = JSON.stringify({ unsupported: many });
    expect(parseDetailCheck(raw)).toHaveLength(8);
  });
});
