/**
 * 交接只带该带的正文（体检 T03、T04）。
 * 分镜去审稿不能把整张表送进审稿框；选题去开篇不能把「承接」预填成现有开头。
 */
import { describe, expect, it } from 'vitest';
import { buildCreationHandoff, creationLinkMaterial, creationScript, handoffFromCreationLinks } from '@/lib/creation-flow';
import { draftFromBody } from '@/lib/library';
import { factsFromBody } from '@/lib/next-steps';

const TABLE = [
  '| 镜号 | 景别 | 运镜 | 画面内容 | 台词/旁白 | 时长 | 拍摄要点 |',
  '|---|---|---|---|---|---|---|',
  '| 1 | 特写 | 固定 | 门口 | 节后第一天店里冷清 | 4s | 稳住 |',
  '| 2 | 中景 | 固定 | 后厨 | 无 | 3s | 空镜 |',
  '| 3 | 近景 | 推镜 | 老板 | 我问了三家才知道 | 5s | 推进 |',
].join('\n');

describe('分镜、脚本去审稿只带口播', () => {
  it('镜号为空的续行、S01 和「无」「BGM」：只留下要念的字', () => {
    const table = [
      '| 镜头 | 景别 | 台词/旁白 | 时间码 | 时长(秒) |',
      '|---|---|---|---|---|',
      '| S01 | 特写 | 节后第一天店里冷清 | 00:00:00 | 0:03 |',
      '|  |  | —— |  |  |',
      '| S02 | 近景 | （无） | 00:00:03 | 00:04 |',
      '| S03 | 中景 | 我问了三家才知道 | 00:00:07 | 4s |',
      '|  |  | 第二句也要念 |  | 0:02 |',
      '|  |  | BGM |  |  |',
      '|  |  | 音乐 |  |  |',
    ].join('\n');
    expect(creationScript('storyboard', table)).toBe('节后第一天店里冷清\n我问了三家才知道\n第二句也要念');
  });

  it('1-1、2a、3（插入）和「同上」续行的台词都留在口播里', () => {
    const table = [
      '| 镜号 | 景别 | 台词 | 时长 |',
      '|---|---|---|---|',
      '| 1 | 中景 | 第一句要留下 | 3s |',
      '| 1-1 | 特写 | 插进的一句 | 2s |',
      '| 〃 |  | 续上的一句 | 1s |',
      '| 2a | 近景 | 第二句要留下 | 4s |',
      '| 同上 |  | 接着说的一句 | 1s |',
      '| 3（插入） | 特写 | 第三句要留下 | 2s |',
    ].join('\n');
    expect(creationScript('storyboard', table)).toBe('第一句要留下\n插进的一句\n续上的一句\n第二句要留下\n接着说的一句\n第三句要留下');
  });

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

  it('审稿和标题用输入框里的口播；收藏、推荐和自由对话仍用分镜表', () => {
    const table = '# 分镜脚本表\n| 镜号 | 景别 | 台词/旁白 | 时长 |\n|---|---|---|---|\n| 1 | 特写 | 节后第一天店里冷清 | 4s |';
    const spoken = '审过的完整口播。这一句表里没有。';
    const review = handoffFromCreationLinks('storyboard', 'review', table, {}, spoken);
    expect(review.scriptContent).toBe(spoken);
    expect(review.settings?.workingScript).toBe(spoken);
    expect(review.sourceContent).toContain('镜号');
    expect(review.sourceContent).not.toBe(spoken);

    const title = handoffFromCreationLinks('storyboard', 'title', table, {}, spoken);
    expect(title.sourceContent).toBe(spoken);
    expect(title.sourceContent).not.toContain('镜号');

    const chat = handoffFromCreationLinks('storyboard', 'free-chat', table, {}, spoken);
    expect(chat.sourceContent).toContain('| 镜号 |');
    expect(chat.sourceContent).not.toBe(spoken);

    const material = creationLinkMaterial(table, spoken);
    expect(material).toBe(table);
    expect(draftFromBody(material, 'storyboard', '分镜脚本')).toMatchObject({ content: table, category: 'storyboard' });
    expect(factsFromBody(material, 'storyboard', false).hasShots).toBe(true);
    expect(factsFromBody(spoken, 'storyboard', false).hasShots).toBe(false);
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

  it('钩子不带「台词：」、前面有承接、和标签写在同一行时，只取那一句', () => {
    const sameLine = [
      '**承接**：用户原话说节后店里冷清，想知道是不是只有自己这样。',
      '**打法**：先用开篇钩子把人留住，再讲三家店的客流。',
      '**2️⃣ 开篇钩子**：节后第一天，店里到底还有没有人？',
      '**3️⃣ 内容方向及目的**',
      '问三家店节后的真实客流',
    ].join('\n');
    const handed = buildCreationHandoff('topic', 'growth', sameLine);
    expect(handed.currentOpening).toBe('节后第一天，店里到底还有没有人？');
    expect(handed.currentOpening).not.toContain('用户原话');
    expect(handed.currentOpening).not.toContain('内容方向');

    const quoted = [
      '**承接**：参考句不该进现有开头。',
      '**开篇钩子**',
      '- 文案：「节后第一天，店里到底还有没有人？」',
    ].join('\n');
    expect(buildCreationHandoff('topic', 'growth', quoted).currentOpening).toBe('节后第一天，店里到底还有没有人？');
  });

  it('只带了题目时，现有开头留空', () => {
    expect(buildCreationHandoff('topic', 'growth', '## 选题1：节后店里突然冷清').currentOpening).toBe('');
  });
});
