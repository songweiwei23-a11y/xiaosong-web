// 冒烟：确认 review-scope / review-drift 能正常返回（不跑 vitest）
import { reviewScopePlan, reviewScopeBlock } from '../../lib/review-scope';
import { reviewDrift } from '../../lib/review-drift';

const t0 = Date.now();
console.log('scope:', reviewScopePlan('只让他简单优化口语化一些').matched.map((r) => r.scope).join(','), Date.now() - t0, 'ms');
console.log('block len:', reviewScopeBlock('只让他简单优化口语化一些').length, Date.now() - t0, 'ms');
const draft = '## 开头\n南乐的川味地摊，下班路过就能吃上一口。\n## 正文\n一块钱一串，现穿现烫。\n## 结尾\n位置放在评论区。';
const output = '### 3. 问题清单\n无\n### 4. 优化后的完整脚本\n## 开头\n街角一盏灯，老板在等你。\n## 正文\n一块钱一串，现穿现烫。\n### 5. 纯文字文案\n街角一盏灯，老板在等你。';
console.log('drift:', JSON.stringify(reviewDrift(draft, output)), Date.now() - t0, 'ms');
console.log('done');
