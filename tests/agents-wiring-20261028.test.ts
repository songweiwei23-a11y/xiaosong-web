/**
 * 代理分成的权限与接线（2026-10-28）。
 * - 权限矩阵：只有管理员和开发者能开通代理、结算、看代理；其它后台角色一律没有。
 * - 代理接口：身份只从会话取，查询一律带代理自己的 id，不接受前端传代理 id。
 * - 代理不进 admin_roles：那张表一有记录就算管理员（会绕过首页拦截）。
 * - 接线：中间件让 /agent 要求登录，后台导航有入口，迁移登记在册。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS, hasPermission, isKnownRole } from '@/lib/admin-permissions';
import { MIGRATION_REGISTRY } from '@/lib/migration-registry';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('权限矩阵：代理相关的三项权限只给管理员和开发者', () => {
  const agentPerms = ['manage_agents', 'settle_commissions', 'view_agents'] as const;

  it('管理员和开发者都有', () => {
    for (const role of ['admin', 'developer']) {
      for (const p of agentPerms) expect(hasPermission(role, p)).toBe(true);
    }
  });

  it('运营、财务、客服、只读分析都没有', () => {
    for (const role of ['operator', 'finance', 'support', 'analyst']) {
      for (const p of agentPerms) expect(hasPermission(role, p)).toBe(false);
    }
  });

  it('「代理」不是后台角色：认不出来，后台的任何权限都没有', () => {
    expect(isKnownRole('agent')).toBe(false);
    expect(ROLE_PERMISSIONS['agent']).toBeUndefined();
    expect(hasPermission('agent', 'view_agents')).toBe(false);
  });
});

describe('代理接口：身份从会话取，查询只按代理自己的 id', () => {
  const agentRoutes = [
    'app/api/agent/summary/route.ts',
    'app/api/agent/codes/route.ts',
    'app/api/agent/customers/route.ts',
    'app/api/agent/bills/route.ts',
  ];

  it('每个代理接口都先要求代理身份', () => {
    for (const f of agentRoutes) expect(read(f), f).toContain('await requireAgent()');
  });

  it('不接受前端传来的代理 id（既不读查询串，也不读请求体）', () => {
    for (const f of agentRoutes) {
      const src = read(f);
      expect(src, f).not.toMatch(/searchParams\.get\(['"]agent/);
      expect(src, f).not.toMatch(/body\.agent(Id|_id)/);
    }
  });

  it('生成的邀请码归在当前代理名下，并且不是管理员生成的', () => {
    const src = read('app/api/agent/codes/route.ts');
    expect(src).toContain('agent_id: agent.agentId');
    expect(src).toContain("created_by_admin: false");
    expect(src).toContain('max_uses: AGENT_CODE_MAX_USES');
    expect(src).toContain(".eq('agent_id', agent.agentId)");
  });

  it('客户、账单、分成的数据函数都以代理 id 为条件', () => {
    const src = read('lib/agent-data.ts');
    expect(src).toContain(".eq('agent_id', agentId)");
    expect(src).toContain("from('agent_referrals')");
  });

  it('代理身份只看 agents 表，不查 admin_roles（代理不能因此成为管理员）', () => {
    // 只看代码里的查询，不看注释（注释里会解释为什么不用 admin_roles）
    for (const f of ['lib/agent-auth.ts', 'lib/agent-data.ts', 'lib/agents.ts']) {
      expect(read(f), f).not.toMatch(/from\(['"]admin_roles['"]\)/);
    }
    expect(read('lib/agent-auth.ts')).toContain("from('agents')");
  });

  it('代理看到客户的完整邮箱（2026-10-28 确认），但不给生成内容', () => {
    const src = read('lib/agent-data.ts');
    expect(src).toContain('email: emails.get(r.user_id)');
    expect(src).toContain('email: emails.get(o.user_id)');
    expect(src).not.toMatch(/maskEmail/);
    expect(read('app/api/agent/customers/route.ts')).not.toMatch(/script_history|generations/);
  });
});

describe('管理员看用户：显示来源代理（2026-10-28）', () => {
  it('用户列表和详情都带上来源代理，读不到归属时不影响用户列表', () => {
    const src = read('app/api/admin/users/route.ts');
    expect(src).toContain("import { referrersOf, type ReferrerInfo } from '@/lib/agent-data';");
    expect(src).toContain('referrer: referrerView(referrers.get(r.id)),');
    expect(src).toContain('referrer: referrerView(referrer),');
    // 归属读取失败只记日志，不让用户列表报错
    expect(src).toMatch(/try \{\s*referrers = await referrersOf\(supabase, ids\);\s*\} catch/);
  });

  it('用户页：有「来源代理」一列，详情弹窗有一行「来源代理」', () => {
    const page = read('app/admin/users/page.tsx');
    expect(page).toContain('key: "referrer"');
    expect(page).toContain('header: "来源代理"');
    expect(page).toContain('直接注册');
    expect(page).toContain('detail.data.referrer');
  });
});

describe('管理员接口：每个接口都声明自己要的权限', () => {
  it('代理列表和结算记录要看代理的权限；开通、改状态、改费率要管理代理的权限；结算要结算的权限', () => {
    const list = read('app/api/admin/agents/route.ts');
    expect(list).toMatch(/export async function GET[\s\S]*?requireAdminPermission\('view_agents'\)/);
    expect(list).toMatch(/export async function POST[\s\S]*?requireAdminPermission\('manage_agents'\)/);
    expect(list).toMatch(/export async function PATCH[\s\S]*?requireAdminPermission\('manage_agents'\)/);

    const settle = read('app/api/admin/agents/settle/route.ts');
    expect(settle).toMatch(/export async function GET[\s\S]*?requireAdminPermission\('view_agents'\)/);
    expect(settle).toMatch(/export async function POST[\s\S]*?requireAdminPermission\('settle_commissions'\)/);
  });

  it('结算只能结过完的月份，并且写日志', () => {
    const settle = read('app/api/admin/agents/settle/route.ts');
    expect(settle).toContain('canSettlePeriod(period)');
    expect(settle).toContain('AdminActions.SETTLE_AGENTS');
  });

  it('开通代理、改费率、改状态都写日志', () => {
    const src = read('app/api/admin/agents/route.ts');
    expect(src).toContain('AdminActions.CREATE_AGENT');
    expect(src).toContain('AdminActions.SET_AGENT_RATE');
    expect(src).toContain('AdminActions.SET_AGENT_STATUS');
  });
});

describe('代理入口和招募提示（2026-10-28 第二版）', () => {
  it('头像菜单：「代理后台」只对代理显示，指向工作台里的 /dashboard/agent', () => {
    const src = read('components/auth/UserProfile.tsx');
    expect(src).toMatch(/\{agent\?\.isAgent && \(\s*<Link[^>]*href="\/dashboard\/agent"/);
    expect(src).toContain('href="/dashboard/account"');
    expect(src).toContain('href="/dashboard/membership"');
  });

  it('/api/agent/me 只回答是不是代理和显示名，不带任何客户或金额', () => {
    const src = read('app/api/agent/me/route.ts');
    expect(src).toContain('await requireAgent()');
    expect(src).toContain("{ isAgent: true, displayName: agent.displayName }");
    expect(src).not.toMatch(/agent-data|referrals|commission/);
  });

  it('招募横幅：查询没出结果、已经是代理、或者关掉过，都不显示；联系方式用全站客服微信；不公开具体比例', () => {
    const src = read('components/agent/AgentRecruitBanner.tsx');
    expect(src).toContain('if (!agent || agent.isAgent || dismissed) return null;');
    expect(src).toContain('SUPPORT_WECHAT');
    expect(src).not.toMatch(/commission_rate|currentRate|\d+%/);
    expect(read('app/dashboard/page.tsx')).toContain('<AgentRecruitBanner />');
  });

  it('代理后台在工作台里，旧地址 /agent 跳到新地址；不再用管理后台的组件', () => {
    expect(read('app/agent/page.tsx')).toContain('redirect("/dashboard/agent")');
    const page = read('app/dashboard/agent/page.tsx');
    expect(page).not.toContain('@/components/admin/kit');
    for (const api of ['/api/agent/summary', '/api/agent/codes', '/api/agent/customers', '/api/agent/bills']) expect(page).toContain(api);
  });
});

describe('接线：中间件、后台导航、迁移登记', () => {
  it('中间件让 /agent 要求登录', () => {
    expect(read('middleware.ts')).toMatch(/SESSION_PATHS\s*=\s*\[[^\]]*'\/agent'/);
  });

  it('后台导航有「代理分成」入口', () => {
    expect(read('app/admin/layout.tsx')).toContain('href: "/admin/agents"');
  });

  it('迁移文件存在，并且登记在迁移注册表里', () => {
    expect(existsSync(join(root, 'supabase/migrations/20261028_agents.sql'))).toBe(true);
    const entry = MIGRATION_REGISTRY.find((e) => e.file === '20261028_agents.sql');
    expect(entry).toBeDefined();
    expect(entry!.tables).toEqual(expect.arrayContaining(['agents', 'agent_program_settings', 'agent_referrals', 'agent_settlements']));
    expect(entry!.columns).toEqual(expect.arrayContaining([{ table: 'invitation_codes', column: 'agent_id' }]));
  });

  it('迁移：四张表启用 RLS 并收回 anon / authenticated 的权限；代理码的 agent_id 列带索引', () => {
    const sql = read('supabase/migrations/20261028_agents.sql');
    for (const t of ['agents', 'agent_program_settings', 'agent_referrals', 'agent_settlements']) {
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    }
    expect(sql).toMatch(/REVOKE ALL ON public\.agents, public\.agent_program_settings, public\.agent_referrals, public\.agent_settlements FROM anon, authenticated;/);
    expect(sql).toContain('invitation_codes_agent_idx');
  });

  it('结算的快照表：同一代理同一个月只能有一条', () => {
    expect(read('supabase/migrations/20261028_agents.sql')).toContain('UNIQUE (agent_id, period)');
  });
});
