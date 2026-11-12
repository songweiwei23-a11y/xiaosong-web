import { splitQualityReport } from './script-result-utils';
import { reviewedQualityOutput } from './quality-checks';
import type { WorkDetail, WorkItem } from './resume';

export type ProductionWork = WorkDetail & { creation_brief?: Record<string, unknown> | null };
export interface ProductionShot {
  id: string;
  number: string;
  visual: string;
  speech: string;
  duration: string;
  framing: string;
  movement: string;
  notes: string;
}
export interface ProductionPackData {
  title: string;
  spoken: string;
  scriptSource: WorkItem | null;
  storyboardSource: WorkItem | null;
  titleSource: WorkItem | null;
  storyboard: string;
  shots: ProductionShot[];
  titleCover: string;
  preparation: string[];
  warnings: string[];
}

function hash(text: string): string {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}
const clean = (text: string) => text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\*\*|`/g, '').trim();
const rowsOf = (body: string): string[][] => body.split('\n').filter(line => /^\s*\|/.test(line)).map(line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => clean(cell.replace(/\\\|/g, '|'))));
const separator = (row: string[]) => row.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g, '')));
const column = (header: string[], match: RegExp) => header.findIndex(cell => match.test(cell));

/** 按实际表头识别列，不能把画面说明误作口播，也不假设固定列序。 */
export function parseProductionShots(body: string): ProductionShot[] {
  const rows = rowsOf(body);
  const shots: ProductionShot[] = [];
  let header: string[] | null = null;
  for (const row of rows) {
    if (column(row, /镜号|镜头编号|镜头号|序号/) >= 0 && column(row, /画面|台词|口播|旁白/) >= 0) { header = row; continue; }
    if (!header || separator(row)) continue;
    const val = (re: RegExp) => row[column(header!, re)] ?? '';
    const number = val(/镜号|镜头编号|镜头号|序号/);
    if (!/^(?:镜头?\s*)?\d+(?:[.、号])?$/.test(number)) { header = null; continue; }
    const shot = {
      number, visual: val(/画面|内容描述/), speech: val(/台词|口播|旁白/), duration: val(/时长|时间/),
      framing: val(/景别/), movement: val(/运镜|镜头运动/), notes: val(/要点|备注|拍摄提示/),
    };
    shots.push({ ...shot, id: `shot:${hash(JSON.stringify(shot))}:${shots.length}` });
  }
  if (shots.length) return shots;
  const sections = [...body.matchAll(/^\s*#{1,4}\s*(?:【)?镜头\s*(\d+)[^\n]*\n([\s\S]*?)(?=^\s*#{1,4}\s*|$(?![\s\S]))/gm)];
  for (const m of sections) {
    const lines = m[2].split('\n');
    const val = (re: RegExp) => lines.map(clean).map(line => line.replace(/^[-*]\s*/, '')).find(line => re.test(line))?.replace(/^[^：:]+[：:]\s*/, '') ?? '';
    const shot = { number: m[1], visual: val(/^(?:画面|画面内容)[：:]/), speech: val(/^(?:台词(?:\/旁白)?|口播|旁白)[：:]/), duration: val(/^(?:时长|时间)[：:]/), framing: val(/^景别[：:]/), movement: val(/^运镜[：:]/), notes: val(/^(?:拍摄要点|备注)[：:]/) };
    if (shot.visual || shot.speech) shots.push({ ...shot, id: `shot:${hash(JSON.stringify(shot))}:${shots.length}` });
  }
  return shots;
}

function explicitSection(body: string): string {
  const lines = body.split('\n');
  const start = lines.findIndex(line => /^\s*#{1,4}\s+/.test(line) && /纯文字文案|口播全文|完整口播/.test(line));
  if (start < 0) return '';
  const level = lines[start].match(/^\s*(#+)/)![1].length;
  const next = lines.findIndex((line, i) => i > start && (line.match(/^\s*(#+)\s+/)?.[1].length ?? 99) <= level);
  return lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim();
}

/** 只提取真实台词列/标签/明确口播正文，不能把策略报告念给用户。 */
export function productionSpeech(body: string, explicitlySpoken = false): string {
  const text = splitQualityReport(body).body;
  const section = explicitSection(text);
  if (section) return productionSpeech(section, true);
  const tableSpeech: string[] = [];
  let speechColumn = -1;
  const tableRows = rowsOf(text);
  for (let i = 0; i < tableRows.length; i++) {
    const row = tableRows[i];
    const found = column(row, /^(?:台词|口播|口播文案|旁白|台词\/旁白|台词\/口播|口播\/旁白)$/);
    // 新表的表头一定要重新判定，不能把后面的设备/准备表沿用成台词列。
    if (i + 1 < tableRows.length && separator(tableRows[i + 1])) { speechColumn = found; continue; }
    if (speechColumn < 0 || separator(row)) continue;
    const speech = row[speechColumn];
    if (speech && !/^(?:无|—|-|空镜|无台词)$/.test(speech)) tableSpeech.push(speech);
  }
  if (tableSpeech.length) return tableSpeech.join('\n');
  const labelled = text.split('\n').map(clean).map(line => line.match(/^\s*(?:[-*>]\s*)?(?:台词(?:\/旁白|外音)?|口播|旁白)[：:]\s*(.+)$/)?.[1]).filter((v): v is string => !!v);
  if (labelled.length) return labelled.join('\n');
  if (!explicitlySpoken || /^\s*\|/m.test(text)) return '';
  return text.split('\n').filter(line => !/^\s*#{1,4}\s+/.test(line) && !/^\s*-{3,}\s*$/.test(line)).map(clean).filter(Boolean).join('\n');
}

export function buildProductionPack(work: ProductionWork): ProductionPackData {
  const latest = (task: string) => [...work.items].filter(it => it.task_type === task && it.result?.trim()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const warnings: string[] = [];
  let spoken = '';
  let scriptSource: WorkItem | null = null;
  for (const it of latest('审稿优化')) {
    const reviewed = reviewedQualityOutput(it.result);
    const candidate = reviewed ? productionSpeech(reviewed, true) : '';
    if (candidate) { spoken = candidate; scriptSource = it; break; }
  }
  if (!spoken) for (const it of latest('脚本生成')) {
    const candidate = productionSpeech(it.result);
    if (candidate) { spoken = candidate; scriptSource = it; break; }
  }
  const newestReview = latest('审稿优化')[0];
  if (newestReview && scriptSource?.id !== newestReview.id) warnings.push('最新审稿未识别到可读口播正文，当前采用其他已有版本，请核对后再拍。');
  const storyboardSource = latest('分镜脚本')[0] ?? null;
  const titleSource = latest('标题封面')[0] ?? null;
  const storyboard = storyboardSource ? splitQualityReport(storyboardSource.result).body : '';
  const shots = parseProductionShots(storyboard);
  if (!spoken && shots.length) {
    spoken = shots.map(shot => shot.speech).filter(line => line && !/^(?:无|—|-|空镜|无台词)$/.test(line)).join('\n');
    scriptSource = spoken ? storyboardSource : null;
  }
  if (!spoken) warnings.push('尚未识别到明确的口播正文，请先生成脚本或检查现有脚本格式。');
  if (!storyboard) warnings.push('尚无分镜，镜头清单待生成；本交付包不会自动编造镜头。');
  else if (!shots.length) warnings.push('已有分镜原文，但格式暂不能拆为镜头清单，请查看原文并确认。');
  if (!titleSource) warnings.push('标题封面待生成。');
  if (scriptSource && storyboardSource && scriptSource.created_at > storyboardSource.created_at) warnings.push('口播稿比当前分镜更新，请核对台词与镜头是否一致，必要时重新生成分镜。');
  const newerScript = latest('脚本生成')[0];
  if (scriptSource?.task_type === '审稿优化' && newerScript && newerScript.created_at > scriptSource.created_at) warnings.push('采用最新可识别审稿交付稿；存在更晚生成的脚本，请确认要拍哪一版。');
  const preparation: string[] = [];
  for (const source of [storyboard, scriptSource?.result ?? '']) {
    const lines = source.split('\n');
    let collecting = false;
    let level = 99;
    for (const line of lines) {
      const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
      if (heading) {
        if (/拍摄准备|准备清单|道具清单|场地清单|出镜人员|设备清单/.test(heading[2])) { collecting = true; level = heading[1].length; continue; }
        if (heading[1].length <= level) collecting = false;
      }
      if (collecting && clean(line) && !/^\s*-{3,}\s*$/.test(line)) preparation.push(clean(line).replace(/^[-*]\s*/, ''));
      else if (/^\s*(?:[-*]\s*)?(?:\*\*)?(?:道具|设备|场地|出镜人员|拍摄准备)(?:\*\*)?[：:]/.test(line)) preparation.push(clean(line).replace(/^[-*]\s*/, ''));
    }
  }
  const brief = work.creation_brief;
  if (brief) for (const key of ['shootingConditions', 'shootingSetup', 'availableProps', 'shootingLocation']) {
    if (typeof brief[key] === 'string' && brief[key].trim()) preparation.push(`作品已保存信息：${brief[key].trim()}`);
  }
  if (!preparation.length) warnings.push('已有内容未提供拍摄准备清单，设备、场地、出镜人和素材使用许可需要自行确认。');
  return { title: work.title, spoken, scriptSource, storyboardSource, titleSource, storyboard, shots, titleCover: titleSource?.result ?? '', preparation: [...new Set(preparation)], warnings };
}

export function productionChecklistKey(userId: string | null | undefined, profileId: string | null, workId: string): string | null {
  if (!userId || !workId) return null;
  return `kaiwu:shoot-checklist:v1:${encodeURIComponent(userId)}:${encodeURIComponent(profileId ?? 'no-profile')}:${encodeURIComponent(workId)}`;
}
export function readProductionChecklist(raw: string | null, shots: ProductionShot[]): string[] {
  if (!raw) return [];
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && shots.some(shot => shot.id === id)))] : []; } catch { return []; }
}

export function productionMarkdown(pack: ProductionPackData, completed: string[] = []): string {
  const source = (item: WorkItem | null) => item ? `来源：${item.task_type} / ${item.created_at} / ${item.id}` : '待生成';
  const sections = [`# ${pack.title} · 拍摄交付包`, '', '## 口播稿', source(pack.scriptSource), '', pack.spoken || '待生成或确认明确口播正文。', '', '## 逐镜头拍摄清单', source(pack.storyboardSource), ''];
  if (!pack.shots.length) sections.push('待生成分镜，或查看下方分镜原文确认。');
  for (const shot of pack.shots) {
    sections.push(`- [${completed.includes(shot.id) ? 'x' : ' '}] 镜头 ${shot.number}${shot.duration ? ` · ${shot.duration}` : ''}`);
    for (const [label, value] of [['景别', shot.framing], ['运镜', shot.movement], ['画面', shot.visual], ['台词', shot.speech], ['拍摄要点', shot.notes]]) if (value) sections.push(`  - ${label}：${value.replace(/\n/g, ' / ')}`);
  }
  sections.push('', '## 拍摄准备（仅来自已有内容）', ...(pack.preparation.length ? pack.preparation.map(line => `- ${line}`) : ['未提供，请确认实际条件。']), '', '## 标题封面', source(pack.titleSource), '', pack.titleCover || '待生成。', '', '## 分镜原文', '', pack.storyboard || '待生成。');
  if (pack.warnings.length) sections.push('', '## 待确认', ...pack.warnings.map(line => `- ${line}`));
  return sections.join('\n');
}
export function productionFilename(title: string, extension: 'md' | 'txt'): string {
  return `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 70) || '开物作品'}_${extension === 'md' ? '拍摄交付包' : '口播稿'}.${extension}`;
}
