import { describe, expect, it } from 'vitest';
import { buildCreationHandoff, CREATION_DESTINATIONS, CREATION_SOURCES, incomingNote } from '@/lib/creation-flow';
import { creationBridgePrompt } from '@/lib/creation-bridge';
import { selectedCreationContext } from '@/lib/creation-selection';
import { creationReference, carriedIntent, originForResult } from '@/lib/creation-continuation';
import { resolveCreationSettings, mergeCreationSettings, creationSettingsForPersistence, creationSettingsBlock, hasExplicitCreationContext } from '@/lib/creation-settings';
import { readCreationSnapshot } from '@/lib/creation-snapshot';
import { creationRestorePlan } from '@/lib/creation-restore';
import { readLibraryCreationContext } from '@/lib/library';
import { workCreationHandoff } from '@/lib/creation-work-resume';

const root = '我想做县城大众讨论内容，不卖课程、不引导私信。保留不同观点，围绕年轻人为什么返乡。';
const explicit = { purpose: '流量型' as const, userIntent: root, audience: '县城返乡青年', direction: '生活选择与代际观点', structure: 'contrast', notes: '不能推销；不能编造真人经历' };
const conflicting = '### 方案2：年轻人返乡\n视频目的：变现型\n目标人群：装修业主\n核心思路：引流卖课程\n口播：年轻人返乡该先考虑什么？';

describe('用户原意优先于自动推断，全部出口与目标交叉覆盖', () => {
  for (const source of Object.keys(CREATION_SOURCES)) {
    it.each(CREATION_DESTINATIONS.map(d => d.id))(`${source} → %s 不被AI标签、默认配比改成促销`, target => {
      const payload = buildCreationHandoff(source, target, conflicting, { originContent: root, settings: explicit });
      const saved = readCreationSnapshot(payload)!;
      expect(saved).toBeTruthy();
      const received = resolveCreationSettings(saved);
      expect(received.purpose).toBe('流量型');
      expect(received.audience).toBe(explicit.audience);
      expect(received.direction).toBe(explicit.direction);
      expect(received.userIntent).toBe(root);
      expect(saved.originContent).toBe(root);
      expect(creationBridgePrompt(saved)).toContain('不能推销');
    });
  }
  it('多跳往返仍保留原意，用户主动改目的时服从新选择', () => {
    let context = { originContent: root, settings: explicit };
    for (const source of ['growth', 'script', 'review', 'title', 'free-chat', 'direction', 'positioning', 'creative-brief', 'remix']) {
      const payload = buildCreationHandoff(source, 'topic', conflicting, context);
      context = { originContent: payload.originContent!, settings: resolveCreationSettings(payload) as typeof explicit };
      expect(context.settings.purpose).toBe('流量型');
      expect(context.settings.userIntent).toBe(root);
    }
    expect(buildCreationHandoff('review', 'script', conflicting, { ...context, settings: mergeCreationSettings(context.settings, { purpose: '人设型' }) }).settings?.purpose).toBe('人设型');
  });
});

describe('单方案、完整材料、版本与混合目的', () => {
  it('编号标题在交接和自动填表中使用同一个主题，不误判换题分裂作品', () => {
    const body = '### 方案2：返乡选择\n核心角度：返乡的生活选择';
    const selected = selectedCreationContext({ settings: explicit }, body, '方案2：返乡选择', ['方案2：返乡选择']);
    const payload = buildCreationHandoff('free-chat', 'script', body, selected);
    expect(selected.topic).toBe('返乡选择');
    expect(payload.topic).toBe('返乡选择');
    expect(payload.settings?.topic).toBe('返乡选择');
    expect(resolveCreationSettings(payload).topic).toBe(payload.topic);
  });
  it.each(CREATION_DESTINATIONS.map(d => d.id))('国庆后县城消费观察 → %s 守住勾选主线，不回到泛县城话题', target => {
    const chosen = '### 方向1：国庆后的县城消费观察\n核心角度：国庆后县城老板的真实状态\n从假期客流与日常回头客的差别观察县城消费。';
    const context = selectedCreationContext({ originContent: '我想在县城拍大流量的视频', settings: { purpose: '流量型', direction: '泛县城商业话题', userIntent: '想做破圈讨论，不做广告', audience: '全国县城老板' } }, chosen, '国庆后的县城消费观察', ['国庆后的县城消费观察']);
    const restored = readCreationSnapshot(buildCreationHandoff('free-chat', target, chosen, context))!;
    expect(restored.settings?.focusContent).toBe(chosen);
    expect(restored.settings?.direction).toBe('国庆后县城老板的真实状态');
    expect(restored.settings?.purpose).toBe('流量型');
    expect(creationSettingsBlock(restored.settings!)).toContain('不退回更宽泛的大方向');
    expect(hasExplicitCreationContext(restored.settings)).toBe(true);
  });
  it('标题、开头的局部修改不更换已选主线；没有具体材料的自由问句仍可使用原对话', () => {
    const ctx = { settings: { focusContent: '国庆后县城消费观察', topic: '国庆后县城消费观察', userIntent: '做破圈讨论' } };
    expect(selectedCreationContext(ctx, '新标题', '新标题', [], 'title').settings?.focusContent).toBe(ctx.settings.focusContent);
    expect(selectedCreationContext(ctx, '新开头', '新开头', [], 'growth').settings?.focusContent).toBe(ctx.settings.focusContent);
    expect(hasExplicitCreationContext({ userIntent: '刚才那条再改一下' })).toBe(false);
  });
  it('只选方案2：清除旧题目/旧开头/旧脚本，完整参考也不夹回方案1', () => {
    const a = '### 方案1：卖课\n旧文案独有A';
    const b = '### 方案2：返乡\n新想法独有B';
    const selected = selectedCreationContext({ originContent: a + '\n\n' + b, settings: { ...explicit, topic: '卖课', workingScript: '旧稿A', openingLine: '快来买课' } }, b, '返乡', ['返乡']);
    for (const target of CREATION_DESTINATIONS) {
      const p = buildCreationHandoff('free-chat', target.id, b, selected);
      expect(p.settings?.topic).toBe('返乡');
      expect(p.settings?.purpose).toBe('流量型');
      expect(creationReference(p)).not.toContain('旧文案独有A');
      expect(creationReference(p)).not.toContain('旧稿A');
    }
    expect(readLibraryCreationContext(selected)?.settings?.userIntent).toBe(root);
  });
  it('定位表单摘要有长度上限，模型上下文仍包含原意与材料尾部', () => {
    const p = buildCreationHandoff('review', 'deal-reason', '当前文案' + '字'.repeat(6000) + '尾部禁止推销', { originContent: root, settings: explicit });
    expect(incomingNote(p).length).toBeLessThan(1900);
    expect(incomingNote(p)).toContain('尾部禁止推销');
    expect(creationBridgePrompt(p)).toContain(p.sourceContent!);
    expect(creationBridgePrompt(p)).toContain(root);
  });
  it('人设+变现不能简化成一个目的，也不能继承AI自写的单一目的', () => {
    const p = buildCreationHandoff('remix', 'script', conflicting, { settings: { purposeText: '人设型+变现型', userIntent: '两种都要' } });
    expect(p.settings?.purpose).toBeUndefined();
    expect(carriedIntent(p).roles).toEqual(['人设型', '变现型']);
    expect(readCreationSnapshot(p)?.settings?.purposeText).toBe('人设型+变现型');
  });
  it('标题操作不会用过期的开头改写当前脚本', () => {
    const p = buildCreationHandoff('title', 'review', '新标题', { settings: { workingScript: '当前完整稿。后续正文', openingLine: '旧开头' } });
    expect(p.scriptContent).toBe('当前完整稿。后续正文');
  });
  it('选单个标题属于局部修改，直跳或收藏后审稿仍带完整脚本', () => {
    const ctx = selectedCreationContext({ settings: { ...explicit, workingScript: '当前完整脚本', openingLine: '旧开头' } }, '新标题B', '新标题B', [], 'title');
    expect(buildCreationHandoff('title', 'review', '新标题B', ctx).scriptContent).toBe('当前完整脚本');
    expect(buildCreationHandoff('library', 'review', '新标题B', { ...ctx, from: '标题封面' }).scriptContent).toBe('当前完整脚本');
    expect(buildCreationHandoff('free-chat', 'review', '新标题B', ctx).scriptContent).toBe('当前完整脚本');
    expect(buildCreationHandoff('title', 'topic', '新标题B', ctx).settings?.workingScript).toBe('当前完整脚本');
    expect(ctx.settings?.purpose).toBe('流量型');
  });
  it('数据库合并不能复活被清除的旧目的、旧脚本；选中方案另存分支', () => {
    const prior = { purpose: '变现型', workingScript: '另一个方案旧稿', openingLine: '促销开头' };
    const stored = { ...prior, ...creationSettingsForPersistence({ purposeText: '流量型+人设型', userIntent: root }) };
    const restored = readCreationSnapshot({ from: '二创', target: '/dashboard/script', settings: stored })!;
    expect(restored.settings?.purpose).toBeUndefined();
    expect(restored.settings?.workingScript).toBeUndefined();
    expect(restored.settings?.openingLine).toBeUndefined();
    expect(selectedCreationContext({ workId: 'old' }, '新方案', '新题目').branch).toBe(true);
  });
  it('历史按对应版本恢复，不能拿当前编辑的另一条原意填旧记录', () => {
    expect(originForResult('历史A', [{ result: '历史A', input_data: { originContent: '原意A' } }], '正在编辑B')).toBe('原意A');
    expect(originForResult('旧记录', [{ result: '旧记录' }], '正在编辑B')).toBe('');
  });
  it('刷新作品时，旧历史不能覆盖本次跳转的新目的，跳转后的明确修改仍优先', () => {
    const work = { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: '返乡', profile_id: null, is_done: false,
      creation_brief: { from: '脚本生成', sourceContent: '讨论稿', intentUpdatedAt: '2026-10-07T02:00:00Z', settings: { purpose: '流量型', userIntent: root } },
      items: [{ id: 'h1', task_type: '脚本生成', result: '旧稿', created_at: '2026-10-07T01:00:00Z', input_data: { creationSettings: { purpose: '变现型' } } }] };
    expect(workCreationHandoff(work as never, 'review').settings?.purpose).toBe('流量型');
    expect(workCreationHandoff(work as never, 'review').sourceContent).toBe('讨论稿');
    work.items[0].created_at = '2026-10-07T03:00:00Z';
    expect(workCreationHandoff(work as never, 'review').settings?.purpose).toBe('变现型');
  });
  it('方案显示标题与实际主题不一样时，恢复的主题仍按生成输入，最新稿和原意仍在同一作品', () => {
    const work = { id: 'aaaaaaaa-0000-4000-8000-000000000001', title: '方案2：返乡选择', profile_id: null, is_done: false,
      creation_brief: { settings: { ...explicit, topic: '返乡选择' }, originContent: root },
      items: [{ id: 'h1', task_type: '脚本生成', result: '## 纯文字文案\n最新讨论稿', created_at: '2026-10-07T03:00:00Z', input_data: { topic: '返乡选择', originContent: root, creationSettings: explicit } }] };
    const restored = workCreationHandoff(work as never, 'script');
    expect(restored.topic).toBe('返乡选择');
    expect(restored.workId).toBe(work.id);
    expect(restored.sourceContent).toContain('最新讨论稿');
    expect(restored.settings?.userIntent).toBe(root);
  });
  it.each(['positioning', 'content-positioning', 'business-positioning', 'deal-reason', 'creative-brief', 'direction'])('刷新 %s 无作品接收链仍恢复完整快照', target => {
    expect(creationRestorePlan({ id: 'x', payload: { from: '自由对话', target: '/dashboard/' + target }, createdAt: null, work: null, restoredBefore: true })).toBe('snapshot');
  });
});
