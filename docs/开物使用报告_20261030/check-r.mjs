// 对比两轮输出的机械指标：没有出处的百分数、【待确认】占位数、分镜拍摄要点里的规则泄漏、字数、「100%」统计
// 用法：node check-r.mjs <runDir> [<runDir> ...]
import fs from 'node:fs';
import path from 'node:path';

const NODES = ['01-账号定位', '03-内容定位', '04-创作简报', '05-行业建议', '06-起号方案', '10-脚本', '11-分镜', '16-拆解爆款', '18-对标分析'];
// 规则泄漏：规则原文（「不念出来」「禁用称呼」）或身份称呼（师傅、主厨）出现在输出里
const LEAK = /不念|禁用称呼|师傅|主厨/;

for (const dir of process.argv.slice(2)) {
  console.log(`\n== ${dir}`);
  console.log('节点\t行业\t字数\t百分数\t无出处\t待确认\t拍摄要点泄漏\t100%');
  for (const node of NODES) {
    for (const ind of ['A', 'B', 'C']) {
      const outFile = path.join(dir, ind, `${node}.out.md`);
      const promptFile = path.join(dir, ind, `${node}.prompt.txt`);
      if (!fs.existsSync(outFile)) continue;
      const out = fs.readFileSync(outFile, 'utf8');
      const prompt = fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '';
      const pcts = out.match(/\d+(\.\d+)?\s*%/g) ?? [];
      const unsourced = [...new Set(pcts.map((x) => x.replace(/\s/g, '')))].filter((x) => !prompt.includes(x));
      const placeholders = (out.match(/【待确认/g) ?? []).length;
      const leak = out.split('\n').filter((l) => LEAK.test(l)).length;
      const full100 = (out.match(/100\s*%/g) ?? []).length;
      console.log(`${node}\t${ind}\t${out.length}\t${pcts.length}\t${unsourced.length}\t${placeholders}\t${leak}\t${full100}`);
    }
  }
}
