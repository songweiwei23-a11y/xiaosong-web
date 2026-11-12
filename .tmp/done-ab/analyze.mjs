import fs from 'node:fs';
const dir = '.tmp/done-ab/runs';
const leaks = { A: ['冰粉', '夏天', '干碟', '签子', '辣椒面', '赚不赚钱', '老顾客每周'], B: ['雪纺', '夏天', '西装', 'oversize', '试了五件', '裤子', '只做大码'] };
const done = { A: ['一元火锅到底赚不赚钱', '成都师傅教你调一碗干碟', '夏天最后一锅冰粉', '串串签子为什么要数', '川味烧烤的辣椒面怎么炒', '老顾客每周都来的原因'], B: ['大码女生别再买oversize外套', '50码裤子怎么选长度', '宝妈试了五件最后选了这件', '夏天大码连衣裙别选雪纺', '大码女生的第一件西装', '我为什么只做大码'] };
const bigrams = (s) => { const t = s.replace(/[^一-龥a-z0-9]/gi, ''); const out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
const sim = (a, b) => { const A = bigrams(a), B = bigrams(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(1, Math.min(A.size, B.size)); };
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.out.md')).sort()) {
  const code = f[0];
  const text = fs.readFileSync(`${dir}/${f}`, 'utf8');
  const titles = [...text.matchAll(/^#{2,3}\s*选题\s*\d+\s*[：:]\s*(.+)$/gm)].map((m) => m[1].trim());
  const counts = leaks[code].map((w) => `${w}:${(text.match(new RegExp(w, 'g')) || []).length}`).join(' ');
  console.log(`\n== ${f}（${titles.length} 条）  ${counts}  提到清单:${/清单|以前拍过|和以前不同|之前拍过/.test(text)}`);
  for (const t of titles) {
    const best = done[code].map((d) => [d, sim(t, d)]).sort((a, b) => b[1] - a[1])[0];
    console.log(`  - ${t}${best[1] >= 0.4 ? `   ≈「${best[0]}」${best[1].toFixed(2)}` : ''}`);
  }
}
