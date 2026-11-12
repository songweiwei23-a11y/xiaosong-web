import fs from 'node:fs';
import { scanTaboos } from '@/lib/taboos';
import { stripSelfCert } from '@/lib/self-cert';
const dirs = ['docs/开物全板块实测_20261009','docs/开物修复前后对比_20261009/修复前_第2轮','docs/开物修复前后对比_20261009/修复前_第3轮','docs/开物修复前后对比_20261009/修复后_第1轮','docs/开物修复前后对比_20261009/修复后_第2轮','docs/开物修复前后对比_20261009/修复后_第3轮','docs/开物修复前后对比_20261009/修复后_定位快速版补测'];
for (const d of dirs) { let n = 0; const lines: string[] = [];
  for (const f of fs.readdirSync(`${d}/原始输出`).filter((f) => f.endsWith('.md'))) {
    const body = stripSelfCert(fs.readFileSync(`${d}/原始输出/${f}`, 'utf8').split('\n---\n').slice(1).join('\n---\n'));
    for (const h of scanTaboos(body, null)) { n++; lines.push(`  ${f.slice(0, 12)} 「${h.word}」 ${h.line}`); } }
  console.log(`${d.split('/').pop()}: ${n}`); lines.forEach((l) => console.log(l)); }
