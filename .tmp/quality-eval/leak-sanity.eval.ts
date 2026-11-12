// 只读验证：净化函数对真实脚本输出的行为（一级标题的内部痕迹是否会把整篇删空）
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { sanitizeOutput, stripInternalLeaks } from '@/lib/output-guard';

const SRC = '.tmp/quality-eval/fresh/2026-10-11T09-54-41';

describe('净化函数对真实脚本', () => {
  it('输出长度与残留', () => {
    const raw = fs.readFileSync(`${SRC}/p1-script.md`, 'utf8').replace(/^# .*\n\n/, '');
    const out = sanitizeOutput(raw, '脚本生成');
    const stripped = stripInternalLeaks(raw, '脚本生成');
    console.log('RAW', raw.length, 'SANITIZED', out.length, 'STRIPPED', stripped.length,
      'leakLeft', /本轮内容落实规则|三有自检/.test(out), 'step2Left', /第2步/.test(out));
    fs.writeFileSync('.tmp/quality-eval/leak-sanity-out.md', out);
  });
});
