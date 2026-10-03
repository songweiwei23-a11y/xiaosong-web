import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
const state = vi.hoisted(() => ({ rpc: vi.fn(), guard: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ getServiceSupabase: () => ({ rpc: state.rpc }) }));
vi.mock('@/lib/api-guard', () => ({ requireUserWithQuota: state.guard }));
import { prepareWebSearch, wantsWebSearch } from '@/lib/web-search-quota';
import { WEB_SEARCH_LIMITS, getPlan, judgeQuota, quotaSummary } from '@/lib/config/plans';
import { GET } from '@/app/api/web-search/quota/route';

beforeEach(() => {
  vi.clearAllMocks();
  state.guard.mockResolvedValue({ ok: true, userId: 'session-user' });
  state.rpc.mockImplementation(async (name: string, args: any) => name === 'kaiwu_web_search'
    ? { data: { plan: 'basic', limit: 20, used: 0, pending: 1, remaining: 19, allowed: true, requestId: args.p_request_id }, error: null }
    : { error: null });
});

describe('联网授权与真实工具计次', () => {
  it.each(['请联网核实平台规则','今天最新新闻是什么','搜索近期餐饮行业行情'])('按需识别 %s', q => expect(wantsWebSearch(q)).toBe(true));
  it.each(['帮我改写下面这段文案','把脚本拆成分镜','无需联网，优化标题'])('资料创作不执行付费搜索 %s', q => expect(wantsWebSearch(q)).toBe(false));
  it('用户关闭联网优先于关键词，主动联网才申请额度', async () => {
    expect(wantsWebSearch('联网查新闻', 'off')).toBe(false);
    const off = await prepareWebSearch('u','联网查新闻','off');
    expect(off.inputs.web_search_enabled).toBe('0'); expect(state.rpc).not.toHaveBeenCalled();
    expect((await prepareWebSearch('u','餐饮门店','on')).inputs.web_search_enabled).toBe('1');
  });
  it('额度来自认证账号，套餐限制由服务端配置，不能由页面伪造', async () => {
    await prepareWebSearch('verified-user','联网');
    expect(state.rpc.mock.calls[0][1]).toMatchObject({ p_user_id: 'verified-user', p_limits: { free: 3, basic: 20, pro: 60, enterprise: 150 } });
  });
  it('达到上限后关闭工作流搜索，但允许模型基于现有资料回答', async () => {
    state.rpc.mockResolvedValue({ data: { allowed: false, reason: 'quota_exhausted', remaining: 0, limit: 20 }, error: null });
    const s = await prepareWebSearch('u','联网');
    expect(s.enabled).toBe(false); expect(s.inputs.web_search_enabled).toBe('0');
    expect(s.initialEvent?.status).toBe('quota_exhausted'); expect(s.inputs.web_search_note).toContain('已有资料');
  });
  it('数据库异常时不放行付费搜索', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'database timeout' } });
    expect((await prepareWebSearch('u','联网')).enabled).toBe(false);
  });
  it('预占不是普通生成计数，实际工具开始只提交一次', async () => {
    const s = await prepareWebSearch('u','联网');
    expect(state.rpc).toHaveBeenCalledTimes(1);
    await s.observe({ event: 'node_started', data: { title: '知识检索' } });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    await s.observe({ event: 'node_started', data: { title: 'Tavily Search' } });
    await s.observe({ event: 'node_finished', data: { title: 'Tavily Search' } });
    await s.observe({ event: 'message_end' }); await s.finish();
    expect(state.rpc.mock.calls.filter(c => c[0] === 'kaiwu_settle_web_search')).toHaveLength(1);
    expect(state.rpc.mock.calls[1][1].p_state).toBe('started');
  });
  it('请求在工作流启动前被明确拒绝，释放预占', async () => {
    const s = await prepareWebSearch('u','联网'); await s.rejected(400);
    expect(state.rpc.mock.calls[1][1].p_state).toBe('released');
  });
  it('已执行搜索后，模型答复失败仍计联网调用', async () => {
    const s = await prepareWebSearch('u','联网');
    await s.observe({ event: 'node_started', data: { title: 'Tavily Search' } });
    await s.observe({ event: 'error' }); await s.finish();
    expect(state.rpc.mock.calls.filter(c => c[1].p_state === 'released')).toHaveLength(0);
  });
  it('更换为阿里云后，开始和完成事件仍只计一次，模型失败不返还次数', async () => {
    const s = await prepareWebSearch('u', '联网');
    await s.observe({ event: 'node_started', data: { title: '准备搜索请求' } });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    await s.observe({ event: 'node_started', data: { title: '阿里云联网搜索 Lite', node_id: '1790086576262' } });
    await s.observe({ event: 'node_finished', data: { title: '阿里云联网搜索 Lite', node_id: '1790086576262' } });
    await s.observe({ event: 'error' }); await s.finish();
    expect(state.rpc.mock.calls.filter(c => c[0] === 'kaiwu_settle_web_search')).toHaveLength(1);
    expect(state.rpc.mock.calls[1][1].p_state).toBe('started');
    expect(state.rpc.mock.calls.filter(c => c[1].p_state === 'released')).toHaveLength(0);
  });
  it('付费搜索固定 ID 改名后仍不能绕过记账', async () => {
    const s = await prepareWebSearch('u', '联网');
    await s.observe({ event: 'node_started', data: { title: '搜索', node_id: '1790086576262' } });
    await s.observe({ event: 'error' }); await s.finish();
    expect(state.rpc.mock.calls[1][1].p_state).toBe('started');
  });
  it('工作流确认失败且未启动搜索，释放预占', async () => {
    const s = await prepareWebSearch('u','联网'); await s.observe({ event: 'error' }); await s.finish();
    expect(state.rpc.mock.calls[1][1].p_state).toBe('released');
  });
  it('上游连接未知时保留预占，不能用断线绕过额度', async () => {
    const s = await prepareWebSearch('u','联网'); await s.rejected(500); await s.finish();
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('套餐和联网额度展示', () => {
  it('高频创作和知识均有限额，不能被旧企业版分支放行', () => {
    expect(getPlan('enterprise').name).toBe('高频会员');
    expect(judgeQuota('enterprise','script',{script_used:299}).allowed).toBe(true);
    expect(judgeQuota('enterprise','script',{script_used:300}).allowed).toBe(false);
    expect(judgeQuota('enterprise','knowledge',{knowledge_used:600}).allowed).toBe(false);
    expect(quotaSummary('enterprise').join(' ')).not.toContain('不限次数');
    for(const [id,limit] of Object.entries(WEB_SEARCH_LIMITS)) expect(quotaSummary(id).join(' ')).toContain(`联网搜索：${limit} 次`);
  });
  it('额度查询只读登录账号，认证失败不访问数据库', async () => {
    state.guard.mockResolvedValue({ok:false,response:new Response('unauthenticated',{status:401})});
    expect((await GET()).status).toBe(401); expect(state.rpc).not.toHaveBeenCalled();
    state.guard.mockResolvedValue({ok:true,userId:'current-account'});
    expect((await GET()).status).toBe(200); expect(state.rpc.mock.calls[0][1].p_user_id).toBe('current-account');
  });
  it('余额服务暂时失败时返回503且不缓存，恢复后可以再次查询', async () => {
    state.rpc.mockResolvedValueOnce({ data: null, error: { code: 'TEMPORARY', message: 'unavailable' } });
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(failed.headers.get('Cache-Control')).toBe('no-store');
    expect(await failed.json()).toEqual({ error: '联网额度暂时无法查询' });
    const recovered = await GET();
    expect(recovered.status).toBe(200);
    expect(recovered.headers.get('Cache-Control')).toBe('no-store');
  });
  it('SQL私有函数和行锁保护并发，试用不重新发放', () => {
    const sql=fs.readFileSync('supabase/migrations/20261001_web_search_quotas.sql','utf8');
    expect(sql).toContain('FOR UPDATE'); expect(sql).toContain("v_period text := 'trial'");
    expect(sql).toContain('FROM PUBLIC, anon, authenticated'); expect(sql).toContain('v_used + v_pending < v_limit');
  });
  it('已保存的工作流只允许true分支调用搜索，缺少输入默认关闭', async () => {
    const yaml=require('js-yaml');
    const doc=yaml.load(fs.readFileSync('docs/dify/小宋编导文案工作台.yml','utf8')) as any;
    const g=doc.workflow.graph; const search=g.nodes.find((n:any)=>n.data.title==='Tavily Search');
    const incoming=g.edges.filter((e:any)=>e.target===search.id);
    expect(incoming).toHaveLength(1); expect(incoming[0]).toMatchObject({source:'web_search_gate',sourceHandle:'true'});
    expect(g.nodes.find((n:any)=>n.id==='start').data.variables.find((v:any)=>v.variable==='web_search_enabled').default).toBe('0');
    expect(search.data.retry_config.retry_enabled).toBe(false);
    expect(g.nodes.find((n:any)=>n.data.type==='llm').data.prompt_template.some((p:any)=>(p.text||'').includes('{{#web_search_merge.output#}}'))).toBe(true);
  });
});
