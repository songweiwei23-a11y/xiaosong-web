import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
const env=vi.hoisted(()=>({db:null as any,ask:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({getServiceSupabase:()=>env.db}));
vi.mock('@/lib/dify-task',()=>({askDify:(...args:unknown[])=>env.ask(...args)}));
import { runResearch, runResearchPlan, isStale, recoverResearchJobs } from '@/lib/research-runner';
const id='22222222-2222-4222-8222-222222222222', user='11111111-1111-4111-8111-111111111111', request='55555555-5555-4555-8555-555555555555';
const config={endpoint:'https://example.opensearch.aliyuncs.com/web-search/test',apiKey:'isolated-key',source:'env' as const};
beforeEach(()=>{
  vi.clearAllMocks();
  env.db=createFakeDb({research_jobs:[{id,user_id:user,topic:'公开行业研究',depth:'quick',status:'running',plan:{title:'研究报告',questions:[{q:'消费者需求',queries:['公开搜索']} ]},steps:[],context:'',quota_request_id:request,heartbeat_at:null}],research_requests:[{id:request,status:'reserved'}],research_sources:[]});
  env.db.rpc=vi.fn().mockResolvedValue({error:null,data:{}});
  env.ask.mockResolvedValue({ok:true,text:'已有来源中的信息[1]。'});
});
const sources = vi.fn().mockResolvedValue({ok:true,hits:[{url:'https://example.com/report',title:'公开报告',content:'真实需求来源内容。'.repeat(40),published:''}]});
const open = vi.fn().mockResolvedValue({ok:true,html:'<article><p>'+ '真实需求来源内容。'.repeat(50) + '</p></article>',url:'https://example.com/report',contentType:'text/html'});
describe('研究后台真实执行状态',()=>{
  it('增强检索保持原计划的搜索数量，带日期并使用深度正文解析',async()=>{
    const search=vi.fn().mockImplementation(()=>sources());
    await runResearch(id,{config,search,fetch:open});
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][2]).toMatchObject({way:'pro-fetch',topK:8,rewrite:true,today:expect.stringMatching(/^\d{4}年\d{1,2}月\d{1,2}日$/)});
    expect(env.db.tables.research_jobs[0].status).toBe('done');
  });
  it('Markdown官方正文不会被HTML标签清洗丢掉，正文失败不会伪装全文',async()=>{
    const raw='参数必须填写 <model_name>，保留原文。'.repeat(30);
    const fetch=vi.fn().mockResolvedValue({ok:true,url:'https://example.com/report',contentType:'text/markdown',html:raw});
    await runResearch(id,{config,search:sources,fetch});
    expect(env.db.tables.research_sources[0]).toMatchObject({fetched:'full',content:raw});
  });
  it('广告来源被剔除而真实来源仍入库，搜索和研究额度不重复扣',async()=>{
    const search=vi.fn().mockResolvedValue({ok:true,hits:[{url:'https://example.com/ad',title:'十大短视频服务商排行榜',content:'营销广告'.repeat(200),published:''},(await sources()).hits[0]]});
    await runResearch(id,{config,search,fetch:open});
    expect(env.db.tables.research_sources).toHaveLength(1);
    expect(env.db.tables.research_sources[0].url).toBe('https://example.com/report');
    expect(env.db.rpc.mock.calls.filter((x:any[])=>x[0]==='kaiwu_settle_research')).toHaveLength(1);
  });
  it('两个子问题可复用同一网页，只读取和存储一份证据',async()=>{
    env.db.tables.research_jobs[0].plan.questions.push({q:'另一个问题',queries:['同一个公开来源']});
    const search=vi.fn().mockImplementation(()=>sources()),fetch=vi.fn().mockImplementation(()=>open());
    await runResearch(id,{config,search,fetch});
    expect(env.db.tables.research_jobs[0].steps.map((s:any)=>s.status)).toEqual(['done','done']);expect(fetch).toHaveBeenCalledTimes(1);expect(env.db.tables.research_sources).toHaveLength(1);expect(env.db.tables.research_sources[0].collected_at).toBeTruthy();
  });
  it('补跑失败章节时不删去另一章节仍在引用的来源',async()=>{
    env.db.tables.research_jobs[0].plan.questions.push({q:'已有完整章节',queries:['不用重跑']});
    env.db.tables.research_jobs[0].steps=[{status:'failed'},{status:'done',note:'已有信息[1]',sources:[1]}];
    env.db.tables.research_sources=[{job_id:id,n:1,step:0,url:'https://example.com/report',title:'已有来源',site:'example.com',published:'',fetched:'full',content:'真实需求内容'.repeat(80),collected_at:'2026-10-04T00:00:00Z'}];
    const fetch=vi.fn();await runResearch(id,{config,search:sources,fetch});expect(fetch).not.toHaveBeenCalled();expect(env.db.tables.research_sources).toHaveLength(1);expect(env.db.tables.research_jobs[0].steps.map((s:any)=>s.status)).toEqual(['done','done']);
  });
  it('写入来源必须挂任务；报告完成，搜索只记一次',async()=>{
    await runResearch(id,{config,search:sources,fetch:open});
    const j=env.db.tables.research_jobs[0]; expect(j.status).toBe('done'); expect(j.report).toContain('参考来源');
    expect(env.db.tables.research_sources[0].job_id).toBe(id);
    expect(env.db.rpc.mock.calls.filter((x:any[])=>x[0]==='kaiwu_settle_research')).toEqual([['kaiwu_settle_research',{p_request_id:request,p_state:'started'}]]);
    expect(j.run_token).toBeNull();
  });
  it('停止不能被后台保存覆盖，已有搜索仍计一次',async()=>{
    const stopSearch=vi.fn(async()=>{env.db.tables.research_jobs[0].status='canceled';return {ok:true as const,hits:[]};});
    await runResearch(id,{config,search:stopSearch,fetch:open});
    expect(env.db.tables.research_jobs[0].status).toBe('canceled');
    expect(env.db.rpc.mock.calls.some((x:any[])=>x[1].p_state==='released')).toBe(false);
  });
  it('无任何成功搜索时失败释放，原历史报告不清空',async()=>{
    env.db.tables.research_jobs[0].report='上次报告';
    await runResearch(id,{config,search:vi.fn().mockResolvedValue({ok:false,reason:'network'}),fetch:open});
    expect(env.db.tables.research_jobs[0].status).toBe('failed');expect(env.db.tables.research_jobs[0].report).toBe('上次报告');
    expect(env.db.rpc).toHaveBeenCalledWith('kaiwu_settle_research',{p_request_id:request,p_state:'released'});
  });
  it('服务器重启只补结论，保留已完成的来源，不重复搜索',async()=>{
    env.db.tables.research_jobs[0].status='writing'; env.db.tables.research_jobs[0].steps=[{status:'done',note:'信息[1]',read:1}];
    env.db.tables.research_sources=[{job_id:id,n:1,step:0,url:'https://example.com/report',title:'报告',site:'example.com',published:'',fetched:'full',content:'信息'}];
    env.db.tables.research_requests[0].status='started';
    const noSearch=vi.fn(); await runResearch(id,{config,search:noSearch,fetch:open});
    expect(noSearch).not.toHaveBeenCalled();expect(env.db.tables.research_sources).toHaveLength(1);
    expect(env.db.tables.research_jobs[0].status).toBe('done');
    expect(env.db.rpc).not.toHaveBeenCalled();
  });
  it('结论生成失败保留各节报告，允许后续只补结论',async()=>{
    env.ask.mockResolvedValueOnce({ok:true,text:'本节事实[1]'}).mockResolvedValue({ok:false,message:'模型失败'});
    await runResearch(id,{config,search:sources,fetch:open});
    expect(env.db.tables.research_jobs[0]).toMatchObject({status:'done',summary_failed:true});
    expect(env.db.tables.research_jobs[0].report).toContain('本节事实');
  });
  it('同任务执行权已被其他进程续租时不能抢任务',async()=>{
    env.db.tables.research_jobs[0].heartbeat_at=new Date().toISOString();
    const noSearch=vi.fn();await runResearch(id,{config,search:noSearch,fetch:open});expect(noSearch).not.toHaveBeenCalled();
    expect(isStale({status:'running',heartbeat_at:new Date().toISOString()})).toBe(false);
  });
  it('计划失败返还占位；计划成功即使浏览器关闭仍写入数据库',async()=>{
    env.db.tables.research_jobs[0].status='planning';
    env.ask.mockResolvedValue({ok:true,text:JSON.stringify({title:'市场研究',questions:[{q:'真实问题',queries:['具体搜索']}],materialSummary:'附件存在不一致信息'})});
    await runResearchPlan(id); expect(env.db.tables.research_jobs[0].status).toBe('plan_ready');expect(env.db.tables.research_jobs[0].context).toContain('未经独立核实');
    env.db.tables.research_jobs[0].status='planning';env.db.tables.research_jobs[0].heartbeat_at=null;env.ask.mockResolvedValue({ok:false,message:'失败'});
    await runResearchPlan(id);expect(env.db.tables.research_jobs[0].status).toBe('failed');
    expect(env.db.rpc).toHaveBeenCalledWith('kaiwu_settle_research',{p_request_id:request,p_state:'released'});
  });
  it('六小时未确认自动释放占位并保留计划历史',async()=>{
    env.db.tables.research_jobs[0].status='plan_ready';env.db.tables.research_jobs[0].updated_at=new Date(Date.now()-7*3600_000).toISOString();
    await recoverResearchJobs();expect(env.db.tables.research_jobs[0].plan).toBeTruthy();
    expect(env.db.rpc).toHaveBeenCalledWith('kaiwu_expire_research',{p_job_id:id});
  });
  it('搜索未成功就停止时返还占位，不再读网页或写报告',async()=>{
    const search=vi.fn(async()=>{env.db.tables.research_jobs[0].status='canceled';return {ok:false as const,reason:'network' as const};});
    const fetch=vi.fn(), ask=vi.fn();
    await runResearch(id,{config,search,fetch,ask});
    expect(env.db.tables.research_jobs[0].status).toBe('canceled');
    expect(env.db.rpc).toHaveBeenCalledWith('kaiwu_settle_research',{p_request_id:request,p_state:'released'});
    expect(fetch).not.toHaveBeenCalled();expect(ask).not.toHaveBeenCalled();
    expect(env.db.tables.research_jobs[0].run_token).toBeNull();
  });
  it('用户停止拟计划后，模型失败也不能再发第二次请求',async()=>{
    env.db.tables.research_jobs[0].status='planning';
    env.ask.mockImplementation(async()=>{env.db.tables.research_jobs[0].status='canceled';return {ok:false,message:'连接中断'};});
    await runResearchPlan(id);
    expect(env.ask).toHaveBeenCalledTimes(1);expect(env.db.tables.research_jobs[0]).toMatchObject({status:'canceled',run_token:null});
  });
});
