/**
 * 人设事实卡（2026-10-03）：出镜人是谁、干了几年、从哪来、在本地多久、主卖什么做成固定的几格，
 * 所有板块以它为准。这几天的「南乐 18 年」「川菜被丢」「没选的公益被引用」根子都是事实散在自由文字栏里
 */
import { describe, it, expect } from 'vitest';
import { readPersonaFacts, personaFactsBlock, hasPersonaFacts, droppedColumnsNotice, PERSONA_FIELDS } from '@/lib/persona-facts';
import { buildContextBlock } from '@/lib/creator-context';
import { BOARD_MANIFESTS } from '@/lib/context-manifest';
import { buildProfileSummary } from '@/lib/profile-summary';
import { profileFactsFingerprint, briefFactsChanged } from '@/lib/creative-brief';
import { scrubProfile } from '@/lib/interview-exclusions';
import { readCode, readSource } from './helpers/source';

const facts = { host: '主厨老王', origin: '成都人', yearsInTrade: '做川菜 9 年', yearsLocal: '来南乐半年', mainProducts: '川味串串火锅、川味烧烤、川菜', others: '每天下午 4 点出摊\n人均 30-50 元' };
const profile = { id: 'p', profile_name: '锦园地摊', account_track: ['美食烹饪'], interview_highlights: '老板四川籍，在南乐定居 18 年', persona_facts: facts };

describe('读和写进提示词', () => {
  it('只留认识的格子，去空格；空的不写', () => {
    expect(readPersonaFacts({ host: ' 老王 ', hack: 'x', origin: '' })).toEqual({ host: '老王' });
    expect(hasPersonaFacts({})).toBe(false);
    expect(personaFactsBlock(null)).toBe('');
  });

  it('写明以它为准、冲突时按它来、没写的不编；其他硬事实一行一条', () => {
    const b = personaFactsBlock(facts);
    expect(b).toContain('- **干这行几年**：做川菜 9 年');
    expect(b).toContain('- **在本地多久**：来南乐半年');
    expect(b).toMatch(/和档案其他栏、前采要点、已有的定位或简报对不上时，一律以这里为准/);
    expect(b).toMatch(/这里没写的经历和数字不要自己编/);
    expect(b).toContain('  - 每天下午 4 点出摊');
    expect(b).not.toContain('一句话经历'); // 没填的格子不出现
  });

  it('所有板块的账号背景都带上，放在最前面（在前采要点的"18 年"之前）', () => {
    const ctx = { profile, positioning: null, dealReasons: [] };
    for (const m of BOARD_MANIFESTS) {
      const block = buildContextBlock(ctx, m.board);
      expect(block, m.board).toContain('人设事实卡');
    }
    const script = buildContextBlock(ctx, 'script');
    expect(script.indexOf('人设事实卡')).toBeLessThan(script.indexOf('18 年'));
  });

  it('定位、简报、方向用的档案摘要也带上', () => {
    const s = buildProfileSummary(profile);
    expect(s).toContain('人设事实卡');
    expect(s.indexOf('人设事实卡')).toBeLessThan(s.indexOf('前采要点'));
  });

  it('排除清单不会去删事实卡里的字（那是编导亲手确认的）', () => {
    const scrubbed = scrubProfile(profile, ['在南乐定居 18 年', '川菜'])!;
    expect(scrubbed.persona_facts).toEqual(facts);
  });
});

describe('简报过时判断', () => {
  it('改了事实卡 = 简报过时', () => {
    const before = profileFactsFingerprint(profile);
    expect(briefFactsChanged(before, { ...profile, persona_facts: { ...facts, yearsLocal: '来南乐一年' } })).toBe(true);
  });

  it('没填事实卡：指纹和加这一项之前一样（今晚已经记过指纹的简报不误报）', () => {
    const { persona_facts: _f, ...without } = profile;
    expect(profileFactsFingerprint({ ...without, persona_facts: {} })).toBe(profileFactsFingerprint(without));
    expect(profileFactsFingerprint({ ...without, persona_facts: null })).toBe(profileFactsFingerprint(without));
  });

  it('格子顺序不同不算变', () => {
    const reordered = Object.fromEntries(Object.entries(facts).reverse());
    expect(profileFactsFingerprint({ ...profile, persona_facts: reordered })).toBe(profileFactsFingerprint(profile));
  });
});

describe('档案页面和接口', () => {
  it('档案第 1 步有事实卡，九个格子都在；改过或原来有才发这一栏', () => {
    const form = readCode('components/profile/ProfileForm.tsx');
    expect(form).toContain('人设事实卡');
    expect(form).toMatch(/PERSONA_FIELDS\.map/);
    expect(form).toMatch(/if \(personaTouched \|\| hasPersonaFacts\(initial\?\.persona_facts\)\) extras\.persona_facts = /);
    expect(PERSONA_FIELDS).toHaveLength(9);
  });

  it('数据库还没升级、没存上：接口说出来，页面明说（不让编导以为存上了）', () => {
    expect(droppedColumnsNotice({ id: 'x', _droppedColumns: ['persona_facts'] })).toContain('「人设事实卡」没存上');
    expect(droppedColumnsNotice({ id: 'x' })).toBe('');
    expect(readCode('app/api/profiles/route.ts')).toMatch(/withDropped\(profile, dropped\)/);
    expect(readSource('app/dashboard/profiles/[id]/edit/page.tsx')).toMatch(/notify\(dropped \|\| '已保存'\)/);
    expect(readSource('app/dashboard/profiles/new/page.tsx')).toMatch(/droppedColumnsNotice\(created\)/);
  });

  it('状态条显示事实卡带没带上', () => {
    expect(readCode('components/workspace/ContextBadge.tsx')).toMatch(/hasPersonaFacts\(context\.profile\?\.persona_facts\)/);
  });

  it('迁移文件', () => {
    expect(readSource('supabase/migrations/20261003_persona_facts.sql')).toMatch(/add column if not exists persona_facts jsonb/);
  });
});
