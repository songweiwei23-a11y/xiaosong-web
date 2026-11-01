// 新旧对照重发（2026-11-01，整改方案原则 1「先测后改」）：模型表现随时段变，存档的基线不能当对照组，
// 新旧两版要在同一时段交替跑。做法：
//   1. 旧代码下用 chain-eval 的 EVAL_DRY=1 构造提示词到目录 A，改完代码再构造到目录 B（提示词、检索词都存下来）；
//   2. 这里把 A、B 的提示词按 A1、B1、A2、B2…交替发出去，输出写回各自目录（文件名和 chain-eval 一样，下游节点、评估器直接能用）。
//
// 环境变量：AB=1、AB_A、AB_B（两个目录）、AB_NODE（节点名，如 09-选题）、AB_PROFILES（可选，逗号分隔；默认 A 里有提示词的全部）、
//          AB_CONCURRENCY（默认 4）、AB_B_APP=test（B 版发到 Dify 测试应用：改的是工作流、系统提示词、知识库检索时用，
//          两边提示词一样，A 走线上应用、B 走改过的测试应用）
//          AB_POLISH=1（B 版出稿后走脚本打磨 lib/script-polish，和线上 app/api/dify/stream 同一个函数；
//          初稿存 .raw.md，体检和每一轮的记录存 .polish.json）
// 用法：npx vitest run --config vitest.eval.config.ts evals/ab-replay.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { polishScript } from '@/lib/script-polish';

const ROOT = 'E:/小宋/腾讯云生产版同步_20260918';
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

it('新旧对照重发', { timeout: 14_400_000 }, async () => {
  if (!process.env.AB) return;
  const [A, B, node] = [process.env.AB_A!, process.env.AB_B!, process.env.AB_NODE!];
  const codes = process.env.AB_PROFILES
    ? process.env.AB_PROFILES.split(',').map((s) => s.trim())
    : fs.readdirSync(A).filter((c) => fs.existsSync(`${A}/${c}/${node}.prompt.txt`));
  const jobs = codes.flatMap((code) => [A, B].map((dir) => ({ dir, code })));
  const concurrency = Math.max(1, Number(process.env.AB_CONCURRENCY ?? 4));
  const PROD_KEY = process.env.DIFY_API_KEY!;
  const TEST_KEY = process.env.DIFY_TEST_API_KEY ?? '';
  if (process.env.AB_B_APP === 'test' && !TEST_KEY) throw new Error('AB_B_APP=test 要 .env.local 里有 DIFY_TEST_API_KEY');
  const keyOf = (dir: string) => (process.env.AB_B_APP === 'test' && dir === B ? TEST_KEY : PROD_KEY);
  let failures = 0;
  let halted = false;

  const runOne = async ({ dir, code }: { dir: string; code: string }) => {
    const out = `${dir}/${code}/${node}.out.md`;
    // AB_REPOLISH=1：B 版已经有初稿（.raw.md）的，不重新生成，只在初稿上重跑打磨（改了打磨逻辑之后用）
    const raw = `${dir}/${code}/${node}.raw.md`;
    if (process.env.AB_REPOLISH && dir === B && fs.existsSync(raw)) {
      if (halted) return;
      const key = keyOf(dir);
      const prompt = fs.readFileSync(`${dir}/${code}/${node}.prompt.txt`, 'utf8');
      const t0 = Date.now();
      const polish = await polishScript({
        draft: fs.readFileSync(raw, 'utf8'), query: prompt, known: prompt, retryDelayMs: 8000,
        // 3 分钟超时（和线上一样）：没有超时的话一次请求挂住，整批就卡在这里
        ask: async (q) => { process.env.DIFY_API_KEY = key; const r = await askDify(q, `ab-${code}-polish`, '', { signal: AbortSignal.timeout(180_000) }).catch(() => null); return r?.ok ? r.text : null; },
      });
      fs.writeFileSync(`${dir}/${code}/${node}.polish.json`, JSON.stringify({ calls: polish.calls, changed: polish.changed, reviewFailed: polish.reviewFailed, rounds: polish.rounds, firstIssues: polish.firstIssues }, null, 2), 'utf8');
      fs.writeFileSync(out, polish.text, 'utf8');
      console.log(`${dir.split('/').pop()} ${code} ${node} 重新打磨 ${Math.round((Date.now() - t0) / 1000)}s 调用 ${polish.calls} 次 ${polish.changed ? '有改动' : '没改'}`);
      return;
    }
    if (fs.existsSync(out) || halted) return;
    const prompt = fs.readFileSync(`${dir}/${code}/${node}.prompt.txt`, 'utf8');
    const search = fs.readFileSync(`${dir}/${code}/${node}.search.txt`, 'utf8');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const t0 = Date.now();
      // askDify 在第一个 await 之前就把钥匙读进请求头，这里同一刻换钥匙，并发也不会串
      process.env.DIFY_API_KEY = keyOf(dir);
      const res = await askDify(prompt, `ab-${code}`, search);
      if (res.ok) {
        failures = 0;
        let text = res.text;
        if (process.env.AB_POLISH && dir === B) {
          fs.writeFileSync(`${dir}/${code}/${node}.raw.md`, text, 'utf8');
          const key = keyOf(dir);
          const polish = await polishScript({
            draft: text, query: prompt, known: prompt, retryDelayMs: 8000,
            ask: async (q) => { process.env.DIFY_API_KEY = key; const r = await askDify(q, `ab-${code}-polish`, '', { signal: AbortSignal.timeout(180_000) }).catch(() => null); return r?.ok ? r.text : null; },
          });
          fs.writeFileSync(`${dir}/${code}/${node}.polish.json`, JSON.stringify({ calls: polish.calls, changed: polish.changed, reviewFailed: polish.reviewFailed, rounds: polish.rounds, firstIssues: polish.firstIssues }, null, 2), 'utf8');
          text = polish.text;
        }
        fs.writeFileSync(out, text, 'utf8');
        console.log(`${dir.split('/').pop()} ${code} ${node} ok ${Math.round((Date.now() - t0) / 1000)}s ${text.length}字`);
        return;
      }
      console.log(`${dir.split('/').pop()} ${code} 第 ${attempt} 次失败：${res.message}`);
      await new Promise((r) => setTimeout(r, 8000 * attempt));
    }
    failures += 1;
    if (failures >= 3) halted = true; // 连续失败多半是余额或服务问题，停下来看原因
  };

  const queue = [...jobs];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !halted) await runOne(queue.shift()!);
  }));
  const done = jobs.filter((j) => fs.existsSync(`${j.dir}/${j.code}/${node}.out.md`)).length;
  console.log(halted ? `连续失败，已停止（${done} / ${jobs.length}）` : `done ${done} / ${jobs.length}`);
});
