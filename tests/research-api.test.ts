import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fake-supabase';
const env=vi.hoisted(()=>({ userId:'11111111-1111-4111-8111-111111111111', auth:true,db:null as any,quota:vi.fn(),config:vi.fn(),after:vi.fn() }));
vi.mock('next/server',()=>({after:(f:unknown)=>env.after(f)}));
vi.mock('@/lib/api-guard',()=>({requireUser:async()=>env.auth?{ok:true,userId:env.userId}:{ok:false,response:new Response(null,{status:401})},requireUserWithQuota:async()=>env.auth?{ok:true,userId:env.userId}:{ok:false,response:new Response(null,{status:401})}}));
vi.mock('@/lib/admin-auth',()=>({getServiceSupabase:()=>env.db}));
vi.mock('@/lib/search-config',()=>({getSearchConfig:()=>env.config()}));
vi.mock('@/lib/research-runner',()=>({readResearchQuota:()=>env.quota(),quotaMessage:()=> '仅高级会员可用',isStale:()=>false,runResearch:vi.fn(),runResearchPlan:vi.fn()}));
import { GET, POST, PATCH } from '@/app/api/research/route';
const id='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333', profile='44444444-4444-4444-8444-444444444444';
const req=(method:string, body:unknown)=>new Request('http://localhost/api/research',{method,body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
const payload={requestId:id,topic:'家具门店市场研究',depth:'quick'};
beforeEach(()=>{
  env.auth=true; vi.clearAllMocks();
  env.db=createFakeDb({research_jobs:[{id,user_id:env.userId,profile_id:null,status:'done',depth:'quick',report:'本人报告'},{id:other,user_id:'someone-else',status:'done',report:'别人的报告'}],research_sources:[{job_id:id,n:1,title:'来源'}],user_profiles:[]});
  env.db.rpc=vi.fn().mockResolvedValue({data:{allowed:true,id,status:'planning',found:true},error:null});
  env.quota.mockResolvedValue({allowed:true,limit:10,remaining:10,plan:'pro'});env.config.mockResolvedValue({apiKey:'not-exposed'});
});
describe('研究API权限和实际读取',()=>{
  it('null或数组请求不触发后台任务',async()=>{for(const body of [null,[],1]) {expect((await POST(req('POST',body))).status).toBe(400);expect((await PATCH(req('PATCH',body))).status).toBe(400);}expect(env.after).not.toHaveBeenCalled();});
  it('未登录所有入口拒绝，不能触碰特权RPC',async()=>{env.auth=false; expect((await GET(new Request('http://localhost/api/research'))).status).toBe(401);expect((await POST(req('POST',payload))).status).toBe(401);expect((await PATCH(req('PATCH',{id,action:'start'}))).status).toBe(401);expect(env.db.rpc).not.toHaveBeenCalled();});
  it('列表只含本人，按当前档案筛选；具体任务不能跨账号',async()=>{
    const r=await GET(new Request('http://localhost/api/research?list=1&profileId=default'));expect((await r.json()).items).toHaveLength(1);
    expect((await GET(new Request('http://localhost/api/research?id='+other))).status).toBe(404);
    expect((await GET(new Request('http://localhost/api/research?id='+id+'&profileId='+profile))).status).toBe(404);
  });
  it('不能伪造其他账号的档案或附件',async()=>{expect((await POST(req('POST',{...payload,profileId:profile}))).status).toBe(403);expect(env.db.rpc).not.toHaveBeenCalled();});
  it('免费及基础会员在任何模型调用前被拦截',async()=>{env.quota.mockResolvedValue({allowed:false,limit:0,reason:'plan_not_included'});expect((await POST(req('POST',payload))).status).toBe(402);expect(env.db.rpc).not.toHaveBeenCalled();expect(env.after).not.toHaveBeenCalled();});
  it('未配置搜索或数据库报错明确失败，不伪装成功',async()=>{env.config.mockResolvedValue(null);expect((await POST(req('POST',payload))).status).toBe(503);env.config.mockResolvedValue({});env.db.rpc.mockResolvedValue({error:{message:'schema cache'}});expect((await POST(req('POST',payload))).status).toBe(503);expect(env.after).not.toHaveBeenCalled();});
  it('拟计划调用原子RPC，同请求编号直接传入，不扣普通对话',async()=>{const r=await POST(req('POST',payload));expect(r.status).toBe(200);expect(env.db.rpc).toHaveBeenCalledWith('kaiwu_create_research',expect.objectContaining({p_user_id:env.userId,p_request_id:id,p_limits:{free:0,basic:0,pro:10,enterprise:30}}));expect(env.after).toHaveBeenCalledTimes(1);});
  it('启动时计划按深度限量，空计划拒绝',async()=>{expect((await PATCH(req('PATCH',{id,action:'start',plan:{questions:[]}}))).status).toBe(400);await PATCH(req('PATCH',{id,action:'start',plan:{title:'研究',questions:Array.from({length:9},()=>({q:'问题',queries:['搜索']}))}}));expect(env.db.rpc.mock.calls[0][1].p_plan.questions).toHaveLength(4);});
  it('停止由数据库处理归属和状态，失败不显示已停止',async()=>{env.db.rpc.mockResolvedValue({error:{message:'private details'}});const r=await PATCH(req('PATCH',{id,action:'cancel'}));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private details');});
  it('改稿仅保存本人已完成报告，原研究正文保留',async()=>{const r=await PATCH(req('PATCH',{id,action:'save_versions',versions:[{content:'编辑后',at:10}]}));expect(r.status).toBe(200);expect(env.db.tables.research_jobs[0].report).toBe('本人报告');expect(env.db.tables.research_jobs[0].canvas_versions[0].content).toBe('编辑后');expect((await PATCH(req('PATCH',{id:other,action:'save_versions',versions:[{content:'入侵',at:1}]}))).status).toBe(404);});
});
