// 知识库具体细节有没有漏进生成结果（2026-11-01，整改方案 2.3 → 2.4 之前）：
// 把知识库备份里每处具体细节连同后面几个字（「5万精准粉丝」「凌晨四点我来到」）当探针，到评测存下的全部输出里找原样出现的。
// 找得到，说明模型把知识库示例当成本次事实写了；找不到，这一行就没必要冒险改写。只读、不调模型。
//
// 环境变量：KB_LEAK=1、KB_DIR（知识库备份目录）、RUNS_DIR（评测输出根目录）、KB_LEAK_OUT（结果 md）
// 用法：npx vitest run --config vitest.eval.config.ts evals/kb-leak-check.eval.ts
import fs from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import { extractConcrete } from '@/lib/noise-check';

function walk(dir: string, ext: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), ext) : ext.test(e.name) ? [path.join(dir, e.name)] : []));
}

it('知识库细节漏进输出', () => {
  if (!process.env.KB_LEAK) return;
  const kbDir = process.env.KB_DIR!;
  const runs = process.env.RUNS_DIR!;
  // 只看模型输出，不看提示词（提示词里本来就可能带着召回的原文）；评估器的判定也不算
  const outputs = walk(runs, /\.out\.md$/).filter((f) => !/kb-backup|judge-/.test(f));
  const corpus = outputs.map((f) => ({ f: path.relative(runs, f), t: fs.readFileSync(f, 'utf8') }));
  const probes: { lib: string; doc: string; probe: string; line: string }[] = [];
  for (const file of walk(kbDir, /\.md$/)) {
    const lib = path.relative(kbDir, file).split(path.sep)[0];
    const doc = path.basename(file, '.md');
    for (const line of fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '').split('\n')) {
      for (const s of extractConcrete(line)) {
        // 细节加上后面紧跟的几个字才算探针：光一个「3万」到处都有
        const probe = line.slice(s.index, s.index + s.text.length + 4).replace(/[，。,.、；;：:！!？?\s].*$/, '');
        if (probe.length >= 5 && probe.length > s.text.length) probes.push({ lib, doc, probe, line: line.trim().slice(0, 120) });
      }
    }
  }
  const hits = probes.map((p) => ({ ...p, where: corpus.filter((c) => c.t.includes(p.probe)).map((c) => c.f) })).filter((p) => p.where.length);
  const md = ['# 知识库具体细节漏进生成结果的检查（2026-11-01）', '',
    `探针 ${probes.length} 个（知识库每处具体细节连同后面几个字），在 ${corpus.length} 份评测输出里原样出现的 ${hits.length} 个。`, '',
    ...(hits.length ? ['| 库 / 文档 | 探针 | 出现在 | 知识库原句 |', '|---|---|---|---|', ...hits.map((h) => `| ${h.lib} / ${h.doc} | ${h.probe} | ${h.where.length} 份（${h.where.slice(0, 3).join('、')}） | ${h.line} |`)] : ['一个都没有。']), ''].join('\n');
  fs.writeFileSync(process.env.KB_LEAK_OUT!, md, 'utf8');
  console.log(`probes=${probes.length} outputs=${corpus.length} hits=${hits.length}`);
});
