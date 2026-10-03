/**
 * 禁忌库（2026-10-02 产品方："禁忌放在档案比较合适，最好限制产出内容的时候方向不会偏，
 * 比方说这个行业哪些方向不能拍，避免使用中出现"）。
 * 踩禁忌不会报错，只会发出去被限流、被投诉——所以匹配、注入、扫描三处都守住
 */
import { describe, it, expect } from 'vitest';
import {
  INDUSTRIES, PLATFORM_TABOOS, industriesOf, activeTaboos, countTaboos, taboosPromptBlock,
  scanTaboos, fixRequest, readTabooSettings,
} from '@/lib/taboos';
import { PROFILE_CHOICES } from '@/lib/profile-fields';
import { buildContextBlock } from '@/lib/creator-context';
import { BOARD_MANIFESTS } from '@/lib/context-manifest';
import { buildPositioningPrompt } from '@/lib/positioning-standards';
import { buildBriefPrompt } from '@/lib/creative-brief';
import { readCode } from './helpers/source';

const shop = { profile_name: '锦园地摊串串一元火锅', account_track: ['美食烹饪', '川菜'], product_category: ['川味串串火锅', '川味烧烤', '川菜'] };

describe('禁忌库本身', () => {
  it('id 全站唯一；每条都有为什么', () => {
    const all = [...PLATFORM_TABOOS, ...INDUSTRIES.flatMap((i) => i.items)];
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const t of all) expect(t.why, t.id).toBeTruthy();
  });

  it('扫描词都是合法正则，而且不会空匹配（空匹配 = 每行都报）', () => {
    for (const t of [...PLATFORM_TABOOS, ...INDUSTRIES.flatMap((i) => i.items)].filter((x) => x.words)) {
      const re = new RegExp(t.words!);
      expect(re.test(''), t.id).toBe(false);
    }
  });

  it('档案赛道、品类的每个标准选项都对得上一个行业（选了就有行业禁忌）', () => {
    for (const v of [...PROFILE_CHOICES.account_track, ...PROFILE_CHOICES.product_category].filter((x) => x !== '生活用品')) {
      expect(INDUSTRIES.some((i) => i.values.includes(v)), v).toBe(true);
    }
  });

  it('每个行业都有「不能拍的方向」——产品方点名要在方向上卡住', () => {
    for (const ind of INDUSTRIES) expect(ind.items.some((t) => t.kind === 'direction'), ind.name).toBe(true);
  });

  it('平台红线只有站外导流能关', () => {
    expect(PLATFORM_TABOOS.filter((t) => t.closable).map((t) => t.id)).toEqual(['p-offsite']);
  });
});

describe('按档案认行业', () => {
  it('锦园地摊：认成餐饮（赛道值命中）', () => {
    expect(industriesOf(shop).map((i) => i.name)).toEqual(['餐饮']);
  });

  it('自定义赛道、名称里的关键词也认（高风险行业靠它）', () => {
    expect(industriesOf({ profile_name: '小美医美诊所' }).map((i) => i.id)).toContain('medical');
    expect(industriesOf({ account_track: ['宠物'], profile_name: '萌宠乐园' }).map((i) => i.id)).toContain('pet');
  });

  it('不乱认：「最近」「厨房装修」不会被认成餐饮，名字带「狗」也不会被认成宠物', () => {
    expect(industriesOf({ profile_name: '老王厨房装修', account_track: ['家居装修'] }).map((i) => i.id)).toEqual(['home']);
    expect(industriesOf({ profile_name: '狗不理包子' }).map((i) => i.id)).not.toContain('pet');
  });

  it('手动加的行业算上；关掉的条目、关掉的站外导流不再生效', () => {
    const p = { ...shop, taboo_settings: { added: ['alcohol'], disabled: ['food-drink', 'p-offsite', 'p-absolute'], extra: ['不拍老板娘'] } };
    const a = activeTaboos(p);
    expect(a.industries.map((x) => x.industry.id)).toEqual(['food', 'alcohol']);
    expect(a.industries[0].items.map((t) => t.id)).not.toContain('food-drink');
    expect(a.platform.map((t) => t.id)).not.toContain('p-offsite');
    expect(a.platform.map((t) => t.id)).toContain('p-absolute'); // 锁死的关不掉
    expect(a.extra).toEqual(['不拍老板娘']);
    expect(countTaboos(a)).toBe(a.platform.length + a.industries.reduce((n, x) => n + x.items.length, 0) + 1);
  });

  it('库里的设置乱写也不崩', () => {
    expect(readTabooSettings(null)).toEqual({ disabled: [], extra: [], added: [], excluded: [] });
    expect(readTabooSettings({ added: ['不存在的行业', 'pet'], extra: ['', ' 不说加盟 '] })).toEqual({ disabled: [], extra: ['不说加盟'], added: ['pet'], excluded: [] });
  });
});

describe('写进提示词', () => {
  it('不能拍的方向放在最前，带上行业名', () => {
    const b = taboosPromptBlock(shop);
    expect(b.indexOf('不能拍的方向')).toBeLessThan(b.indexOf('不能说的话'));
    expect(b).toContain('平台红线 + 餐饮行业');
    expect(b).toContain('吃了能治病、养生');
  });

  it('所有带禁忌切片的板块都拿得到行业禁忌', () => {
    const ctx = { profile: { id: 'p', ...shop }, positioning: null, dealReasons: [] };
    for (const m of BOARD_MANIFESTS.filter((x) => x.profile.includes('restrictions'))) {
      expect(buildContextBlock(ctx, m.board), m.board).toContain('不能拍的方向（平台红线 + 餐饮行业）');
    }
  });

  it('定位、简报也带上；定位里和禁忌冲突的计直接拿掉', () => {
    const t = taboosPromptBlock({ account_track: ['宠物'], profile_name: '萌宠乐园' });
    const pos = buildPositioningPrompt({ profileSummary: '- 档案名称：萌宠乐园', taboos: t });
    expect(pos).toContain('以上同样管定位里的主打内容');
    expect(pos).toMatch(/这几计和他档案里的禁忌冲突|整蛊/);
    expect(buildBriefPrompt({ positioningFull: '定位', taboos: t })).toContain('这个行业的禁忌');
  });
});

describe('生成完扫一遍', () => {
  it('踩了就报，并给出换成什么', () => {
    const hits = scanTaboos('## 选题1\n我们是全城最正宗的川味串串，零添加，吃了养胃\n关注我，加微信领优惠', shop);
    expect(hits.map((h) => h.word)).toEqual(expect.arrayContaining(['全城最正宗', '零添加', '养胃', '加微信']));
    expect(fixRequest(hits)).toContain('「全城最正宗」');
  });

  it('在列禁忌的行不算踩（定位、简报里常有"不说「最正宗」"）', () => {
    expect(scanTaboos('- 不要说"全城最正宗"\n⛔ 禁忌：零添加\n明确不做：养胃功效', shop)).toEqual([]);
  });

  it('不误报：「最近」「最后」「第一步」「第一次」', () => {
    expect(scanTaboos('最近天冷了，最后一步是装盘，第一步先穿串，第一次来的客人', shop)).toEqual([]);
  });

  it('提问不算吹：「一元火锅怎么吃最划算？」（实测误报）；自己说「我们最划算」照样报', () => {
    expect(scanTaboos('"一元火锅怎么吃最划算？"厨师教点单技巧', shop)).toEqual([]);
    expect(scanTaboos('哪家最好吃？', shop)).toEqual([]);
    expect(scanTaboos('我们家最划算', shop).map((h) => h.word)).toEqual(['最划算']);
  });

  it('关掉的条目不再报', () => {
    expect(scanTaboos('加微信领优惠', { ...shop, taboo_settings: { disabled: ['p-offsite'] } })).toEqual([]);
  });
});

describe('页面接线', () => {
  it('档案表单有「禁忌与红线」编辑区，设置随档案一起存', () => {
    const form = readCode('components/profile/ProfileForm.tsx');
    expect(form).toContain('<TabooEditor');
    expect(form).toMatch(/extras\.taboo_settings = /);
  });

  it('所有结果面板生成完都扫一遍；「让 AI 改掉」预填进继续对话', () => {
    expect(readCode('components/workspace/ResultPanel.tsx')).toMatch(/<TabooScan body=\{body\} onContinue=\{onContinue\} \/>/);
    expect(readCode('components/workspace/TabooScan.tsx')).toMatch(/setDialogDraft\(text\)[\s\S]*onContinue\(\)/);
    expect(readCode('components/ContinuousDialog.tsx')).toMatch(/takeDialogDraft\(\)[\s\S]{0,40}setInputValue\(draft\)/);
  });

  it('状态条显示已避开几条禁忌', () => {
    expect(readCode('components/workspace/ContextBadge.tsx')).toMatch(/已避开 \{countTaboos\(a\)\} 条禁忌/);
  });

  it('选题、起号的「和禁忌冲突的计」也算上行业禁忌', () => {
    expect(readCode('app/dashboard/topic/page.tsx')).toMatch(/taboosPromptBlock\(selectedProfile\)/);
    expect(readCode('app/dashboard/growth/page.tsx')).toMatch(/taboosPromptBlock\(context\.profile\)/);
  });
});
