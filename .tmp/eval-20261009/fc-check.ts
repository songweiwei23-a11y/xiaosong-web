import fs from 'node:fs';
import { unsupportedFacts } from '@/lib/quality-checks';
const t = fs.readFileSync('docs/自由对话接知识库_20261009/接入后自由对话实测.md', 'utf8');
const q = fs.readFileSync('docs/开物修复前后对比_20261009/修复后_第3轮/提示词/01.txt', 'utf8');
console.log(JSON.stringify(unsupportedFacts(t, q, { light: true })));
console.log((t.match(/知识库|多元四类|八大爆款|36计|起号|成交理由|四大脚本|钩子/g) || []).length, '处用到编导方法词');
