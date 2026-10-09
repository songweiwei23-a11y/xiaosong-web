import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({admin:vi.fn(),rpc:vi.fn(),from:vi.fn(),service:vi.fn(),select:vi.fn()}));
vi.mock('@/lib/admin-auth',()=>({requireAdmin:()=>state.admin(),getServiceSupabase:()=>{state.service();return {rpc:state.rpc,from:state.from};}}));
import { GET,POST } from '@/app/api/admin/quota/reconcile/route';
const owner='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new Request('http://localhost/api/admin/quota/reconcile',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{
  vi.clearAllMocks();state.admin.mockResolvedValue({userId:owner});state.rpc.mockResolvedValue({data:{dryRun:true,counted:0,results:[]}});
  const query:any={select:state.select,eq:()=>query,order:()=>query,limit:async()=>({data:[],error:null})};state.select.mockReturnValue(query);state.from.mockReturnValue(query);
});
describe('admin quota evidence reconciliation',()=>{
  it('refuses nonadmins before touching privileged data',async()=>{
    state.admin.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);expect((await POST(request({}))).status).toBe(403);
    expect(state.service).not.toHaveBeenCalled();
  });
  it('defaults to evidence-only automatic preview',async()=>{
    const response=await POST(request({}));expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('kaiwu_reconcile_creation',{p_actor:owner,p_requests:null,p_dry_run:true});
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('requires explicit false to execute, passes scoped ids',async()=>{
    const rows=[{userId:owner,requestId:'valid-request-id-12345'}];
    await POST(request({requests:rows,dryRun:false}));
    expect(state.rpc.mock.calls[0][1]).toEqual({p_actor:owner,p_requests:rows,p_dry_run:false});
  });
  it.each([{requests:Array(51).fill({userId:owner,requestId:'valid-request-id-12345'})},{requests:[{userId:'foreign-invalid',requestId:'short'}]},{requests:'all'}])('rejects malformed or oversized batches without mutation',async(body)=>{
    expect((await POST(request(body))).status).toBe(400);expect(state.rpc).not.toHaveBeenCalled();
  });
  it('audit/database error does not claim success or leak private errors',async()=>{
    state.rpc.mockResolvedValue({error:{message:'secret database stack'}});
    const response=await POST(request({dryRun:false}));expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret');
  });
  it('pending list includes proof metadata but excludes full generated body',async()=>{
    expect((await GET()).status).toBe(200);
    const columns=state.select.mock.calls[0][0] as string;
    expect(columns).toContain('content_chars,result_sha256,terminal');
    expect(columns).not.toMatch(/\bresult\b/);
  });
});
