/**
 * 交接只带该带的正文（体检 T03、T04）。
 * 分镜去审稿不能把整张表送进审稿框；选题去开篇不能把「承接」预填成现有开头。
 */
import { describe, expect, it } from 'vitest';
import { buildCreationHandoff, creationScript } from '@/lib/creation-flow';
import { readCode } from './helpers/source';

const TABLE = [
  '| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |',
  '|---|---|---|---|---|---|---|',
  '| 1 | 特写 | 固定 | 门口 | 节后第一天店里冷清 | 4s | 稳住 |',
  '| 2 | 中景 | 固定 | 后厨 | 无 | 3s | 空镜 |',
  '| 3 | 近景 | 推镜 | 老板 | 我问了三家才知道 | 5s | 推进 |',
].join('\n');

describe('分镜、脚本去审稿只带口播', () => {
  it('标准分镜表只带台词列，不带镜号、景别和「无」', () => {
    const script = creationScript('storyboard', `# 🎬 分镜脚本表\n\n${TABLE}\n\n## 拍摄顺序\n按机位拍`);
    expect(script).toBe('节后第一天店里冷清\n我问了三家才知道');
    expect(buildCreationHandoff('storyboard', 'review', TABLE).scriptContent).toBe(script);
  });

  it('纯文字文案和行首台词不一致时，以纯文字文案为准', () => {
    const body = '台词：只有半句\n台词：另一半句\n## 纯文字文案\n完整的第一句。\n完整的第二句。';
    expect(creationScript('script', body)).toBe('完整的第一句。\n完整的第二句。');
    expect(buildCreationHandoff('script', 'review', body).scriptContent).not.toContain('只有半句');
  });

  it('二级标题的纯文字文案包着三级分镜表时，表不留在口播里', () => {
    const body = '## 纯文字文案\n这句才是完整口播。\n下一句也要带上。\n### 分镜表\n| 镜号 | 台词 |\n| 1 | 半句 |';
    const script = creationScript('script', body);
    expect(script).toBe('这句才是完整口播。\n下一句也要带上。');
    expect(script).not.toContain('分镜表');
    expect(script).not.toContain('半句');
  });

  it('分镜页继续创作带走输入框里的口播，和起标题用的是同一份', () => {
    const page = readCode('app/dashboard/storyboard/page.tsx');
    expect(page).toMatch(/creationBody=\{scriptContent\}/);
    expect(readCode('app/dashboard/review/page.tsx')).toMatch(/takeHandoff\(pathname \|\| "\/dashboard\/review"\)/);
  });
});

describe('选题去开篇：现有开头不预填承接', () => {
  const topic = [
    '## 选题1：节后店里突然冷清',
    '',
    '**承接**：用户原话说节后店里冷清，想知道是不是只有自己这样。',
    '',
    '**0️⃣ 视频目的**',
    '流量型，因为观众想对号入座',
    '',
    '**2️⃣ 开篇钩子**',
    '台词：节后第一天，店里到底还有没有人？',
    '',
    '**3️⃣ 内容方向及目的**',
    '核心内容方向：问三家店节后的真实客流',
  ].join('\n');

  it('有开篇钩子时只取那一句，不取承接', () => {
    const handed = buildCreationHandoff('topic', 'growth', topic);
    expect(handed.currentOpening).toBe('节后第一天，店里到底还有没有人？');
    expect(handed.currentOpening).not.toContain('用户原话');
  });

  it('只带了题目时，现有开头留空', () => {
    expect(buildCreationHandoff('topic', 'growth', '## 选题1：节后店里突然冷清').currentOpening).toBe('');
  });
});
