"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { AdminPage, Badge, Button, ErrorState, Panel, StatCard } from "@/components/admin/kit";

/*
 * 管理概览：管理者进后台先看到的第一屏。
 * 上半部分是「今天要动手的」，每一项都能点进对应的页面；
 * 下半部分是今日数字和近 7 天走势；最下面是系统状态（真检查，不写死绿色）。
 */

interface Overview {
  todo: {
    reviewing: number;
    reviewingAmount: number;
    qualityFailures7d: number | null;
    negativeFeedback7d: number | null;
    expiringSoon: number | null;
  };
  today: { usage: number | null; paid: number; paidAmount: number };
  trend: { label: string; usage: number | null; paid: number | null }[];
  health: { db: boolean };
  tables: { quality: boolean; feedback: boolean };
  generatedAt: string;
}

interface Health {
  ok: boolean;
  label: string;
  note: string;
  checks: { name: string; ok: boolean; ms: number; detail?: string }[];
}

interface Stats {
  totalUsers: number;
  activeToday: number;
  /** 累计生成次数（从上线至今） */
  totalGenerations: number;
  /** 键跟着接口走：free/basic/pro/enterprise（lib/admin-stats 的 buildPlanDistribution） */
  subscriptionStats: Record<string, number>;
}

/** 付费会员数 = 除免费版以外所有档位之和。不按名字列举，加档位不会漏 */
const paidCount = (s: Record<string, number>) =>
  Object.entries(s).reduce((sum, [k, v]) => (k === "free" ? sum : sum + (Number(v) || 0)), 0);

const ROLE_LABEL: Record<string, string> = {
  developer: "超级管理员",
  admin: "管理员",
  operator: "运营",
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<Health | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // 会员结构取不到就不显示，不影响待办
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/overview");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取概览失败");
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealth(null);
    try {
      const res = await fetch("/api/admin/health");
      if (res.ok) setHealth(await res.json());
      else setHealth({ ok: false, label: "检查失败", note: `健康检查接口返回 ${res.status}`, checks: [] });
    } catch {
      setHealth({ ok: false, label: "检查失败", note: "健康检查接口连不上", checks: [] });
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/check-role");
        if (!res.ok) {
          // 绑定了验证器但本次没验：先去「账号安全」完成二次验证，而不是直接踢回首页
          const body = await res.json().catch(() => ({}));
          router.push(body.code === "mfa_required" ? "/admin/security" : "/");
          return;
        }
        const who = await res.json();
        setRole(who.role);
        setEmail(who.email);
      } catch {
        router.push("/");
      }
    })();
    void load();
    void loadStats();
    void checkHealth();
  }, [load, loadStats, checkHealth, router]);

  const todo = data?.todo;
  const maxBar = Math.max(1, ...(data?.trend ?? []).map((t) => Math.max(t.usage ?? 0, t.paid ?? 0)));

  return (
    <AdminPage
      title="管理概览"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {role && <Badge tone="accent">{ROLE_LABEL[role] ?? role}</Badge>}
          {email && <span>{email}</span>}
          <span>· 点卡片直接进入要处理的页面</span>
        </span>
      }
      actions={
        <Button variant="default" onClick={() => void load()} busy={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      }
    >
      {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}

      <Panel title="今天要处理的" className="mb-5">
        {loading && !data ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="待审核订单"
              value={todo?.reviewing ?? "—"}
              tone={todo && todo.reviewing > 0 ? "warn" : "ok"}
              hint={todo ? `涉及 ¥${todo.reviewingAmount}` : undefined}
              href="/admin/orders?status=reviewing"
            />
            <StatCard
              label="7 天内到期的付费会员"
              value={todo?.expiringSoon ?? "—"}
              tone={todo && (todo.expiringSoon ?? 0) > 0 ? "warn" : "default"}
              hint="可以提醒续费，或直接延期"
              href="/admin/subscriptions?expiringDays=7"
            />
            <StatCard
              label="近 7 天质检不通过"
              value={todo?.qualityFailures7d ?? "未启用"}
              tone={todo && (todo.qualityFailures7d ?? 0) > 0 ? "danger" : "default"}
              hint={data && !data.tables.quality ? "质检表还没建" : "生成结果踩禁忌、配比不对、年限不符"}
              href="/admin/quality"
            />
            <StatCard
              label="近 7 天「没用」的结果"
              value={todo?.negativeFeedback7d ?? "未启用"}
              tone={todo && (todo.negativeFeedback7d ?? 0) > 0 ? "warn" : "default"}
              hint={data && !data.tables.feedback ? "反馈表还没建" : "用户在结果下点了没用，可看原因"}
              href="/admin/analytics"
            />
          </div>
        )}
      </Panel>

      <Panel title="会员与活跃" className="mb-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="总用户" value={stats?.totalUsers ?? "—"} hint="以认证系统为准" />
          <StatCard label="近 7 天活跃" value={stats?.activeToday ?? "—"} hint="近 7 天有过用量变动的人数" />
          <StatCard label="付费会员" value={stats ? paidCount(stats.subscriptionStats) : "—"} tone="ok" hint="除免费版以外的全部档位" />
          <StatCard label="免费版" value={stats?.subscriptionStats.free ?? "—"} tone="muted" />
          <StatCard label="累计生成次数" value={stats?.totalGenerations ?? "—"} hint="从上线至今的生成总数" />
        </div>
      </Panel>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="近 7 天走势" action={<span className="text-[11.5px] text-muted-foreground">北京时间</span>}>
          {loading && !data ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="flex h-44 items-end gap-2">
              {(data?.trend ?? []).map((t) => (
                <div key={t.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/2 max-w-[14px] rounded-t bg-primary/70"
                      style={{ height: `${Math.round(((t.usage ?? 0) / maxBar) * 100)}%` }}
                      title={`使用 ${t.usage ?? "—"} 次`}
                    />
                    <div
                      className="w-1/2 max-w-[14px] rounded-t bg-emerald-400/80"
                      style={{ height: `${Math.round(((t.paid ?? 0) / maxBar) * 100)}%` }}
                      title={`付费 ${t.paid ?? "—"} 单`}
                    />
                  </div>
                  <span className="text-[10.5px] tabular-nums text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary/70" />使用次数</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400/80" />付费订单</span>
          </div>
        </Panel>

        <Panel title="今日">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="使用次数" value={data?.today.usage ?? "—"} hint="今天 0 点起" />
            <StatCard
              label="付费订单"
              value={data?.today.paid ?? "—"}
              tone="ok"
              hint={data ? `收款 ¥${data.today.paidAmount}` : undefined}
            />
          </div>
          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="mb-2 text-[12px] text-muted-foreground">常用入口</div>
            <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3">
              {[
                ["用户管理", "/admin/users"],
                ["会员管理", "/admin/subscriptions"],
                ["订单审核", "/admin/orders"],
                ["收款二维码", "/admin/qrcodes"],
                ["邀请码", "/admin/invitations"],
                ["质检看板", "/admin/quality"],
                ["数据分析", "/admin/analytics"],
                ["实时监控", "/admin/monitor"],
                ["操作日志", "/admin/logs"],
                ["权限管理", "/admin/permissions"],
                ["账号安全", "/admin/security"],
                ["系统设置", "/admin/settings"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="glass-panel glass-interactive rounded-xl border border-border/60 px-3 py-2 text-foreground/90">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="系统状态"
        action={
          <Button variant="default" size="sm" onClick={() => void checkHealth()} busy={health === null}>
            重新检查
          </Button>
        }
      >
        {health === null ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 检查中…
          </p>
        ) : (
          <div className="space-y-3">
            <p className={`text-[15px] font-semibold ${!health.ok ? "text-rose-400" : health.label === "运行正常" ? "text-emerald-400" : "text-amber-400"}`}>
              {health.label}
            </p>
            <p className="text-[12.5px] text-muted-foreground">{health.note}</p>
            {health.checks.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {health.checks.map((c) => (
                  <li key={c.name} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-[12.5px]">
                    <span className="text-foreground/90">{c.name}</span>
                    <span className={c.ok ? "text-emerald-400" : "text-rose-400"}>
                      {c.ok ? "正常" : "异常"} · {c.ms}ms
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {data && data.health && !data.health.db && (
          <p className="mt-3 text-[12.5px] text-rose-400">数据库读取失败，请先检查 Supabase 状态。</p>
        )}
      </Panel>
    </AdminPage>
  );
}
