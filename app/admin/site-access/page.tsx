"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { INPUT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Badge, Button, Panel } from "@/components/admin/kit";
import { INVITE_CLAIM_DAYS, INVITE_MAX_DEVICES } from "@/lib/gate-ticket-format";

/*
 * 首页门票（第一道）。没有门票的人连首页都看不到。
 * - 管理员：先生成自己的长期门票，用它在任何设备上直接进门；再开启拦截。
 * - 发邀请：给某个人发一张门票（邀请链接），有进门期限和设备数上限，随时可以撤销。
 * 门票原文只在生成的那一刻显示一次，之后列表里只有备注和状态。
 */

interface TicketRow {
  id: string;
  kind: "invite" | "admin";
  label: string;
  created_at: string;
  claim_until: string | null;
  max_devices: number;
  devices_used: number;
  revoked_at: string | null;
  status: "active" | "revoked" | "expired" | "full";
}

interface GateState {
  enabled: boolean;
  gateUnavailable: boolean;
  hasMyAdminTicket: boolean;
  adminLogin: boolean;
  tickets: TicketRow[];
}

interface Issued {
  title: string;
  link: string;
}

const STATUS_TEXT: Record<TicketRow["status"], string> = {
  active: "可用",
  revoked: "已撤销",
  expired: "已过进门期限",
  full: "设备已用完",
};

const TIME = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-CN") : "—");

export default function GatePage() {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [state, setState] = useState<GateState | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [label, setLabel] = useState("");
  const [claimDays, setClaimDays] = useState<number>(INVITE_CLAIM_DAYS.default);
  const [maxDevices, setMaxDevices] = useState<number>(INVITE_MAX_DEVICES.default);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/gate");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "读取失败");
    setState(d);
  };

  useEffect(() => {
    fetch("/api/admin/gate")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "读取失败");
        setState(d);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  /** 统一的操作入口：成功后刷新列表；返回接口给的数据（比如新门票原文） */
  const act = async (key: string, body: Record<string, unknown>, done: string) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "操作失败");
      await load();
      setNotice(done);
      return d as { secret?: string };
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const createAdmin = async () => {
    const d = await act("admin", { action: "create-admin" }, "已生成你的管理员门票。旧的管理员门票已作废；当前这台电脑已自动保留通过。");
    if (d?.secret) setIssued({ title: "你的管理员门票（在别的设备上打开这条链接即可进门）", link: `${origin}/?invite=${d.secret}` });
  };

  const createInvite = async () => {
    const d = await act(
      "invite",
      { action: "create-invite", label: label.trim(), claimDays, maxDevices },
      "门票已生成，把下面的链接发给对方。",
    );
    if (d?.secret) {
      setIssued({ title: `给「${label.trim()}」的邀请链接`, link: `${origin}/?invite=${d.secret}` });
      setLabel("");
    }
  };

  const setAdminLogin = (enabled: boolean) =>
    act(
      "admin-login",
      { action: "set-admin-login", enabled },
      enabled ? "应急登录已开启：门票丢了的管理员可以在提示页用邮箱、密码和验证器码进入。" : "应急登录已关闭。",
    );

  const setEnabled = (enabled: boolean) =>
    act("enabled", { action: "set-enabled", enabled }, enabled ? "首页拦截已开启。" : "首页拦截已关闭，所有人都能看首页。");

  const revoke = (id: string, title: string) => {
    if (!window.confirm(`撤销「${title}」？它发出去的所有设备都会立即（约 30 秒内）失效。`)) return;
    void act(`revoke-${id}`, { action: "revoke", id }, "门票已撤销。");
  };

  const copy = (text: string, done: string) => {
    void navigator.clipboard.writeText(text).then(() => setNotice(done), () => setError("复制失败，请手动选中复制"));
  };

  return (
    <AdminPage title="首页门票" subtitle="没有门票的人，连首页都看不到。管理员发门票，普通用户凭门票进门后才能注册、登录">
      <div className="mx-auto max-w-3xl space-y-5">
        {state?.gateUnavailable && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-400">
            读取不到首页拦截的设置，目前按「关门」处理。请检查数据库连接后刷新。
          </div>
        )}

        <Panel>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            {state?.enabled ? <Badge tone="ok">默认开启</Badge> : <Badge tone="warn">未开启</Badge>}
            <span className="text-muted-foreground">
              {state?.enabled
                ? "没有门票的人看不到首页。管理员在任何设备上凭自己的管理员门票直接进入。"
                : state?.hasMyAdminTicket
                  ? "已被手动关闭（应急）。重新开启后，没有门票的人又会被拦下。"
                  : "还没有开启。生成你的管理员门票后，首页拦截会自动开启。"}
            </span>
            <div className="ml-auto">
              {state?.enabled ? (
                <Button onClick={() => void setEnabled(false)} busy={busy === "enabled"}>关闭拦截（应急用）</Button>
              ) : state?.hasMyAdminTicket ? (
                <Button variant="primary" onClick={() => void setEnabled(true)} busy={busy === "enabled"}>
                  开启拦截
                </Button>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            {state?.adminLogin ? <Badge tone="warn">应急登录已开启</Badge> : <Badge tone="neutral">应急登录已关闭</Badge>}
            <span className="text-muted-foreground">
              门票丢了的管理员，可以在提示页只用邮箱和密码进入（不需要验证器）。只对管理员账号开放，每次成功都写入操作日志。
              注意：开启期间，任何人只要知道某个管理员的邮箱和密码，就能进入首页。平时建议关闭。
            </span>
            <div className="ml-auto">
              {state?.adminLogin ? (
                <Button onClick={() => void setAdminLogin(false)} busy={busy === "admin-login"}>关闭应急登录</Button>
              ) : (
                <Button onClick={() => void setAdminLogin(true)} busy={busy === "admin-login"}>开启应急登录</Button>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">我的管理员门票</span>
              {state?.hasMyAdminTicket ? <Badge tone="ok">已有</Badge> : <Badge tone="warn">还没有</Badge>}
            </div>
            <AdminPanelHint>
              管理员在任何设备上都能凭它进门，不用先登录。重新生成会让旧门票立即作废，所有用旧门票的设备都要换新的。
            </AdminPanelHint>
            <Button onClick={() => void createAdmin()} busy={busy === "admin"}>
              {state?.hasMyAdminTicket ? "重新生成（旧门票作废）" : "生成我的管理员门票"}
            </Button>
          </div>
        </Panel>

        <Panel>
          <div className="space-y-4">
            <span className="text-[13px] font-medium">发邀请门票</span>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">给谁（备注，必填）</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={60}
                placeholder="例如：王老板 / 第二期内测"
                className={INPUT_CLS}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-muted-foreground">进门期限（天）</span>
                <input
                  type="number"
                  min={INVITE_CLAIM_DAYS.min}
                  max={INVITE_CLAIM_DAYS.max}
                  value={claimDays}
                  onChange={(e) => setClaimDays(Number(e.target.value))}
                  className={INPUT_CLS}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-muted-foreground">可用设备数</span>
                <input
                  type="number"
                  min={INVITE_MAX_DEVICES.min}
                  max={INVITE_MAX_DEVICES.max}
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(Number(e.target.value))}
                  className={INPUT_CLS}
                />
              </label>
            </div>
            <AdminPanelHint>
              进门期限：门票发出后多久内能用来进门。进门后这台设备 30 天内不用再进。
            </AdminPanelHint>
            <Button variant="primary" onClick={() => void createInvite()} disabled={!label.trim()} busy={busy === "invite"}>
              生成邀请链接
            </Button>
          </div>
        </Panel>

        {issued && (
          <Panel>
            <div className="space-y-2">
              <span className="text-[13px] font-medium">{issued.title}</span>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/40 px-3 py-2 font-mono text-[12px]">{issued.link}</code>
                <Button onClick={() => copy(issued.link, "链接已复制")}>
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </Button>
              </div>
              <AdminPanelHint>这条链接只显示这一次，关掉后就找不回来了。忘了就撤销这张门票，重新生成一张。</AdminPanelHint>
            </div>
          </Panel>
        )}

        {notice && <p role="status" className="text-[12.5px] text-emerald-400">{notice}</p>}
        {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

        <Panel>
          <div className="mb-3 text-[13px] font-medium">门票列表（最近 200 张）</div>
          {!state ? (
            <p className="text-[12.5px] text-muted-foreground">读取中…</p>
          ) : state.tickets.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">还没有门票。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="text-[11.5px] text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-normal">备注</th>
                    <th className="py-2 pr-3 font-normal">类型</th>
                    <th className="py-2 pr-3 font-normal">状态</th>
                    <th className="py-2 pr-3 font-normal">设备</th>
                    <th className="py-2 pr-3 font-normal">进门截止</th>
                    <th className="py-2 pr-3 font-normal">发出</th>
                    <th className="py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {state.tickets.map((t) => (
                    <tr key={t.id} className="border-t border-border/60">
                      <td className="py-2 pr-3">{t.label || "—"}</td>
                      <td className="py-2 pr-3">{t.kind === "admin" ? "管理员门票" : "邀请"}</td>
                      <td className="py-2 pr-3">{STATUS_TEXT[t.status]}</td>
                      <td className="py-2 pr-3">{t.devices_used} / {t.max_devices}</td>
                      <td className="py-2 pr-3">{t.kind === "admin" ? "—" : TIME(t.claim_until)}</td>
                      <td className="py-2 pr-3">{TIME(t.created_at)}</td>
                      <td className="py-2 text-right">
                        {t.status === "active" && (
                          <Button size="sm" onClick={() => revoke(t.id, t.label || "这张门票")} busy={busy === `revoke-${t.id}`}>
                            撤销
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
