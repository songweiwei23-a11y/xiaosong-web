// 联网「读懂需求」离线检验：12 个真实问法，每个 1 次小模型调用，只出搜索计划、不联网搜索。
//   npx vitest run -c .tmp/search-plan-eval/vitest.config.ts
import fs from 'node:fs';
import { it } from 'vitest';
// 检验时 lib/search-plan 还没部署：用一起传上去的那份
import { planSearch } from './search-plan';

const CASES: { q: string; recent?: string; hint?: string }[] = [
  { q: '帮我联网搜一下县城理发店怎么做抖音获客，有没有真实案例，然后帮我写个脚本', hint: '行业：理发；主卖：剪发、烫染；地区：河南南乐' },
  { q: '那客单价一般多少', recent: '用户：杭州的火锅店现在都怎么在抖音上做团购\n回答：……杭州火锅店多用 2-3 人套餐团购……', hint: '行业：餐饮；地区：杭州' },
  { q: '今天抖音有什么热点' },
  { q: '最近一周南乐有什么新闻', hint: '地区：河南南乐' },
  { q: '同行都怎么拍探店视频的，给我找几个做得好的', hint: '行业：餐饮；主卖：川菜、烧烤；地区：濮阳' },
  { q: '抖音本地生活商家团购的佣金是多少' },
  { q: '2026 年短视频行业有什么新政策' },
  { q: '换成上海的呢', recent: '用户：北京的瑜伽馆私教课一般什么价格\n回答：北京私教课大多 300-600 元一节……', hint: '行业：健身瑜伽' },
  { q: '大码女装直播间转化率一般多少，有数据吗', hint: '行业：服装；主卖：大码女装' },
  { q: '什么是完播率' },
  { q: '帮我查查最近有什么适合家居建材店蹭的热点', hint: '行业：家居建材；地区：郑州' },
  { q: 'Dify 的会话变量怎么用' },
];

it('出搜索计划', async () => {
  const out: unknown[] = [];
  for (const c of CASES) {
    const t0 = Date.now();
    const plan = await planSearch({ question: c.q, recent: c.recent, profileHint: c.hint, today: '2026年11月2日' });
    out.push({ q: c.q, recent: !!c.recent, hint: c.hint ?? '', ms: Date.now() - t0, plan });
  }
  fs.writeFileSync('.tmp/search-plan-eval/result.json', JSON.stringify(out, null, 2));
});
