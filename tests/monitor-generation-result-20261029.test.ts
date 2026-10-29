/**
 * 监控里的生成类用量行，要能看到这次生成的全文（2026-10-29）。
 *
 * 线上现象：点开某人的时间线，「用了「账号定位」」「用了「创作简报」」这类用量行没有任何内容。
 * 原因：用量行只存了「用了哪个功能」，全文没人去取。但每次生成的 detail 里都记着生成编号
 * （generation_request_id，由 kaiwu_settle_creation 写入），完成时的全文在 creation_completion_evidence 里，
 * 两边按这个编号精确对上，不靠时间去猜。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generationRequestIdOf } from '@/lib/monitor';
import { generationResults } from '@/lib/admin-monitor-data';

const GID = 'req_0123456789abcdef';

describe('generationRequestIdOf：从用量的 detail 里读生成编号', () => {
  it('读得到合法的编号', () => {
    expect(generationRequestIdOf({ generation_request_id: GID })).toBe(GID);
  });

  it('没有、格式不对、不是对象，都返回 null', () => {
    expect(generationRequestIdOf({})).toBeNull();
    expect(generationRequestIdOf({ generation_request_id: 'short' })).toBeNull();
    expect(generationRequestIdOf({ generation_request_id: 'bad id with spaces!!' })).toBeNull();
    expect(generationRequestIdOf({ generation_request_id: 123 })).toBeNull();
    expect(generationRequestIdOf(null)).toBeNull();
    expect(generationRequestIdOf('text')).toBeNull();
  });
});

/** 只实现 generationResults 用到的查询链，并记下每一步，方便断言 */
function fakeDb(rows: { request_id: string; result: string }[], log: string[], error: { message: string } | null = null) {
  const chain = {
    select: () => chain,
    eq: (col: string, val: string) => {
      log.push(`eq:${col}=${val}`);
      return chain;
    },
    in: async (col: string, vals: string[]) => {
      log.push(`in:${col}=${vals.join(',')}`);
      if (error) return { data: null, error };
      return { data: rows.filter((r) => vals.includes(r.request_id)), error: null };
    },
  };
  return {
    from: (table: string) => {
      log.push(`from:${table}`);
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe('generationResults：按编号取完整结果，只取这个用户名下的', () => {
  it('取到的按编号对应，并且只查这个用户', async () => {
    const log: string[] = [];
    const db = fakeDb([{ request_id: GID, result: '老板每天现做三道热菜' }], log);
    const out = await generationResults(db, 'u-1', [GID, GID]);
    expect(out.get(GID)).toBe('老板每天现做三道热菜');
    expect(log).toContain('from:creation_completion_evidence');
    expect(log).toContain('eq:user_id=u-1');
    // 重复的编号只查一次
    expect(log.filter((x) => x.startsWith('in:'))).toEqual([`in:request_id=${GID}`]);
  });

  it('没有编号时不查库', async () => {
    const log: string[] = [];
    const out = await generationResults(fakeDb([], log), 'u-1', []);
    expect(out.size).toBe(0);
    expect(log).toEqual([]);
  });

  it('查询出错时抛出，不返回空（不能把读失败当成没有结果）', async () => {
    await expect(generationResults(fakeDb([], [], { message: 'boom' }), 'u-1', [GID])).rejects.toThrow('boom');
  });
});

describe('时间线和「看完整记录」都会用编号去取全文', () => {
  it('时间线：生成类的用量行取完整结果', () => {
    const timeline = readFileSync(join(process.cwd(), 'app/api/admin/monitor/timeline/route.ts'), 'utf8');
    expect(timeline).toMatch(/generationRequestIdOf\(u\.detail\)/);
    expect(timeline).toMatch(/generationResults\(db, userId, \[\.\.\.genOf\.values\(\)\]\)/);
  });

  it('看完整记录：用量行没有对话内容时，取这次生成的全文', () => {
    const record = readFileSync(join(process.cwd(), 'app/api/admin/monitor/record/route.ts'), 'utf8');
    expect(record).toMatch(/generationResults\(db, userId, \[gid\]\)/);
    // 没有结果也要说清楚，不能给一个空白的全文
    expect(record).toMatch(/这次生成没有留下完整结果/);
  });
});
