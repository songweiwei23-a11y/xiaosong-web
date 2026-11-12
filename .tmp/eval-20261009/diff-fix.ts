import fs from 'node:fs';
const a = fs.readFileSync('docs/开物全板块实测_20261009/原始输出/11_脚本生成.md','utf8').split('\n---\n').slice(1).join('\n---\n');
const b = fs.readFileSync('docs/开物全板块实测_20261009/原始输出/16_按资料修正（自动修正）.md','utf8').split('\n---\n').slice(1).join('\n---\n');
const la = a.split('\n').map(s=>s.trim()).filter(Boolean), lb = b.split('\n').map(s=>s.trim()).filter(Boolean);
const sa = new Set(la), sb = new Set(lb);
const removed = la.filter(l=>!sb.has(l)), added = lb.filter(l=>!sa.has(l));
console.log(`原脚本 ${la.length} 行，修正后 ${lb.length} 行；删/改掉 ${removed.length} 行，新增 ${added.length} 行`);
console.log('--- 被删或改掉的'); removed.forEach(l=>console.log('  - '+l.slice(0,150)));
console.log('--- 新出现的'); added.forEach(l=>console.log('  + '+l.slice(0,150)));
