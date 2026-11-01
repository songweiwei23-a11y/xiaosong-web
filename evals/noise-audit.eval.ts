// 检测器准确率抽查（2026-11-01，整改方案阶段 0.2 的验收）：从一次评测的输出里随机抽 N 处「新出现的具体细节」，
// 每处带前后文，写成一份 markdown，逐条判断是真问题还是误报。
//
// 环境变量：NOISE_AUDIT=1、AUDIT_RUN（评测目录）、AUDIT_OUT（输出 md）、AUDIT_N（默认 50）
// 用法：npx vitest run --config vitest.eval.config.ts evals/noise-audit.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { extractConcrete } from '@/lib/noise-check';

it('抽查新出现的具体细节', () => {
  if (!process.env.NOISE_AUDIT) return;
  const run = process.env.AUDIT_RUN!;
  const out = process.env.AUDIT_OUT!;
  const n = Number(process.env.AUDIT_N ?? 50);
  const metricsFile = fs.existsSync(`${run}/metrics.v2.jsonl`) ? `${run}/metrics.v2.jsonl` : `${run}/metrics.jsonl`;
  const rows = fs.readFileSync(metricsFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

  // 每份输出里的每一处新细节，按输出里的位置找回前后文
  const candidates: { industry: string; node: string; text: string; context: string }[] = [];
  for (const r of rows) {
    const p = `${run}/${r.industry}/${r.node}.out.md`;
    if (!fs.existsSync(p) || !r.novelSamples?.length) continue;
    const body = fs.readFileSync(p, 'utf8');
    const spans = extractConcrete(body);
    for (const sample of r.novelSamples as string[]) {
      const s = spans.find((x) => x.text === sample);
      if (!s) continue;
      const a = Math.max(0, s.index - 40);
      const b = Math.min(body.length, s.index + s.text.length + 40);
      candidates.push({ industry: r.industry, node: r.node, text: s.text, context: body.slice(a, b).replace(/\s+/g, ' ') });
    }
  }
  // 固定种子的洗牌：同一次评测每次抽到的一样，方便复核
  let seed = 20261101;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const picked = candidates.map((c) => [rand(), c] as const).sort((x, y) => x[0] - y[0]).slice(0, n).map(([, c]) => c);

  const md = ['# 检测器准确率抽查', '', `- 评测：${run}`, `- 候选 ${candidates.length} 处，抽 ${picked.length} 处`, '- 判断：「真」= 输入里确实没有、是模型自己写的具体细节；「误报」= 其实不算具体细节，或输入里有只是写法不同', '', '| # | 档案 | 节点 | 细节 | 前后文 | 判断 |', '|---|---|---|---|---|---|'];
  picked.forEach((c, i) => md.push(`| ${i + 1} | ${c.industry} | ${c.node} | ${c.text} | ${c.context.replace(/\|/g, '｜')} |  |`));
  fs.writeFileSync(out, md.join('\n') + '\n', 'utf8');
  console.log(`written ${out}: ${picked.length} of ${candidates.length}`);
});
