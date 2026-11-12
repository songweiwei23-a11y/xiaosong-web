// 回放：用已保存的真模型输出重新跑越界检查（不调模型）。结果写成 UTF-8 文件，便于核对。
import fs from 'node:fs';
import path from 'node:path';
import { reviewDrift } from '../../lib/review-drift';

const DIR = process.argv[2];
const DRAFT = '## 开头\n南乐县城的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，串串现穿现烫，锅底是我按成都的做法熬的，主厨做川菜9年。\n食材当天进货，价格摆在明面上，吃多少算多少。\n## 结尾\n位置放在评论区，想来的直接问。';

const out: Record<string, unknown> = {};
for (const name of ['old-1', 'old-2', 'new-1', 'new-2']) {
  const text = fs.readFileSync(path.join(DIR, `${name}.md`), 'utf8');
  const r = reviewDrift(DRAFT, text);
  out[name] = { newSentences: r.newSentences.length, unexplained: r.unexplained };
}
fs.writeFileSync(path.join(DIR, 'replay.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('written');
