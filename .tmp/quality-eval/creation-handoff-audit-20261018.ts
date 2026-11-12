// 创作板块跳转审计（离线，不调模型，不写库）：
// 来源板块带着一组带唯一标记的设置（主题、内容方向、目的、人群、意境/风格、想法、主线、补充要求），
// 用和页面相同的交接函数（buildCreationHandoff → resolveCreationSettings）模拟跳到每个目标板块，
// 再检查标记有没有进入目标板块「页面真正用到的那条通道」：
//   - 设置块类（选题、脚本、标题、开篇、审稿、分镜、二创、创作方向、自由对话）：creationSettingsBlock 进提示词
//   - 正文类（账号定位、内容定位、商业定位、成交理由、创作简报）：incomingNote 进「补充说明」，不带设置块
//   - 拆解：creationReference 进正文框，不带设置块
import { buildCreationHandoff, incomingNote, CREATION_DESTINATIONS, CREATION_SOURCES } from '../../lib/creation-flow';
import { resolveCreationSettings, creationSettingsBlock } from '../../lib/creation-settings';
import { creationReference } from '../../lib/creation-continuation';

const FIELDS: Array<{ label: string; marker: string }> = [
  { label: '主题', marker: '主题MARK1' },
  { label: '内容方向', marker: '方向MARK2' },
  { label: '人群', marker: '人群MARK3' },
  { label: '目的(完整)', marker: '目的MARK4' },
  { label: '目的(类别)', marker: '人设型' },
  { label: '意境/风格', marker: '意境MARK5' },
  { label: '原始想法', marker: '想法MARK6' },
  { label: '选定主线', marker: '主线MARK7' },
  { label: '补充要求', marker: '补充MARK8' },
];
const RICH = {
  topic: '主题MARK1', direction: '方向MARK2', audience: '人群MARK3', purposeText: '目的MARK4',
  purpose: '人设型', style: '意境MARK5', userIntent: '想法MARK6', focusContent: '主线MARK7', notes: '补充MARK8',
};
const BODY = '## 纯文字文案\n一条测试口播，正文里没有任何设置信息。';
const NOTE_ONLY = new Set(['positioning', 'content-positioning', 'business-positioning', 'deal-reason', 'creative-brief']);
const REFERENCE_ONLY = new Set(['breakdown']);

const sources = Object.keys(CREATION_SOURCES);
const targets = CREATION_DESTINATIONS.map((d) => d.id as string);
const channel = (t: string) => (NOTE_ONLY.has(t) ? '正文' : REFERENCE_ONLY.has(t) ? '正文' : '设置块');

const rows: Array<{ source: string; target: string; channel: string; lost: string[] }> = [];
let pairs = 0;
for (const source of sources) {
  for (const target of targets) {
    if (source === target) continue;
    pairs++;
    try {
      const srcSettings = resolveCreationSettings({ from: CREATION_SOURCES[source], sourceContent: BODY, settings: RICH as never }, null);
      const payload = buildCreationHandoff(source as never, target as never, BODY, { settings: srcSettings, originContent: BODY });
      let text: string;
      if (NOTE_ONLY.has(target)) text = incomingNote(payload);
      else if (REFERENCE_ONLY.has(target)) text = creationReference(payload);
      else text = creationSettingsBlock(resolveCreationSettings(payload, null));
      const lost = FIELDS.filter((f) => !text.includes(f.marker)).map((f) => f.label);
      if (lost.length) rows.push({ source, target, channel: channel(target), lost });
    } catch (e) {
      rows.push({ source, target, channel: channel(target), lost: ['模拟报错：' + String((e as Error).message).slice(0, 80)] });
    }
  }
}

console.log(`板块对：${pairs}，有丢失的：${rows.length}`);
const byTarget: Record<string, number> = {};
for (const r of rows) byTarget[r.target] = (byTarget[r.target] ?? 0) + 1;
console.log('按目标板块（有丢失的来源数）:', JSON.stringify(byTarget));
const byField: Record<string, number> = {};
for (const r of rows) for (const l of r.lost) byField[l] = (byField[l] ?? 0) + 1;
console.log('按字段（丢失的板块对数）:', JSON.stringify(byField));
for (const r of rows) console.log(`${r.source} → ${r.target}［${r.channel}］丢失：${r.lost.join('、')}`);

// 对照：空设置时应该全部丢失；满设置送进设置块时应该全部在
{
  const emptySrc = resolveCreationSettings({ from: '脚本生成', sourceContent: BODY, settings: {} as never }, null);
  const p0 = buildCreationHandoff('script' as never, 'review' as never, BODY, { settings: emptySrc, originContent: BODY });
  const b0 = creationSettingsBlock(resolveCreationSettings(p0, null));
  console.log('对照-空设置 → 审稿：标记命中', FIELDS.filter((f) => b0.includes(f.marker)).length, '/', FIELDS.length);
  const srcS = resolveCreationSettings({ from: '脚本生成', sourceContent: BODY, settings: RICH as never }, null);
  const p1 = buildCreationHandoff('script' as never, 'review' as never, BODY, { settings: srcS, originContent: BODY });
  const b1 = creationSettingsBlock(resolveCreationSettings(p1, null));
  console.log('对照-满设置 → 审稿：标记命中', FIELDS.filter((f) => b1.includes(f.marker)).length, '/', FIELDS.length);
}
