// 新旧对照的确定性检查（2026-11-01，整改阶段 2）：没有标准卡的板块（分镜、标题封面、开篇钩子、审稿、自由对话）
// 不走评估器，A、B 两边逐份量几样不靠模型判断的东西，合起来比：
//   新细节：输出里新出现、提示词里找不到的具体细节（lib/noise-check；提示词当输入，A、B 同一份，口径一致）
//   营销腔：系统提示词点名不用的那几个词
//   金句：写着「金句」二字的行（旧系统提示词要求每条脚本写结尾金句）
//   待确认：【待确认】【示例】这类占位（多了说明在守事实底线，不是坏事）
//   字数
// 环境变量：AB_CHECK=1、AB_A、AB_B、AB_CHECK_NODES（逗号分隔）、AB_CHECK_OUT（结果 md）
// 用法：npx vitest run --config vitest.eval.config.ts evals/ab-checks.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { noiseReport } from '@/lib/noise-check';

const HYPE = /匠心|用心|精心|秉承|致力于|倾力打造|深耕|沉淀|赋能|焕新/g;

type Row = { code: string; node: string; side: 'A' | 'B'; chars: number; novel: number; novelText: string[]; hype: number; golden: number; placeholder: number };

function measure(dir: string, code: string, node: string, side: 'A' | 'B'): Row | null {
  const out = `${dir}/${code}/${node}.out.md`;
  if (!fs.existsSync(out)) return null;
  const text = fs.readFileSync(out, 'utf8');
  const prompt = fs.readFileSync(`${dir}/${code}/${node}.prompt.txt`, 'utf8');
  const novel = noiseReport(text, [prompt]).novel;
  return {
    code, node, side, chars: text.length, novel: novel.length, novelText: novel.map((s) => s.text),
    hype: (text.match(HYPE) ?? []).length,
    golden: text.split('\n').filter((l) => l.includes('金句')).length,
    placeholder: (text.match(/【(?:待确认|示例|换成)/g) ?? []).length,
  };
}

it('新旧对照确定性检查', () => {
  if (!process.env.AB_CHECK) return;
  const [A, B] = [process.env.AB_A!, process.env.AB_B!];
  const nodes = process.env.AB_CHECK_NODES!.split(',').map((s) => s.trim());
  const rows: Row[] = [];
  for (const node of nodes) {
    for (const code of fs.readdirSync(A).filter((c) => fs.existsSync(`${A}/${c}/${node}.out.md`) && fs.existsSync(`${B}/${c}/${node}.out.md`)).sort()) {
      rows.push(measure(A, code, node, 'A')!, measure(B, code, node, 'B')!);
    }
  }
  const sum = (node: string, side: string, k: 'chars' | 'novel' | 'hype' | 'golden' | 'placeholder') => rows.filter((r) => r.node === node && r.side === side).reduce((n, r) => n + r[k], 0);
  const cnt = (node: string, side: string) => rows.filter((r) => r.node === node && r.side === side).length;
  const md = ['# 新旧对照：确定性检查', '', 'A = 线上应用（旧系统提示词），B = 测试应用（瘦身版），同一份提示词、同一时段。', '',
    '| 板块 | 份数 | 新细节 A / B | 营销腔 A / B | 写「金句」的行 A / B | 占位 A / B | 平均字数 A / B |', '|---|---|---|---|---|---|---|',
    ...nodes.map((n) => `| ${n} | ${cnt(n, 'A')} | ${sum(n, 'A', 'novel')} / ${sum(n, 'B', 'novel')} | ${sum(n, 'A', 'hype')} / ${sum(n, 'B', 'hype')} | ${sum(n, 'A', 'golden')} / ${sum(n, 'B', 'golden')} | ${sum(n, 'A', 'placeholder')} / ${sum(n, 'B', 'placeholder')} | ${Math.round(sum(n, 'A', 'chars') / Math.max(1, cnt(n, 'A')))} / ${Math.round(sum(n, 'B', 'chars') / Math.max(1, cnt(n, 'B')))} |`),
    '', '## 逐份', '', '| 板块 | 档案 | 边 | 字数 | 新细节 | 营销腔 | 金句行 | 占位 |', '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.node} | ${r.code} | ${r.side} | ${r.chars} | ${r.novel}${r.novel ? `（${r.novelText.slice(0, 6).join('、')}）` : ''} | ${r.hype} | ${r.golden} | ${r.placeholder} |`), ''].join('\n');
  fs.writeFileSync(process.env.AB_CHECK_OUT!, md, 'utf8');
  console.log(md.split('## 逐份')[0]);
});
