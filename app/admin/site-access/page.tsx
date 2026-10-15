"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { INPUT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Badge, Button, Panel } from "@/components/admin/kit";
import { generateSiteAccessCode, SITE_ACCESS_CODE_MAX, SITE_ACCESS_CODE_MIN } from "@/lib/site-access-code";

/*
 * 首页拦截（第一道）：没有访问码或邀请链接的人，连首页都看不到。
 * 访问码在这里维护；改了以后，所有人（包括其它设备）要用新码重新进入，当前这台电脑自动保留通过。
 */

interface Status {
  enabled: boolean;
  code: string;
  source: "database" | "environment" | "unavailable" | "none";
}

const SOURCE_HINT: Record<Status["source"], string> = {
  database: "当前用的是这里保存的访问码。",
  environment: "当前用的是服务器环境变量 SITE_ACCESS_CODE 里的访问码。在这里保存一次后，以这里为准。",
  unavailable: "读取访问码失败，目前谁也进不去。请检查数据库连接后刷新。",
  none: "还没有设置访问码，首页暂时不拦截。设置一个访问码并保存，拦截才会开始生效。",
};

export default function SiteAccessPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(true);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-access")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "读取失败");
        setStatus(d);
        setCode(d.code || "");
        setEnabled(d.enabled ?? true);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const trimmed = code.trim();
  const valid = trimmed.length >= SITE_ACCESS_CODE_MIN && trimmed.length <= SITE_ACCESS_CODE_MAX && /^[A-Za-z0-9_-]+$/.test(trimmed);
  const inviteLink = origin && trimmed ? `${origin}/?gate=${encodeURIComponent(trimmed)}` : "";
  const dirty = !!status && (trimmed !== status.code || enabled !== status.enabled);

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/site-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, enabled }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      setStatus({ enabled: d.enabled, code: d.code, source: d.source });
      setCode(d.code);
      setEnabled(d.enabled);
      setNotice("已保存。所有人需要用新码重新进入；你当前这台电脑已自动保留通过。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, done: string) => {
    void navigator.clipboard.writeText(text).then(() => setNotice(done), () => setError("复制失败，请手动选中复制"));
  };

  return (
    <AdminPage title="首页拦截" subtitle="没有访问码或邀请链接的人，连首页都看不到。通过之后才能登录、注册">
      <div className="mx-auto max-w-2xl space-y-5">
        <Panel>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
            {status?.enabled && status.code ? <Badge tone="ok">拦截已开启</Badge> : <Badge tone="warn">拦截未开启</Badge>}
            {status && <span className="text-muted-foreground">{SOURCE_HINT[status.source]}</span>}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">访问码</span>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={`${SITE_ACCESS_CODE_MIN}–${SITE_ACCESS_CODE_MAX} 位，字母、数字、- 和 _`}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${INPUT_CLS} font-mono`}
                />
                <Button onClick={() => setCode(generateSiteAccessCode())}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  随机生成
                </Button>
              </div>
              {trimmed && !valid && (
                <span className="mt-1.5 block text-[12px] text-rose-400">
                  需要 {SITE_ACCESS_CODE_MIN}–{SITE_ACCESS_CODE_MAX} 位，只能用字母、数字、短横线和下划线
                </span>
              )}
            </label>

            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
              开启首页拦截（关掉以后，所有页面对所有人开放）
            </label>

            {inviteLink && (
              <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <span className="mb-1 block text-[12px] text-muted-foreground">邀请链接（发给人，打开即通过第一道）</span>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{inviteLink}</code>
                  <Button onClick={() => copy(inviteLink, "邀请链接已复制")}>
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </Button>
                </div>
              </div>
            )}

            <AdminPanelHint>
              <span className="inline-flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                改了访问码，旧的邀请链接和旧的 Cookie 同时失效。访问码只有密钥管理权限的管理员能看到。
              </span>
            </AdminPanelHint>

            {notice && <p role="status" className="text-[12.5px] text-emerald-400">{notice}</p>}
            {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

            <Button variant="primary" onClick={() => void save()} disabled={!valid || !dirty} busy={busy}>
              保存
            </Button>
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
