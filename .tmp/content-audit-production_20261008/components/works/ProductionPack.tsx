'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Download, FileText, ListChecks, Type } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { workStageUrl } from '@/lib/resume';
import { buildProductionPack, productionChecklistKey, readProductionChecklist, productionMarkdown, productionFilename, type ProductionWork } from '@/lib/production-pack';

/** 只组合已有内容，不生成新内容；逐镜头标记仅在当前账号/档案/作品的本机保存。 */
export function ProductionPack({ work, userId }: { work: ProductionWork; userId?: string | null }) {
  const pack = useMemo(() => buildProductionPack(work), [work]);
  const [ownerId, setOwnerId] = useState<string | null>(userId ?? null);
  const [checklist, setChecklist] = useState<{ key: string | null; ids: string[] }>({ key: null, ids: [] });
  const [large, setLarge] = useState(false);
  const [fontSize, setFontSize] = useState(30);
  const [storageNotice, setStorageNotice] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const scopedOwner = userId === undefined || userId === ownerId ? ownerId : null;
  const storageKey = productionChecklistKey(scopedOwner, work.profile_id, work.id);
  const completed = checklist.key === storageKey ? checklist.ids.filter(id => pack.shots.some(shot => shot.id === id)) : [];

  useEffect(() => {
    let alive = true;
    setOwnerId(userId ?? null);
    void supabase.auth.getSession().then(({ data }) => { if (alive) setOwnerId(data.session?.user.id ?? null); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setOwnerId(session?.user.id ?? null); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [userId]);

  useEffect(() => {
    setChecklist({ key: storageKey, ids: [] });
    if (!storageKey) { setStorageNotice('请登录后保存拍摄标记。'); return; }
    try { setChecklist({ key: storageKey, ids: readProductionChecklist(localStorage.getItem(storageKey), pack.shots) }); setStorageNotice('拍摄标记仅保存在当前浏览器，不会同步到其他设备。'); }
    catch { setStorageNotice('浏览器禁止本地保存，本次标记仅在当前页面有效。'); }
  }, [storageKey, pack.shots]);

  const toggle = (id: string) => {
    const next = completed.includes(id) ? completed.filter(value => value !== id) : [...completed, id];
    setChecklist({ key: storageKey, ids: next });
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageNotice('本地保存失败，本次标记仅在当前页面有效。'); }
  };
  const download = (extension: 'md' | 'txt') => {
    setDownloadError('');
    let url: string | null = null;
    try {
      const content = extension === 'md' ? productionMarkdown(pack, completed) : pack.spoken;
      if (!content) { setDownloadError('尚无明确口播正文，请先生成或确认脚本。'); return; }
      url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = productionFilename(work.title, extension);
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      const revoke = url;
      window.setTimeout(() => URL.revokeObjectURL(revoke), 1000);
    } catch { if (url) URL.revokeObjectURL(url); setDownloadError('下载未完成，请重试或复制已有内容。'); }
  };

  return <section className="glass-panel space-y-4 rounded-2xl border border-border p-4 sm:p-5" aria-label="拍摄交付包">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-medium"><ListChecks className="h-4 w-4 text-primary" />拍摄交付包</h3><p className="mt-1 text-xs text-muted-foreground">把已有稿件带到拍摄现场，缺少的内容会提示待生成。</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => download('md')} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary"><Download className="h-3.5 w-3.5" />导出完整包</button>
        <button type="button" disabled={!pack.spoken} onClick={() => download('txt')} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary disabled:opacity-40"><FileText className="h-3.5 w-3.5" />口播 TXT</button>
      </div>
    </div>
    {downloadError && <p role="alert" className="text-xs text-destructive">{downloadError}</p>}
    {pack.warnings.length > 0 && <ul className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-300">{pack.warnings.map(warning => <li key={warning}>· {warning}</li>)}</ul>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setLarge(value => !value)} aria-pressed={large} disabled={!pack.spoken} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary disabled:opacity-40"><Type className="h-4 w-4" />{large ? '收起大字稿' : '手机大字稿'}</button>
      {!pack.spoken && <Link href={workStageUrl(work.id, '脚本生成')} className="text-xs text-primary underline">去补脚本</Link>}
      {!pack.storyboard && <Link href={workStageUrl(work.id, '分镜脚本')} className="text-xs text-primary underline">去生成分镜</Link>}
      {!pack.titleCover && <Link href={workStageUrl(work.id, '标题封面')} className="text-xs text-primary underline">去生成标题封面</Link>}
    </div>
    {large && <div className="rounded-xl border border-border bg-background/70 p-4">
      <label className="flex items-center gap-3 text-xs text-muted-foreground">字体大小<input type="range" aria-label="口播字体大小" min={22} max={48} value={fontSize} onChange={event => setFontSize(Number(event.target.value))} />{fontSize}</label>
      <p className="mt-4 max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed" style={{ fontSize }}>{pack.spoken}</p>
      <p className="mt-3 text-xs text-muted-foreground">来源：{pack.scriptSource?.task_type} · {pack.scriptSource?.created_at.slice(0, 10)}。可手动滑动阅读。</p>
    </div>}
    {pack.shots.length > 0 && <div className="space-y-2">
      <div className="flex items-center justify-between text-sm"><span>逐镜头清单</span><span className="text-xs text-muted-foreground">拍完 {completed.length}/{pack.shots.length}</span></div>
      <p className="text-xs text-muted-foreground">{storageNotice}</p>
      {pack.shots.map(shot => <div key={shot.id} className={`rounded-xl border p-3 ${completed.includes(shot.id) ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'}`}>
        <button type="button" onClick={() => toggle(shot.id)} aria-pressed={completed.includes(shot.id)} aria-label={`${completed.includes(shot.id) ? '取消拍完' : '标记拍完'}镜头${shot.number}`} className="flex min-h-10 w-full items-center gap-2 text-left text-sm">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${completed.includes(shot.id) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'}`}>{completed.includes(shot.id) && <Check className="h-3.5 w-3.5" />}</span>
          镜头 {shot.number}{shot.duration && <span className="text-xs text-muted-foreground">{shot.duration}</span>}
        </button>
        {shot.visual && <p className="mt-1 whitespace-pre-wrap text-sm">画面：{shot.visual}</p>}
        {shot.speech && <p className="mt-1 whitespace-pre-wrap text-sm text-primary">台词：{shot.speech}</p>}
        {(shot.framing || shot.movement || shot.notes) && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{[shot.framing, shot.movement, shot.notes].filter(Boolean).join(' · ')}</p>}
      </div>)}
    </div>}
    <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm">拍摄准备与标题封面</summary>
      <p className="mt-3 text-xs text-muted-foreground">准备项仅来自已保存内容，不代表设备、场地、出镜人或素材使用许可已经确认。</p>
      {pack.preparation.length ? <ul className="mt-2 space-y-1 text-sm">{pack.preparation.map(line => <li key={line}>· {line}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">尚无明确准备清单。</p>}
      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{pack.titleCover || '标题封面待生成。'}</pre>
    </details>
    {pack.storyboard && <details className="rounded-xl border border-border p-3"><summary className="cursor-pointer text-sm">查看分镜原文</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs">{pack.storyboard}</pre></details>}
  </section>;
}
