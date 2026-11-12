// 上线后的三项实测（在服务器上跑）：
//   1. 三张新表（任务存根、反馈、笔记）能写、能读、能删（用一条临时记录，跑完删除）
//   2. 中转是否支持提示词缓存（同一段系统提示发两次，看第二次有没有缓存读取）
//   3. 便宜模型（ASSISTANT_CHEAP_MODEL）能不能正常调用
// 结果写到 .kb-probe/verify-result.json，最后打印 VERIFY_DONE。
import { describe, it } from 'vitest';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getServiceSupabase } from '@/lib/admin-auth';
import { readAssistantConfig, readCheapModel } from '@/lib/assistant/config';
import { callAssistantLlm } from '@/lib/assistant/llm';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/run';

describe('上线后实测', () => {
  it('三张新表、提示词缓存、便宜模型', async () => {
    const result: Record<string, unknown> = {};
    const db = getServiceSupabase();

    // 1. 表
    const users = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
    const userId = users.data?.users?.[0]?.id;
    if (!userId) throw new Error('找不到可以用来测试的用户');
    const tables: Record<string, string> = {};
    {
      const { data, error } = await db.from('assistant_notes').insert({ user_id: userId, content: '实测临时笔记' }).select('id').single();
      tables.notes_insert = error ? `失败：${error.message}` : 'ok';
      if (data?.id) {
        const back = await db.from('assistant_notes').select('id').eq('id', data.id).maybeSingle();
        tables.notes_read = back.error ? `失败：${back.error.message}` : back.data ? 'ok' : '读不到';
        const del = await db.from('assistant_notes').delete().eq('id', data.id);
        tables.notes_delete = del.error ? `失败：${del.error.message}` : 'ok';
      }
    }
    {
      const { data, error } = await db.from('assistant_feedback').insert({ user_id: userId, helpful: true, reason: '实测' }).select('id').single();
      tables.feedback_insert = error ? `失败：${error.message}` : 'ok';
      if (data?.id) {
        const del = await db.from('assistant_feedback').delete().eq('id', data.id);
        tables.feedback_delete = del.error ? `失败：${del.error.message}` : 'ok';
      }
    }
    {
      const id = randomUUID();
      const ins = await db.from('assistant_jobs').insert({ id, user_id: userId, status: 'running' });
      tables.jobs_insert = ins.error ? `失败：${ins.error.message}` : 'ok';
      if (!ins.error) {
        const up = await db.from('assistant_jobs').update({ status: 'done', stats: { probe: true }, finished_at: new Date().toISOString() }).eq('id', id);
        tables.jobs_update = up.error ? `失败：${up.error.message}` : 'ok';
        const del = await db.from('assistant_jobs').delete().eq('id', id);
        tables.jobs_delete = del.error ? `失败：${del.error.message}` : 'ok';
      }
    }
    result.tables = tables;

    // 2. 提示词缓存 & 3. 便宜模型
    const cfg = readAssistantConfig();
    if (!cfg) throw new Error('服务器没有配置助理模型');
    const big = ASSISTANT_SYSTEM + ASSISTANT_SYSTEM;
    const cachedCfg = { ...cfg, promptCache: true };
    const ask = (c: typeof cfg) => callAssistantLlm(c, { system: big, messages: [{ role: 'user', content: '回复一个字：好' }], tools: [], maxTokens: 16 });
    const first = await ask(cachedCfg).then((r) => r.usage).catch((e) => `失败：${e instanceof Error ? e.message : String(e)}`);
    const second = await ask(cachedCfg).then((r) => r.usage).catch((e) => `失败：${e instanceof Error ? e.message : String(e)}`);
    result.promptCache = { first, second };

    const cheap = readCheapModel() ?? 'claude-haiku-5-5';
    const cheapCall = await callAssistantLlm({ ...cfg, model: cheap }, { system: '你是助手', messages: [{ role: 'user', content: '回复一个字：好' }], tools: [], maxTokens: 16 })
      .then((r) => ({ ok: true, usage: r.usage }))
      .catch((e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    result.cheapModel = { model: cheap, ...cheapCall };

    fs.writeFileSync('.kb-probe/verify-result.json', JSON.stringify(result, null, 2), 'utf8');
    console.log(`VERIFY_DONE ${JSON.stringify(result)}`);
  }, 600_000);
});
