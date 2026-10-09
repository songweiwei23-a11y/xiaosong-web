'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Download, Loader2, Paperclip, PencilLine, Plus, X } from 'lucide-react';
import { Markdown } from '@/components/markdown';
import { CreationLinks } from '@/components/workspace/CreationLinks';
import { ResultCanvas } from '@/components/chat/ResultCanvas';
import { AttachmentList } from '@/components/chat/ChatAttachments';
import { DEPTHS, readPlan, type ResearchDepth, type ResearchPlan, type ResearchStatus, type ResearchStep } from '@/lib/research';
import type { ChatAttachment } from '@/lib/chat-attachments';
import type { CanvasVersion } from '@/lib/canvas';
import { createHistoryId } from '@/lib/history-id';
import { downloadDocx, printPdf } from '@/lib/doc-export';
import { postSafely } from '@/lib/safe-post';

interface Job {
  id: string; topic: string; depth: ResearchDepth; status: ResearchStatus; plan?: ResearchPlan;
  steps?: ResearchStep[]; report?: string; context?: string; error?: string; progress?: string;
  retry_count?: number; summary_failed?: boolean; canvas_versions?: CanvasVersion[];
}
const active = (j: Job | null) => !!j && ['planning', 'running', 'writing'].includes(j.status);
const labels = { pending: '等待中', searching: '搜索中', reading: '读取网页', writing: '整理本节', done: '已完成', failed: '需补跑' };
const box = 'mt-1 w-full rounded-lg border bg-background p-2 text-sm text-foreground';
async function jsonResponse(r: Response) {
  const d = await r.json(); if (!r.ok) throw new Error(d.error || '暂时无法完成，请重试'); return d;
}
export function ResearchPanel({ profileId, profileContext, files, uploading, onPickFiles, onRemoveFile, onClose }: {
  profileId: string | null; profileContext: string; files: ChatAttachment[]; uploading: boolean; onPickFiles: () => void; onRemoveFile: (file:ChatAttachment) => void; onClose: () => void;
}) {
  const [topic, setTopic] = useState(''), [material, setMaterial] = useState(''), [depth, setDepth] = useState<ResearchDepth>('standard');
  const [quota, setQuota] = useState<{ remaining: number; pending: number; limit: number } | null>(null);
  const [searchReady, setSearchReady] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [job, setJob] = useState<Job | null>(null), [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [history, setHistory] = useState<Job[]>([]), [hasMore, setHasMore] = useState(false), [busy, setBusy] = useState(false), [canvasOpen, setCanvasOpen] = useState(false);
  const request = useRef<{ payload: string; id: string } | null>(null), actionBusy = useRef(false);
  const selection = useRef(0);
  const jobId = job?.id, jobStatus = job?.status;
  const scope = `profileId=${encodeURIComponent(profileId || 'default')}`;
  const refreshQuota = useCallback(async () => {
    const d = await jsonResponse(await fetch('/api/research', { cache: 'no-store' }));
    setQuota(d.quota); setSearchReady(d.searchReady); setMessage(d.message || '');
  }, []);
  const loadHistory = useCallback(async (offset = 0) => {
    const d = await jsonResponse(await fetch(`/api/research?list=1&${scope}&offset=${offset}`, { cache: 'no-store' }));
    setHistory(h => offset ? [...h, ...d.items] : d.items); setHasMore(d.hasMore); return d.items as Job[];
  }, [scope]);
  const selectJob = useCallback(async (id: string) => {
    const current = ++selection.current;
    const d = await jsonResponse(await fetch(`/api/research?id=${id}&${scope}`, { cache: 'no-store' }));
    if (current !== selection.current) return;
    setJob(d); setPlan(d.plan || null); setError('');
  }, [scope]);
  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        await refreshQuota(); const items = await loadHistory();
        if (!canceled && selection.current === 0 && items[0]) await selectJob(items[0].id);
      } catch (e) { if (!canceled) setError((e as Error).message); }
    })();
    return () => { canceled = true; };
  }, [loadHistory, refreshQuota, selectJob]);
  useEffect(() => {
    if (!jobId || !jobStatus || !['planning', 'running', 'writing'].includes(jobStatus)) return;
    let canceled = false; const abort = new AbortController();
    const poll = async () => {
      try {
        const d = await jsonResponse(await fetch(`/api/research?id=${jobId}&${scope}`, { cache: 'no-store', signal: abort.signal }));
        if (canceled) return;
        setJob(d); if (d.plan) setPlan(d.plan);
        if (!active(d)) { await refreshQuota(); await loadHistory(); }
      } catch (e) { if (!canceled) setError((e as Error).message); }
    };
    const timer = setInterval(() => { void poll(); }, 4000);
    return () => { canceled = true; abort.abort(); clearInterval(timer); };
  }, [jobId, jobStatus, scope, refreshQuota, loadHistory]);
  const create = async () => {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError('');
    const payload = { topic: topic.trim(), depth, material, profileId, profileContext, files }, encoded = JSON.stringify(payload);
    if (!request.current || request.current.payload !== encoded) request.current = { payload: encoded, id: createHistoryId() };
    try {
      const d = await jsonResponse(await postSafely('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId: request.current.id }) }));
      await selectJob(d.id); await refreshQuota(); await loadHistory(); request.current = null;
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); actionBusy.current = false; }
  };
  const patch = async (action: string) => {
    if (!job || actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError('');
    try {
      await jsonResponse(await postSafely('/api/research', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, action, plan }) }));
      await selectJob(job.id); await refreshQuota(); await loadHistory();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); actionBusy.current = false; }
  };
  const versions = job?.canvas_versions?.length ? job.canvas_versions : job?.report ? [{ content: job.report, at: 0, note: '原研究报告' }] : [];
  const view = versions.at(-1)?.content || '';
  const saveVersions = async (v: CanvasVersion[]) => {
    if (!job) return false;
    try {
      await jsonResponse(await postSafely('/api/research', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, action: 'save_versions', versions: v }) }));
      setJob(j => j ? { ...j, canvas_versions: v } : j); return true;
    } catch (e) { setError((e as Error).message); return false; }
  };
  const edit = (i: number, field: 'q' | 'queries', value: string) => setPlan(p => p ? { ...p, questions: p.questions.map((q, n) => n === i ? { ...q, [field]: field === 'q' ? value : value.split('\n').map(x => x.trim()).filter(Boolean) } : q) } : p);
  return <div role="dialog" aria-modal="true" aria-label="深度研究报告" className="fixed inset-0 z-40 flex flex-col bg-background sm:inset-5 sm:rounded-2xl sm:border sm:shadow-2xl">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
      <div><h2 className="flex items-center gap-2 font-semibold"><BookOpen className="h-5 w-5 text-primary" />深度研究报告</h2><p className="mt-1 text-xs text-muted-foreground">确认问题 → 逐题搜索、读取网页 → 带来源的报告</p></div>
      <button aria-label="关闭深度研究" onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button onClick={() => { selection.current++; setJob(null); setPlan(null); setError(''); }} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"><Plus className="h-4 w-4" />新研究</button>
        <select aria-label="研究历史" value={job?.id || ''} onChange={e => { if (e.target.value) void selectJob(e.target.value).catch(e => setError(e.message)); }} className="min-w-0 max-w-full rounded-lg border bg-card p-2"><option value="">当前档案的研究历史</option>{history.map(h => <option key={h.id} value={h.id}>{h.topic} · {h.status === 'done' ? '已完成' : h.status === 'plan_ready' ? '待确认' : h.status === 'failed' ? '需重试' : h.status === 'canceled' ? '已停止' : '进行中'}</option>)}</select>
        {hasMore && <button onClick={() => void loadHistory(history.length).catch(e => setError(e.message))} className="text-xs text-primary">加载更早历史</button>}
        {quota && <span className="text-xs text-muted-foreground">本期剩余 {quota.remaining}/{quota.limit} 份 · 占位 {quota.pending} 份</span>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">{error}</p>}
      {message && !job && <p className="rounded-lg bg-muted p-3 text-sm">{message}{quota?.limit === 0 && <Link href="/pricing" className="ml-2 text-primary">查看会员</Link>}</p>}
      {!job && <section className="space-y-4 rounded-xl border bg-card p-4">
        <label className="block text-sm font-medium">研究什么？<textarea maxLength={500} value={topic} onChange={e => setTopic(e.target.value)} placeholder="例如：本地家具门店怎样做短视频？研究消费者需求、同行做法和可执行策略。" rows={3} className={box} /></label>
        <div className="grid gap-2 sm:grid-cols-3">{(Object.keys(DEPTHS) as ResearchDepth[]).map(d => <button key={d} onClick={() => setDepth(d)} aria-pressed={depth === d} className={`rounded-lg border p-3 text-left text-sm ${depth === d ? 'border-primary bg-primary/5' : ''}`}><strong>{DEPTHS[d].label}</strong><span className="mt-1 block text-xs text-muted-foreground">{DEPTHS[d].desc}</span></button>)}</div>
        <label className="block text-sm">你的背景或已有资料（选填）<textarea value={material} maxLength={8000} onChange={e => setMaterial(e.target.value)} rows={3} className={box} placeholder="你想解决什么问题？当前档案和上传附件会随计划带入。" /></label>
        <div className="space-y-2 text-xs"><button onClick={onPickFiles} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2"><Paperclip className="h-4 w-4" />{uploading ? '正在上传' : '添加资料'}</button><AttachmentList files={files} onRemove={onRemoveFile} /></div>
        <p className="text-xs text-muted-foreground">拟计划先占位，确认前不扣已用次数；首次成功搜索计1份，包含本份报告的多轮搜索，不扣普通联网和对话次数。补跑最多3次。</p>
        {!searchReady && <p className="text-xs text-amber-500">管理员尚未配置深度研究联网搜索。</p>}
        <button onClick={() => void create()} disabled={busy || uploading || topic.trim().length < 4 || !searchReady || !quota?.remaining} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}拟定研究计划</button>
      </section>}
      {job && <>
        <h3 className="text-lg font-semibold">{job.plan?.title || job.topic}</h3>
        <p className="text-sm text-muted-foreground">{job.progress}{active(job) ? ' · 关闭页面仍会继续，回来可在历史中查看。' : ''}</p>
        {job.status === 'plan_ready' && plan && <section className="space-y-3 rounded-xl border bg-card p-4">
          <label className="block text-sm">报告标题<input value={plan.title} onChange={e => setPlan({ ...plan, title: e.target.value })} className={box} /></label>
          {plan.questions.map((q, i) => <div key={i} className="space-y-2 rounded-lg border p-3"><label className="block text-xs text-muted-foreground">子问题 {i + 1}<input aria-label={`子问题${i + 1}`} value={q.q} onChange={e => edit(i, 'q', e.target.value)} className={box} /></label><label className="block text-xs text-muted-foreground">搜索词（每行一个）<textarea aria-label={`搜索词${i + 1}`} value={q.queries.join('\n')} onChange={e => edit(i, 'queries', e.target.value)} rows={2} className={box} /></label><button onClick={() => setPlan({ ...plan, questions: plan.questions.filter((_, n) => n !== i) })} disabled={plan.questions.length <= 1} className="text-xs text-muted-foreground disabled:opacity-30">移除此问题</button></div>)}
          {plan.questions.length < DEPTHS[job.depth].questions[1] && <button onClick={() => setPlan({ ...plan, questions: [...plan.questions, { q: '', queries: [] }] })} className="text-sm text-primary">＋增加子问题</button>}
          <button onClick={() => void patch('start')} disabled={busy || !readPlan(plan, job.depth) || plan.questions.some(q => !q.q.trim())} className="ml-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">确认并开始研究</button>
        </section>}
        {!!job.steps?.length && <ol className="grid gap-2 sm:grid-cols-2">{job.steps.map((s, i) => <li key={i} className="rounded-lg border p-3 text-sm"><span className="text-primary">{labels[s.status]} · </span>{job.plan?.questions[i]?.q}<span className="mt-1 block text-xs text-muted-foreground">已读取 {s.read || 0} 个来源{s.error ? ` · ${s.error}` : ''}</span></li>)}</ol>}
        {job.error && <p className="text-sm text-amber-500">{job.error}</p>}
        {['planning', 'plan_ready', 'running', 'writing'].includes(job.status) && <button onClick={() => void patch('cancel')} disabled={busy} className="rounded-lg border px-3 py-2 text-sm">停止这个研究</button>}
        {['failed', 'canceled', 'done'].includes(job.status) && job.plan && (job.status !== 'done' || job.summary_failed || job.steps?.some(s => s.status !== 'done')) && <button onClick={() => void patch('retry')} disabled={busy || (job.retry_count || 0) >= 3} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">补跑未完成部分（已补跑 {job.retry_count || 0}/3 次）</button>}
        {view && <section className="space-y-4">
          <div className="flex flex-wrap gap-2"><button onClick={() => setCanvasOpen(true)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><PencilLine className="h-4 w-4" />在画布里改</button><button onClick={() => void downloadDocx(view).catch(e => setError(e.message))} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><Download className="h-4 w-4" />下载 Word</button><button onClick={() => printPdf(view)} className="rounded-lg border px-3 py-2 text-xs">打印 / 保存 PDF</button></div>
          {versions.length > 1 && <p className="text-xs text-muted-foreground">显示画布编辑稿；引用检查针对原研究报告，修改后请重新核对来源。</p>}
          <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-6"><Markdown>{view}</Markdown></div>
          <CreationLinks body={view} singleDocument allDestinations context={{ from: '深度研究报告', title: job.plan?.title, originContent: `${job.topic}\n${job.context || ''}\n${job.report || ''}` }} />
        </section>}
      </>}
    </div></div>
    {canvasOpen && versions.length > 0 && <ResultCanvas versions={versions} onChange={saveVersions} onClose={() => setCanvasOpen(false)} profileId={profileId} profileContext={profileContext} draftKey={`research:${job?.id}`} creationContext={{ from: '深度研究报告', originContent: job?.report }} />}
  </div>;
}
