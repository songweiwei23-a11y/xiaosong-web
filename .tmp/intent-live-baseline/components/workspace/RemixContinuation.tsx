"use client";

import { useEffect, useState } from 'react';
import { CreationLinks } from './CreationLinks';
import type { CreationContext } from '@/lib/creation-flow';
import type { RemixPlan } from '@/lib/remix-plans';

/** 读完方案后，在底部先选方案，再选下一步。 */
export function RemixContinuation({ body, plans, context }: { body: string; plans: RemixPlan[]; context?: CreationContext }) {
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => setSelectedId(''), [body]);
  const selected = plans.find(plan => plan.id === selectedId);
  const selectedBody = selectedId === 'all' ? body : selected?.body;
  const selectedTitle = selectedId === 'all' ? '全部方案' : selected?.title;

  return <section id="remix-continuation" aria-label="选择二创方案继续创作" className="glass-panel rounded-2xl p-4 sm:p-5">
    <h3 className="text-[15px] font-semibold text-foreground">继续创作</h3>
    <p className="mb-3 mt-3 text-[12px] font-medium text-muted-foreground">1. 选择要继续创作的方案</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="选择方案">
      {plans.map((plan, i) => <button key={plan.id} type="button" aria-pressed={selectedId === plan.id} onClick={() => setSelectedId(plan.id)} className={`glass-interactive h-9 rounded-xl border px-4 text-[13px] font-medium ${selectedId === plan.id ? 'glass-selected text-primary' : 'glass-panel text-foreground'}`}>方案 {i + 1}</button>)}
      {plans.length > 1 && <button type="button" aria-pressed={selectedId === 'all'} onClick={() => setSelectedId('all')} className={`glass-interactive h-9 rounded-xl border px-4 text-[13px] font-medium ${selectedId === 'all' ? 'glass-selected text-primary' : 'glass-panel text-muted-foreground'}`}>全部方案</button>}
    </div>
    {selectedBody ? <div className="mt-4 border-t border-border/60 pt-4">
      <p className="mb-3 break-words text-[12px] leading-5 text-foreground" aria-live="polite">已选：{selectedTitle}</p>
      <CreationLinks body={selectedBody} context={{ ...context, title: selectedTitle }} heading="2. 选择下一步 · 内容会自动带入" allDestinations embedded />
    </div> : <p className="mt-4 text-[12px] text-muted-foreground">选好方案后，再选择审稿、分镜、选题等创作去向。</p>}
  </section>;
}
