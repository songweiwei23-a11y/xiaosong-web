// 打磨探针（2026-11-01）：对一份已有初稿单独跑一次体检，把模型原话存下来，查体检为什么解析不出来。
// 环境变量：POLISH_PROBE=1、PROBE_DIR（如 evals/runs/sp-new/D）、PROBE_NODE（默认 10-脚本）
// 用法：npx vitest run --config vitest.eval.config.ts evals/polish-probe.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { buildScriptReviewPrompt, localScriptIssues, parseReviewIssues, polishContextFromPrompt } from '@/lib/script-polish';

const ROOT = 'E:/小宋/腾讯云生产版同步_20260918';
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

it('体检探针', { timeout: 600_000 }, async () => {
  if (!process.env.POLISH_PROBE) return;
  const dir = `${ROOT}/${process.env.PROBE_DIR}`;
  const node = process.env.PROBE_NODE ?? '10-脚本';
  const prompt = fs.readFileSync(`${dir}/${node}.prompt.txt`, 'utf8');
  const draft = fs.readFileSync(`${dir}/${node}.raw.md`, 'utf8');
  const ctx = polishContextFromPrompt(prompt);
  const review = buildScriptReviewPrompt(draft, ctx, localScriptIssues(draft, ctx, prompt).issues);
  const r = await askDify(review, 'polish-probe', '');
  fs.writeFileSync(`${dir}/${node}.probe-review.txt`, r.ok ? r.text : `失败：${r.message}`, 'utf8');
  console.log('ok', r.ok, r.ok ? `长度 ${r.text.length}，解析 ${JSON.stringify(parseReviewIssues(r.text))?.slice(0, 200)}` : r.message, '体检提示词字数', review.length);
});
