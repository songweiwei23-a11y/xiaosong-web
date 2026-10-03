/**
 * 档案里的事实要压过旧简报（2026-10-02 线上）：
 * 前采原文写「南乐定居 18 年」→ 简报写成「在南乐扎根 18 年」；后来档案改成「9 年川菜厨师」，
 * 但各板块读不到档案里的前采要点、简报也不重新生成，全站继续写 18 年
 */
import { describe, it, expect } from 'vitest';
import { buildContextBlock, briefOlderThanProfile, type CreatorContext } from '@/lib/creator-context';
import { buildBriefPrompt, profileFactsFingerprint, briefFactsChanged } from '@/lib/creative-brief';
import { readCode } from './helpers/source';

const BRIEF = '### 1. 一句话定位\n四川师傅掌勺的南乐川味地摊\n\n### 2. 人设与口吻\n- **我是谁**：在南乐扎根18年的四川师傅';
const PROFILE = { id: 'p1', profile_name: '锦园地摊', account_track: ['川菜'], interview_highlights: '出镜人是成都来的川菜厨师\n做川菜9年，来南乐半年', unique_selling_point: '实在不坑' };
/** 简报写的时候档案是 old 那样；现在档案是 PROFILE（不传 old = 简报就是按现在的档案写的） */
const ctx = (old?: object): CreatorContext => ({
  profile: PROFILE,
  positioning: null,
  dealReasons: [],
  brief: BRIEF,
  briefFacts: profileFactsFingerprint(old ?? PROFILE),
});
const OLD = { ...PROFILE, interview_highlights: '老板四川籍，在南乐定居 18 年' };

describe('档案里的真实情况进到各板块', () => {
  it('前采要点作为「真实情况」带上，换行压成一行', () => {
    for (const board of ['script', 'review', 'topic', 'storyboard'] as const) {
      const block = buildContextBlock(ctx(OLD), board);
      expect(block, board).toContain('真实情况（年限、经历、籍贯以此为准');
      expect(block, board).toContain('出镜人是成都来的川菜厨师；做川菜9年，来南乐半年');
    }
  });

  it('真实情况写在简报之前，并说明冲突时以档案为准', () => {
    const block = buildContextBlock(ctx(OLD), 'script');
    expect(block.indexOf('真实情况')).toBeLessThan(block.indexOf('在南乐扎根18年'));
    expect(block).toMatch(/和上面账号背景对不上的一律以账号背景为准/);
  });

  it('档案没在简报之后改过：只留一句温和的规则', () => {
    const block = buildContextBlock(ctx(), 'script');
    expect(block).not.toContain('简报生成之后改过');
    expect(block).toContain('以账号背景为准');
  });
});

describe('判断简报是不是比档案旧', () => {
  it('人设、经历这些事实变了 = 旧；没变 = 不旧；老简报没记指纹 = 不判', () => {
    expect(briefOlderThanProfile(ctx(OLD))).toBe(true);
    expect(briefOlderThanProfile(ctx())).toBe(false);
    expect(briefOlderThanProfile({ ...ctx(OLD), briefFacts: null })).toBe(false);
    expect(briefOlderThanProfile({ ...ctx(OLD), brief: null })).toBe(false);
  });

  it('成交理由同步进核心卖点、改配比、开关禁忌、档案更新时间变了：都不算简报过时（2026-10-02 误报）', () => {
    const facts = profileFactsFingerprint(PROFILE);
    for (const changed of [
      { unique_selling_point: '实在不坑、性价比高、口碑好' },
      { content_mix: { preset: 'convert' } },
      { taboo_settings: { disabled: ['p-offsite'] } },
      { updated_at: '2026-10-02T23:59:00Z' },
      { interview_notes: '又补了一段前采原文' },
    ]) {
      expect(briefFactsChanged(facts, { ...PROFILE, ...changed }), JSON.stringify(changed)).toBe(false);
    }
    // 数组顺序、首尾空格不算变
    expect(briefFactsChanged(profileFactsFingerprint({ ...PROFILE, account_track: ['川菜 '] }), PROFILE)).toBe(false);
  });

  it('成交理由同步卖点：没有新卖点就不写档案', () => {
    expect(readCode('app/api/deal-reasons/route.ts')).toMatch(/if \(merged === prof\.unique_selling_point\) \{\s*profileSynced = true;/);
  });

  it('简报保存时记下指纹；上下文读出来；状态条和简报页都按它提醒', () => {
    expect(readCode('app/dashboard/creative-brief/page.tsx')).toMatch(/positioning_description: profileRow \? profileFactsFingerprint\(profileRow\) : null/);
    expect(readCode('hooks/useCreatorContext.ts')).toMatch(/briefFacts = typeof pick\?\.positioning_description === 'string'/);
    expect(readCode('app/dashboard/creative-brief/page.tsx')).toMatch(/const profileNewer = !!brief && briefFactsChanged\(brief\.positioning_description, profileRow\)/);
    expect(readCode('components/workspace/ContextBadge.tsx')).toMatch(/briefOlderThanProfile\(context\)[\s\S]*重新生成简报/);
    expect(readCode('app/dashboard/creative-brief/page.tsx')).toMatch(/profileNewer &&[\s\S]*账号档案在这份简报之后改过/);
  });
});

describe('生成简报', () => {
  it('用统一的档案摘要，不再把前采原始记录等所有栏原样倒进去', () => {
    const src = readCode('app/dashboard/creative-brief/page.tsx');
    expect(src).toMatch(/setProfileSummary\(p \? buildProfileSummary\(p\) : ''\)/);
    expect(src).not.toMatch(/Object\.entries\(p\)/);
  });

  it('提示词里写明事实以档案为准', () => {
    const prompt = buildBriefPrompt({ positioningFull: '定位', profileSummary: '- 前采要点：做川菜9年，来南乐半年' });
    expect(prompt).toContain('账号档案（事实以它为准）');
    expect(prompt).toMatch(/两边对不上时按档案写/);
  });
});
