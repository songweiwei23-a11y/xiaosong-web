// 避重清单对照（2026-11-08）：同一个选题请求，不带 / 带「已经做过」清单，两个行业 × 2 次 = 8 次调用「开物」，交替跑（同一时段）。
// 看两件事：①新选题和做过的重不重 ②做过的标题里的细节（季节、具体菜品）会不会被带进新选题。
import fs from 'node:fs';
import { it } from 'vitest';
import { askDify } from '@/lib/dify-task';
import { resolveMix } from '@/lib/content-mix';
import { buildTopicBoardQuery } from '@/lib/boards/topic-query';
import type { DoneItem } from '@/lib/done-list';

const ROOT = process.cwd();
const OUT = `${ROOT}/.tmp/done-ab/runs`;
for (const line of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const done = (titles: [string, string][]): DoneItem[] => titles.map(([title, purpose]) => ({ title, status: '已发布', purpose, tactic: null }));
const CASES = [
  {
    code: 'A',
    profile: {
      profile_name: '锦园地摊串串一元火锅', account_platform: ['抖音'], account_track: ['美食烹饪', '本地服务'], account_stage: '起号期', fans_level: '0-1000',
      target_age: ['25-35岁'], target_occupation: ['白领', '宝妈'], target_region: ['南乐本地'], product_category: ['川味串串火锅', '川味烧烤', '川菜'],
      persona_facts: { host: '成都来的川菜厨师', role: '本人（掌勺）', origin: '成都人', yearsInTrade: '做川菜9年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤、川菜', signature: '一元火锅' },
      interview_highlights: '出镜人是成都来的川菜厨师，做川菜9年，来南乐半年；一元火锅是门店核心卖点，低门槛引流',
      content_themes: '以川味串串火锅、川味烧烤、川菜三个品类为核心，晒食材准备过程，教知识，厨师经验分享', unique_selling_point: '正宗川味配方，一元火锅低门槛',
    },
    done: done([['一元火锅到底赚不赚钱', '变现型'], ['成都师傅教你调一碗干碟', '人设型'], ['夏天最后一锅冰粉', '流量型'], ['串串签子为什么要数', '流量型'], ['川味烧烤的辣椒面怎么炒', '人设型'], ['老顾客每周都来的原因', '变现型']]),
    leaks: ['冰粉', '夏天', '干碟', '签子', '辣椒面'],
  },
  {
    code: 'B',
    profile: {
      profile_name: '阿梅大码女装店', account_platform: ['抖音'], account_track: ['时尚穿搭', '本地服务'], account_stage: '起号期', fans_level: '0-1000', target_gender: '女',
      target_age: ['25-40岁'], target_occupation: ['宝妈', '上班族'], target_region: ['县城本地'], product_category: ['大码女装'],
      persona_facts: { host: '店主阿梅', role: '老板本人出镜', yearsInTrade: '做大码女装6年', yearsLocal: '在本地开店3年', mainProducts: '大码连衣裙、大码外套、大码裤装', signature: '50码以上可试穿' },
      interview_highlights: '店主做大码女装6年，店开了3年；很多大码女生在别的店买不到合身的衣服',
      content_themes: '穿搭教学、试衣过程、大码女生的穿衣烦恼', unique_selling_point: '50码以上有可试穿款',
    },
    done: done([['大码女生别再买oversize外套', '流量型'], ['50码裤子怎么选长度', '变现型'], ['宝妈试了五件最后选了这件', '人设型'], ['夏天大码连衣裙别选雪纺', '流量型'], ['大码女生的第一件西装', '流量型'], ['我为什么只做大码', '人设型']]),
    leaks: ['雪纺', '夏天', '西装', 'oversize', '试了五件'],
  },
];

function query(c: typeof CASES[number], withList: boolean): string {
  const creatorContext = { profile: c.profile, positioning: null, dealReasons: [], doneList: withList ? c.done : null } as never;
  return buildTopicBoardQuery({
    creatorContext, selectedProfile: c.profile, positioningForCtx: null, topicCount: 6, topicType: '流量型', topicRole: '按配比', mode: 'quick',
    sourceReference: '', sourceFrom: '', incomingSetup: null, keyword1: '', keyword2: '', keyword3: '', personalRequirement: '',
    currentSettings: {}, accountStage: '起号期', fansLevel: '0-1000', avgViewsInput: '', selectedPlatforms: ['抖音'], selectedTracks: [], selectedContentTypes: [],
    selectedStyles: [], positioningExtra: '', selectedElements: [], dealReasonLabels: [], benchmarkAccounts: '', viralCases: '', difficulty: '中等创意',
    withHook: true, tactic: '', route: '两种都出', routeExplicit: false, resolvedMix: resolveMix(c.profile, null, ''), quickTopics: true,
  } as never).query;
}

it('done-list A/B', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (let rep = 1; rep <= 2; rep++) {
    for (const c of CASES) {
      for (const withList of rep === 1 ? [false, true] : [true, false]) {
        const name = `${c.code}-${withList ? 'with' : 'base'}-${rep}`;
        if (fs.existsSync(`${OUT}/${name}.out.md`)) continue;
        const q = query(c, withList);
        fs.writeFileSync(`${OUT}/${name}.prompt.txt`, q, 'utf8');
        const t0 = Date.now();
        const res = await askDify(q, `done-ab-${c.code}`, '选题');
        const text = res.ok ? res.text : `失败：${res.message}`;
        fs.writeFileSync(`${OUT}/${name}.out.md`, text, 'utf8');
        fs.appendFileSync(`${OUT}/meta.jsonl`, JSON.stringify({ name, ok: res.ok, ms: Date.now() - t0, chars: text.length }) + '\n', 'utf8');
        if (!res.ok) throw new Error(`${name} 失败，停止：${text}`);
      }
    }
  }
});
