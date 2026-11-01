// 补检索词（2026-11-01）：早先的评测轮没存 search.txt 的，按线上同一个函数（lib/search-query）从提示词算出来。
// 提示词里已经带了服务端补的尾巴（时间锚、档案关键事实、护栏），算之前先切掉，和 chain-eval 用的是同一段。
//
// 环境变量：SEARCH_FILL=1、SEARCH_DIRS（目录，逗号分隔）
// 用法：npx vitest run --config vitest.eval.config.ts evals/search-fill.eval.ts
import fs from 'node:fs';
import { it } from 'vitest';
import { buildSearchQuery } from '@/lib/search-query';

const TASK_TYPE: Record<string, string> = { '11-分镜': '分镜脚本', '12-标题封面': '标题封面', '13-开篇钩子': '开篇钩子', '14-审稿': '审稿优化' };

it('补检索词', () => {
  if (!process.env.SEARCH_FILL) return;
  let n = 0;
  for (const dir of process.env.SEARCH_DIRS!.split(',').map((s) => s.trim())) {
    for (const code of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
      for (const [node, taskType] of Object.entries(TASK_TYPE)) {
        const p = `${dir}/${code}/${node}.prompt.txt`;
        if (!fs.existsSync(p) || fs.existsSync(`${dir}/${code}/${node}.search.txt`)) continue;
        const prompt = fs.readFileSync(p, 'utf8');
        // 服务端尾巴从「今天是」时间锚或【档案关键事实】开始，取最早出现的那一处之前
        const cut = Math.min(...[/\n\n今天是\s*\d{4}\s*年/, /【档案关键事实/].map((re) => { const m = prompt.match(re); return m?.index ?? prompt.length; }));
        fs.writeFileSync(`${dir}/${code}/${node}.search.txt`, buildSearchQuery(taskType, { taskType }, prompt.slice(0, cut)), 'utf8');
        n++;
      }
    }
  }
  console.log(`补了 ${n} 个检索词`);
});
