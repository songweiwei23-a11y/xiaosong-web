/**
 * 迁移状态探测（体检 P0-2）：表不存在 / 列不存在 / 都存在 / 无法检测，四种情况都要判对。
 */
import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { probeMigration, summarize, type MigrationStatus } from '@/lib/migration-status';
import type { MigrationEntry } from '@/lib/migration-registry';

const entry = (o: Partial<MigrationEntry>): MigrationEntry => ({ file: 'x.sql', tables: [], columns: [], ...o });

describe('探测单个迁移', () => {
  it('表和列都在 → 已执行', async () => {
    const db = createFakeDb({ demo: [{ id: 1, extra: 'a' }] });
    const s = await probeMigration(db as never, entry({ tables: ['demo'], columns: [{ table: 'demo', column: 'extra' }] }));
    expect(s).toMatchObject({ state: 'applied', checked: 2, missingTables: [], missingColumns: [] });
  });

  it('表不存在 → 未执行，并列出缺的表', async () => {
    const db = createFakeDb({}, { missingTables: ['demo'] });
    const s = await probeMigration(db as never, entry({ tables: ['demo'] }));
    expect(s).toMatchObject({ state: 'missing', missingTables: ['demo'] });
  });

  it('表在、列不在 → 缺列，并列出缺的列', async () => {
    const db = createFakeDb({ demo: [{ id: 1 }] }, { missingColumns: { demo: ['extra'] } });
    const s = await probeMigration(db as never, entry({ tables: ['demo'], columns: [{ table: 'demo', column: 'extra' }] }));
    expect(s).toMatchObject({ state: 'partial', missingTables: [], missingColumns: ['demo.extra'] });
  });

  it('没有建表、加列（只改策略或写数据）→ 无法自动检测', async () => {
    const db = createFakeDb({});
    expect(await probeMigration(db as never, entry({}))).toMatchObject({ state: 'unknown', checked: 0 });
  });

  it('其它错误（不是「不存在」）不算缺，免得网络抖一下就误报', async () => {
    const db = { from: () => ({ select: () => ({ limit: async () => ({ error: { message: 'connection reset' } }) }) }) };
    const s = await probeMigration(db as never, entry({ tables: ['demo'] }));
    expect(s.state).toBe('applied');
  });
});

describe('汇总', () => {
  it('按状态计数', () => {
    const mk = (state: MigrationStatus['state']): MigrationStatus => ({ file: state, state, checked: 1, missingTables: [], missingColumns: [] });
    expect(summarize([mk('applied'), mk('applied'), mk('missing'), mk('partial'), mk('unknown')])).toEqual({ total: 5, applied: 2, partial: 1, missing: 1, unknown: 1 });
  });
});

describe('管理员接口：只给管理员', () => {
  it('非管理员 403', async () => {
    vi.resetModules();
    vi.doMock('@/lib/admin-auth', () => ({ requireAdmin: async () => null, getServiceSupabase: () => ({}) }));
    const { GET } = await import('@/app/api/admin/migrations/route');
    expect((await GET()).status).toBe(403);
    vi.doUnmock('@/lib/admin-auth');
  });
});
