/**
 * 记忆和防重复都按档案隔离。
 *
 * 线上 bug：选题防重复清单按"用户"取，四个档案的选题混在一起——
 * 给家具城出选题时，代运营号的 34 条选题被当成"这个账号出过的"发给 AI，
 * 清单上限 100 条还被别的号挤占。
 */
import { describe, it, expect } from 'vitest';
import { batchBelongsToProfile } from '@/lib/topic-library';
import { buildScopeKey } from '@/lib/dify-conversation';
import { readCode } from './helpers/source';

describe('这一批选题是哪个档案的', () => {
  it('新记录按 profile_id 认（生成页和追问两种写法都认）', () => {
    expect(batchBelongsToProfile({ profile_id: 'a' }, 'a')).toBe(true);
    expect(batchBelongsToProfile({ profile_id: 'b' }, 'a')).toBe(false);
    expect(batchBelongsToProfile({ profileId: 'a' }, 'a')).toBe(true);
  });

  it('旧记录没存 id，按 profileInfo 里的档案名称认（存的是 JSON 字符串）', () => {
    const old = { profileInfo: JSON.stringify({ 档案名称: '实体获客编导-不一', 平台: '抖音' }) };
    expect(batchBelongsToProfile(old, 'a', '实体获客编导-不一')).toBe(true);
    expect(batchBelongsToProfile(old, 'b', '万客隆家具城')).toBe(false);
    expect(batchBelongsToProfile(old, 'b', null)).toBe(false);
  });

  it('什么线索都没有的旧记录算进来：宁可多防一点重复', () => {
    expect(batchBelongsToProfile({}, 'a', 'x')).toBe(true);
    expect(batchBelongsToProfile(null, 'a', 'x')).toBe(true);
    expect(batchBelongsToProfile({ profileInfo: '不是JSON' }, 'a', 'x')).toBe(true);
  });
});

describe('每个档案一个记忆窗口', () => {
  it('会话按档案分，不同档案是不同的窗口', () => {
    expect(buildScopeKey('a')).not.toBe(buildScopeKey('b'));
    expect(buildScopeKey(null)).toBe('default');
  });
});

describe('接线', () => {
  it('生成选题和追问"再来一批"，防重复清单都按档案取', () => {
    expect(readCode('app/api/dify/stream/route.ts')).toMatch(/loadPriorTopicTitles\(guard\.userId!, body\.profileId \|\| body\.profile_id \|\| null\)/);
    expect(readCode('app/api/dify/chat/route.ts')).toMatch(/loadPriorTopicTitles\(guard\.userId!, profileId\)/);
    expect(readCode('lib/topic-library-server.ts')).toMatch(/batchBelongsToProfile\(b\.input_data, profileId/);
  });

  it('选题存档时记下是哪个档案的；选题库也只列当前档案的', () => {
    const page = readCode('app/dashboard/topic/page.tsx');
    expect(page).toMatch(/profile_id: selectedProfileId \|\| null/);
    expect(page).toMatch(/history\.filter\(\(b\) =>\s*batchBelongsToProfile/);
  });
});
