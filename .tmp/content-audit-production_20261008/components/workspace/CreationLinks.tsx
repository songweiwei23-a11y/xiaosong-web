"use client";
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Star } from 'lucide-react';
import { notify } from '@/components/ui/feedback';
import { openCreation } from '@/lib/creation-session';
import { workIdFromUrl } from '@/lib/resume';
import { getActiveProfileId } from '@/lib/active-profile';
import { isNetworkError, NETWORK_ERROR_HINT } from '@/lib/api-error';
import { draftFromBody, draftFromItem, saveToLibrary } from '@/lib/library';
import { buildCreationHandoff, creationScript, CREATION_DESTINATIONS, CREATION_SOURCES, RECOMMENDED_NEXT, type CreationContext, type CreationTarget } from '@/lib/creation-flow';
import { itemsNoun, selectionBody, splitCreationItems } from '@/lib/creation-items';
import { selectedCreationContext } from '@/lib/creation-selection';

const NEXT_BY_NOUN: Record<string, CreationTarget[]> = {
  选题: ['script', 'growth', 'title'],
  方向思路: ['topic', 'script'],
  方案建议: ['script', 'storyboard', 'topic'],
  脚本: ['review', 'storyboard', 'title'],
  标题: ['script', 'review'],
  创作内容: ['topic', 'script'],
};
const GENERAL_SOURCES = new Set(['free-chat', 'knowledge', 'positioning', 'content-positioning', 'business-positioning', 'creative-brief', 'deal-reason']);

/**
 * 继续创作：把这份结果带去别的板块，自动填好。
 *
 * 结果里有两条以上并列的选题 / 方向 / 脚本 / 方案时（lib/creation-items），先勾要带走的几条，
 * 再点去哪个板块——只带勾中的（2026-10-02，产品方要求：任何板块的产出都能挑着接着做）。
 * 默认全选，不勾时和原来一样整份带走。
 */
export function CreationLinks({ body, context, heading = '继续创作 · 内容自动带入', allDestinations = false, embedded = false, recommended: recommendedProp, hideFavorite = false, favoriteBoard, singleDocument = false }: {
  body: string; context?: CreationContext; heading?: string; allDestinations?: boolean; embedded?: boolean;
  /** 指定推荐的下一步（素材库按分类给） */
  recommended?: CreationTarget[];
  /** 素材库里的素材本身就是收藏的，不再显示收藏按钮 */
  hideFavorite?: boolean;
  /** 内容原本来自哪个板块（素材库「全部产出」里收藏时用）：按它归类，不按当前页面 */
  favoriteBoard?: string;
  singleDocument?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [branch, setBranch] = useState(false);
  const [fav, setFav] = useState<'idle' | 'saving' | 'done'>('idle');
  const moreId = useId();
  const source = pathname?.split('/')[2] || '';
  // 审稿的总评、评分和问题清单是报告章节，不能当成几份脚本供选择。
  const parts = useMemo(() => singleDocument ? splitCreationItems('') : source === 'review' ? splitCreationItems(creationScript('review', body)) : splitCreationItems(body), [body, source, singleDocument]);
  const selectable = parts.items.length >= 2;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(parts.items.map((it) => it.id)));
  const noun = selectable ? itemsNoun(parts.items) : '';
  /*
   * 认出是选题/方向/方案/脚本时直接展开勾选列表；认不出类型的普通条目（报告小节、附件清单……）
   * 折成一行，想挑再点开——线上真实回答里这类占了一半，全展开太乱
   */
  const [pickOpen, setPickOpen] = useState(noun !== '内容');
  useEffect(() => { setPicked(new Set(parts.items.map((it) => it.id))); setPickOpen(!parts.items.length || itemsNoun(parts.items) !== '内容'); }, [parts]);
  // 换了内容、改了勾选，收藏状态重新来
  useEffect(() => setFav('idle'), [parts, picked, pickOpen]);
  if (!CREATION_SOURCES[source] || !body.trim()) return null;

  const allPicked = picked.size === parts.items.length;
  const toggle = (id: string) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  /*
   * 自由对话、知识库、账号运营几个板块什么都可能出：按勾选列表认出的是什么来推荐下一步
   * （账号定位里勾了几条方向思路 → 推荐出选题、写脚本）。专门的创作板块推荐是固定的
   */
  const recommended = recommendedProp || (GENERAL_SOURCES.has(source) && pickOpen && NEXT_BY_NOUN[noun]) || RECOMMENDED_NEXT[source] || ['topic', 'script'];

  /*
   * 收藏到素材库（2026-10-02）。勾选列表展开着就一条一条存（一批 5 个选题 → 素材库里 5 条选题，能单独取用）；
   * 整份内容、或者折叠着的普通条目存成一条——一份定位报告不该被拆成十几块。
   */
  const pickMode = selectable && pickOpen;
  const partialEdit = source === 'title' ? source : source === 'growth' && context?.topic ? source
    : context?.settings?.workingScript && parts.items.length && parts.items.every(it => it.kind === 'title')
      ? parts.items.every(it => /开头|开篇|钩子/.test(it.label)) ? 'growth' : 'title' : undefined;
  const favorite = async () => {
    if (fav !== 'idle') return;
    const label = context?.from || CREATION_SOURCES[source];
    const board = favoriteBoard || source;
    const drafts = pickMode
      ? parts.items.filter((it) => picked.has(it.id)).map((it) => draftFromItem(it, board, label))
      : [draftFromBody(body, board, label, context?.title)];
    if (!drafts.length) { notify(`先勾选要收藏的${noun}`, 'error'); return; }
    setFav('saving');
    try {
      const r = await saveToLibrary(drafts.map(draft => ({ ...draft, creationContext: pickMode ? selectedCreationContext(context, draft.content, draft.title, [], partialEdit) : context })), getActiveProfileId());
      setFav('done');
      notify(r.saved ? `已收藏 ${r.saved} 条到素材库${r.duplicated ? `（另有 ${r.duplicated} 条之前就收藏过）` : ''}` : '这些内容之前就收藏过了');
    } catch (e) {
      setFav('idle');
      notify(isNetworkError(e) ? NETWORK_ERROR_HINT : (e as Error).message, 'error');
    }
  };
  const favLabel = fav === 'done' ? '已收藏' : fav === 'saving' ? '收藏中…' : pickMode && !allPicked ? `收藏勾中的 ${picked.size} 条` : pickMode ? `收藏这 ${parts.items.length} 条` : '收藏到素材库';
  const choices = CREATION_DESTINATIONS.filter(item => item.id !== source);
  const go = async (target: CreationTarget) => {
    if (continuing) return;
    let sendBody = body;
    let ctx = context;
    if (selectable && !allPicked) {
      if (picked.size === 0) { notify(`先勾选要带走的${noun}`, 'error'); return; }
      const s = selectionBody(parts, picked);
      sendBody = s.body;
      ctx = selectedCreationContext(context, s.body, s.title, s.topicOptions, partialEdit);
    } else if (selectable) {
      // 全选：整份带走，但勾选列表里认出的题目照样交给下一页当候选
      const topics = parts.items.map((it) => it.topic).filter((t): t is string => Boolean(t));
      if (topics.length) ctx = { ...context, topicOptions: context?.topicOptions?.length ? context.topicOptions : topics };
    }
    const payload = buildCreationHandoff(source, target, sendBody, { ...ctx, workId: ctx?.workId || workIdFromUrl() || undefined });
    setContinuing(true);
    // 保存完整创作需求再跳（lib/creation-session）；重试沿用同一个请求编号
    try { await openCreation(payload, (url) => router.push(url), branch || ctx?.branch === true); }
    catch (e) { notify((e as Error).message || '创作需求未保存，请重试', 'error'); setContinuing(false); }
  };
  const primary = choices.filter(item => recommended.includes(item.id));
  const more = choices.filter(item => !recommended.includes(item.id));
  const buttonClass = 'glass-panel glass-interactive flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-medium text-foreground';
  const button = (item: typeof choices[number]) => <button key={item.id} type="button" disabled={continuing} onClick={() => go(item.id)} className={`${buttonClass} disabled:opacity-50`}><span className="whitespace-nowrap">{item.label}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" /></button>;
  return <div className={embedded ? '' : 'glass-panel rounded-xl p-4'}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[12px] font-medium text-muted-foreground">{heading}</p>
      {!hideFavorite && <button type="button" onClick={favorite} disabled={fav !== 'idle'} aria-label="收藏到素材库" className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] ${fav === 'done' ? 'text-amber-500' : 'text-primary hover:bg-primary/10'}`}>
        <Star className={`h-3.5 w-3.5 ${fav === 'done' ? 'fill-current' : ''}`} />{favLabel}
      </button>}
    </div>
    {selectable && !pickOpen && <button type="button" onClick={() => setPickOpen(true)} className="mb-3 flex items-center gap-1 text-[12px] text-primary">这份结果里有 {parts.items.length} 条，只带其中几条？<ChevronDown className="h-3.5 w-3.5" /></button>}
    {selectable && pickOpen && <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] text-foreground">勾选要带走的{noun}<span className="ml-1.5 text-muted-foreground">已选 {picked.size}/{parts.items.length}</span></p>
        <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(parts.items.map((it) => it.id)))} className="text-[12px] text-primary">{allPicked ? '全不选' : '全选'}</button>
      </div>
      <div className="space-y-1.5" role="group" aria-label={`选择要带走的${noun}`}>
        {parts.items.map((it, i) => {
          const on = picked.has(it.id);
          return <button key={it.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(it.id)} className={`glass-interactive flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left ${on ? 'glass-selected' : 'glass-panel'}`}>
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{on && <Check className="h-3 w-3" />}</span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium leading-5 text-foreground">{i + 1}. {it.topic || it.label}</span>
              {it.topic && it.label !== it.topic && <span className="block truncate text-[11px] text-muted-foreground">{it.label}</span>}
            </span>
          </button>;
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-muted-foreground">再点下面的板块：{allPicked ? '整份带过去' : `只带勾中的 ${picked.size} 条`}，自动填好，点生成就行</p>
    </div>}
    {(context?.workId || workIdFromUrl()) && <label className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground"><input type="checkbox" checked={branch} onChange={e => setBranch(e.target.checked)} />另存为新作品，保留当前作品</label>}
    {continuing && <p role="status" className="mb-2 text-[12px] text-primary">正在保存完整创作需求…</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(allDestinations ? [...primary, ...more] : primary).map(button)}
      {!allDestinations && more.length > 0 && <button type="button" aria-expanded={expanded} aria-controls={moreId} onClick={() => setExpanded(!expanded)} className={`${buttonClass} text-primary`}><span>{expanded ? '收起板块' : '更多板块'}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>}
    </div>
    {!allDestinations && expanded && <div id={moreId} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{more.map(button)}</div>}
  </div>;
}
