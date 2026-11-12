import fs from 'node:fs';
import { it } from 'vitest';
import { findDuplicateTopics } from '@/lib/topic-dup';

const done = {
  A: ['一元火锅到底赚不赚钱', '成都师傅教你调一碗干碟', '夏天最后一锅冰粉', '串串签子为什么要数', '川味烧烤的辣椒面怎么炒', '老顾客每周都来的原因'],
  B: ['大码女生别再买oversize外套', '50码裤子怎么选长度', '宝妈试了五件最后选了这件', '夏天大码连衣裙别选雪纺', '大码女生的第一件西装', '我为什么只做大码'],
};
it('tune', () => {
  const dir = '.tmp/done-ab/runs';
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.out.md')).sort()) {
    const code = f[0] as 'A' | 'B';
    const titles = [...fs.readFileSync(`${dir}/${f}`, 'utf8').matchAll(/^#{2,3}\s*选题\s*\d+\s*[：:]\s*(.+)$/gm)].map((m) => m[1].trim());
    const hits = findDuplicateTopics(titles, done[code].map((title) => ({ title, status: '已发布' as const })), 0);
    console.log(`== ${f}`);
    for (const h of hits.sort((a, b) => b.score - a.score)) console.log(`  ${h.score.toFixed(2)}  ${h.title}  ≈ ${h.like}`);
  }
});
