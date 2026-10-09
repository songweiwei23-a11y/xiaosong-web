/**
 * 全量数据导出与恢复预检（2026-10-04）：真实路由 + 内存数据库。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
import { readCode } from './helpers/source';

const env = vi.hoisted(() => ({ userId: 'user-a', db: null as any }));
vi.mock('@/lib/api-guard', () => ({ requireUser: async () => ({ ok: true, userId: env.userId }) }));
vi.mock('@/lib/admin-auth', () => ({ getServerSupabase: async () => env.db, getServiceSupabase: () => env.db }));
import { GET } from '@/app/api/account/export/route';
import { checkExportBundle, EXPORT_TABLES } from '@/lib/account-export';

const uuid = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`;
const exportNow = async () => JSON.parse(await (await GET()).text());

beforeEach(() => {
  env.userId = 'user-a';
  env.db = createFakeDb({
    script_history: [
      ...Array.from({ length: 1205 }, (_, i) => ({ id: uuid(i), user_id: 'user-a', task_type: '脚本生成', result: `第${i}条`, input_data: {} })),
      { id: uuid(9999), user_id: 'user-b', task_type: '脚本生成', result: '别人的', input_data: {} },
    ],
    user_profiles: [{ id: uuid(1), user_id: 'user-a', profile_name: '老灶火锅' }],
    user_settings: [{ user_id: 'user-a', theme: 'dark' }],
    payment_orders: [{ id: uuid(2), user_id: 'user-a', amount: 99, proof_url: 'https://私密凭证' }],
    research_jobs: [{ id: uuid(3), user_id: 'user-a', report: '我的研究', canvas_versions: [{ content:'改稿',at:1 }],run_token:'internal-token' },{id:uuid(4),user_id:'user-b',report:'他人研究'}],
    research_sources: [{job_id:uuid(3),n:1,content:'公开来源'},{job_id:uuid(4),n:1,content:'其他账号来源'}],
  }, { missingTables: ['creator_presets'], missingColumns: { user_settings: ['id'] } });
});

describe('全量导出', () => {
  it('每张表按页取完（超过 1000 条不少）；只有本人的', async () => {
    const b = await exportNow();
    expect(b.counts.script_history).toBe(1205);
    expect(b.tables.script_history.some((r: any) => r.result === '别人的')).toBe(false);
    expect(b.tables.user_profiles[0].profile_name).toBe('老灶火锅');
  });

  it('没有 id 列的表照样导出；表没建的写进 skipped，不当成没数据', async () => {
    const b = await exportNow();
    expect(b.tables.user_settings).toEqual([{ user_id: 'user-a', theme: 'dark' }]);
    expect(b.skipped.creator_presets).toMatch(/还没建/);
  });

  it('支付凭证地址不随导出外流', async () => {
    const b = await exportNow();
    expect(b.tables.payment_orders[0]).not.toHaveProperty('proof_url');
    expect(b.tables.payment_orders[0].amount).toBe(99);
  });
  it('仅导出本人研究和来源，保留改稿而不输出执行令牌',async()=>{
    const b=await exportNow();expect(b.tables.research_jobs).toHaveLength(1);expect(b.tables.research_jobs[0].canvas_versions).toHaveLength(1);expect(b.tables.research_jobs[0]).not.toHaveProperty('run_token');expect(b.tables.research_sources).toEqual([{job_id:uuid(3),n:1,content:'公开来源'}]);
    const foreign={...b,tables:{...b.tables,research_sources:[{job_id:uuid(4),n:1}]}};
    expect(checkExportBundle(foreign,'user-a').problems.join()).toContain('不属于本份报告');
    expect(checkExportBundle({...b,tables:{...b.tables,research_sources:[null]}},'user-a').ok).toBe(false);
  });
});

describe('恢复预检（只读）', () => {
  it('导出的文件原样检查通过；改了条数、混进别人的、换账号都查得出', async () => {
    const b = await exportNow();
    expect(checkExportBundle(b, 'user-a').ok).toBe(true);
    expect(checkExportBundle(b, 'user-b').problems.join()).toMatch(/另一个账号/);
    const cut = { ...b, tables: { ...b.tables, script_history: b.tables.script_history.slice(1) } };
    expect(checkExportBundle(cut, 'user-a').problems.join()).toMatch(/文件可能不完整/);
    const foreign = { ...b, tables: { ...b.tables, user_profiles: [{ user_id: 'user-b' }] }, counts: { ...b.counts, user_profiles: 1 } };
    expect(checkExportBundle(foreign, 'user-a').problems.join()).toMatch(/不属于这个账号/);
    expect(checkExportBundle({ hello: 1 }, 'user-a').ok).toBe(false);
  });

  it('导出覆盖到所有用户内容表（素材库、风格预设、对话、作品需求都在）', () => {
    const names = EXPORT_TABLES.map((t) => t.table);
    for (const t of ['material_library', 'creator_presets', 'chat_conversations', 'creation_sessions', 'works', 'script_history']) expect(names).toContain(t);
    expect(readCode('app/dashboard/account/page.tsx')).toMatch(/<DataExportCard \/>/);
  });
});
