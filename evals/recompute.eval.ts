// 重算指标（2026-11-01）：检测器或素材口径改了以后，用当前的 lib/noise-check 和 evals/materials 把一次评测的输出重算一遍，
// 写成 metrics.v2.jsonl（原来的 metrics.jsonl 不动）。上游没在本次评测里重跑的（第二次采样），从 RECOMPUTE_UPSTREAM 读。
//
// 环境变量：RECOMPUTE=1、RECOMPUTE_RUN（评测目录）、RECOMPUTE_UPSTREAM（可选）
// 用法：npx vitest run --config vitest.eval.config.ts evals/recompute.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { mixPromptBlock, resolveMix } from '@/lib/content-mix';
import { noiseReport } from '@/lib/noise-check';
import { EVAL_INDUSTRIES, decoyHits } from './fixtures/profiles';
import { nodeMaterials, topicLineOf } from './materials';

it('重算指标', () => {
  if (!process.env.RECOMPUTE) return;
  const run = process.env.RECOMPUTE_RUN!;
  const upstream = process.env.RECOMPUTE_UPSTREAM ?? '';
  const read = (code: string, node: string): string | null => {
    for (const dir of [run, upstream]) {
      const p = `${dir}/${code}/${node}.out.md`;
      if (dir && fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
    return null;
  };
  // 耗时从 meta.jsonl 取（重算不改耗时）
  const ms = new Map<string, number>();
  if (fs.existsSync(`${run}/meta.jsonl`)) {
    for (const line of fs.readFileSync(`${run}/meta.jsonl`, 'utf8').split('\n').filter(Boolean)) {
      const m = JSON.parse(line);
      if (m.ok) ms.set(`${m.industry}/${m.node}`, m.ms);
    }
  }
  // 「今天」按这份输出实际生成的那天算（文件的修改时间），不按重算的这天：10-31 跑的规划写「10月」不算新细节
  const dayOf = (file: string) => {
    const d = fs.statSync(file).mtime;
    return `今天是${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const rows: string[] = [];
  for (const code of fs.readdirSync(run).filter((d) => fs.statSync(`${run}/${d}`).isDirectory())) {
    const ind = EVAL_INDUSTRIES.find((x) => x.code === code);
    if (!ind) continue;
    const summary = buildProfileSummary(ind.profile as never);
    const mix = resolveMix(ind.profile, null, '');
    const T = read(code, '09-选题');
    const ctx = {
      summary, mixBlock: mixPromptBlock(mix), mixBlockCount: mixPromptBlock(mix, { count: 6 }),
      P: read(code, '01-账号定位'), B: read(code, '02-商业定位'), C: read(code, '03-内容定位'), CP: read(code, '07-内容规划'),
      DR: read(code, '08-创作方向'), T, S: read(code, '10-脚本'), topicLine: topicLineOf(T, ind.topicPreset),
      storeText: `${ind.store.name} ${ind.store.type} ${ind.store.features} ${ind.store.customer}`,
      viralSample: ind.viralSample, benchmarkSample: ind.benchmarkSample, interviewNotes: ind.interviewNotes,
      adviceInput: '刚开始发，还没有数据 先让同城的人看到',
    };
    for (const file of fs.readdirSync(`${run}/${code}`).filter((f) => f.endsWith('.out.md')).sort()) {
      const node = file.replace('.out.md', '');
      const text = fs.readFileSync(`${run}/${code}/${file}`, 'utf8');
      const r = noiseReport(text, [...nodeMaterials(node, ctx), dayOf(`${run}/${code}/${file}`)]);
      rows.push(JSON.stringify({
        industry: code, shape: ind.shape, node, chars: text.length, ms: ms.get(`${code}/${node}`) ?? 0,
        novel: r.novel.length, novelByKind: r.byKind, novelSamples: r.novel.slice(0, 12).map((s) => s.text),
        decoys: decoyHits(text, ind.decoys), placeholders: (text.match(/【待确认/g) || []).length,
      }));
    }
  }
  fs.writeFileSync(`${run}/metrics.v2.jsonl`, rows.join('\n') + '\n', 'utf8');
  console.log(`recomputed ${rows.length} rows → ${run}/metrics.v2.jsonl`);
});
