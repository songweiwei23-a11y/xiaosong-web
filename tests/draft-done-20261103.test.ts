/**
 * 正文写完就停转圈（2026-11-03 产品方选 A）：服务端写完正文先发 draft_done，按钮停转；
 * 核对、修正、标题润色、保存照常做完，期间结果下面一行小字，做完自动更新。
 */
import { describe, expect, it } from 'vitest';
import { readDifyStream, FINISHING_NOTE } from '@/lib/sse-stream';
import { readCode } from './helpers/source';

function sse(events: Record<string, unknown>[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(body)); c.close(); },
  }));
}

describe('readDifyStream：draft_done', () => {
  it('写完正文时回调一次，之后照样读到核对后的整篇替换，读到结束才返回', async () => {
    const seen: string[] = [];
    const full = await readDifyStream(sse([
      { answer: '方向一', conversation_id: 'c', message_id: 'm' },
      { answer: '，方向二' },
      { event: 'draft_done' },
      { event: 'message_replace', answer: '方向一，方向二（已核对）' },
      { event: 'message_end', conversation_id: 'c', message_id: 'm' },
    ]), {
      onDraftDone: (draft) => seen.push(`draft:${draft}`),
      onChunk: (_p, all) => seen.push(`chunk:${all}`),
    });
    expect(seen).toContain('draft:方向一，方向二');
    expect(seen.indexOf('draft:方向一，方向二')).toBeLessThan(seen.indexOf('chunk:方向一，方向二（已核对）'));
    expect(full).toBe('方向一，方向二（已核对）');
  });

  it('没有 draft_done（老接口、审稿类）就不回调，行为和原来一样', async () => {
    let called = false;
    const full = await readDifyStream(sse([{ answer: '稿子', conversation_id: 'c', message_id: 'm' }, { event: 'message_end' }]), { onDraftDone: () => { called = true; } });
    expect(called).toBe(false);
    expect(full).toBe('稿子');
  });
});

describe('服务端：正文写完先发 draft_done，核对一道不少', () => {
  const route = readCode('app/api/dify/stream/route.ts');
  it('在主生成结束、核对开始之前发；要校对通过才算数的任务不发', () => {
    const at = route.indexOf("send({ event: 'draft_done' })");
    expect(at).toBeGreaterThan(route.indexOf("stages.push({ stage: 'generate'"));
    expect(at).toBeLessThan(route.indexOf("traced('review_verify'"));
    expect(at).toBeLessThan(route.indexOf("traced('detail_check'"));
    expect(route).toMatch(/if \(outcome\.kind === 'done' && !needsCheck && fullResponse\.trim\(\)\) send\(\{ event: 'draft_done' \}\)/);
  });
  it('核对、修正、结束标记都还在', () => {
    for (const s of ["traced('detail_check'", "traced('fact_fix'", 'repairYears(', 'repairReality(', "event: 'message_end'"]) expect(route).toContain(s);
  });
});

describe('页面：按钮停转、小字提示、润色和保存不动', () => {
  it('结果面板：finishing 时显示小字；体检和自动修正等最终版', () => {
    const panel = readCode('components/workspace/ResultPanel.tsx');
    expect(panel).toMatch(/const pending = isGenerating \|\| !!finishing/);
    expect(panel).toMatch(/!isGenerating && finishing && \(/);
    expect(panel).toMatch(/body && !pending && \(\s*<FactCheckNotice/);
    expect(FINISHING_NOTE).toMatch(/正在核对/);
  });

  const PAGES = ['direction', 'content-plan', 'remix', 'topic', 'title', 'knowledge', 'script', 'storyboard', 'industry-advice', 'creative-brief', 'deal-reason', 'positioning', 'growth', 'breakdown'];
  it.each(PAGES)('%s：接上了停转和小字，finally 里清掉，核对中再点会拦下', (p) => {
    const page = readCode(`app/dashboard/${p}/page.tsx`);
    expect(page).toMatch(/const \[finishing, setFinishing\] = useState\((""|'')\)/);
    expect(page).toMatch(/setFinishing\(FINISHING_NOTE\)/);
    expect(page).toMatch(/setFinishing\((""|'')\)/);
    expect(page).toMatch(/if \(finishing\) \{/);
  });

  it('润色和保存仍然是原来的 await 写法（不挪后台、不加超时）', () => {
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/await polishTitlesRemote\(accumulatedText\)/);
    expect(readCode('lib/title-polish.ts')).not.toMatch(/AbortSignal\.timeout/);
    for (const p of ['content-plan', 'remix']) expect(readCode(`app/dashboard/${p}/page.tsx`)).toMatch(/await saveCreativeHistory\(/);
  });

  it('创作方向：写完停转、显示小字；润色和保存照旧 await', () => {
    const page = readCode('app/dashboard/direction/page.tsx');
    expect(page).toMatch(/onDraftDone: \(\) => \{ if \(isCurrent\(\)\) \{ setRunning\(false\); setFinishing\(FINISHING_NOTE\); \} \}/);
    expect(page).toMatch(/finishing=\{finishing\}/);
    expect(page).toMatch(/setRunning\(false\);\s*setFinishing\(""\);/);
    expect(page).toMatch(/const polished = await polishTitlesRemote\(full\);/);
    expect(page).toMatch(/await saveCreativeHistory\(/);
  });
});
