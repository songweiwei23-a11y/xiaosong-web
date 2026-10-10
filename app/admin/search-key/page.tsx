"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { postSafely } from "@/lib/safe-post";
import { INPUT_CLS } from "@/components/form/controls";
import { AdminPage, AdminPanelHint, Badge, Button, Panel } from "@/components/admin/kit";

/*
 * 联网搜索密钥（深度研究逐题搜索用）。
 * 只能在 https 下填写：页面不回显密钥，验证成功才加密保存，验证会产生一次搜索调用。
 * 普通对话的联网仍使用 Dify 里的现有配置。
 */

interface Status {
  configured: boolean;
  verifiedAt?: string;
  tableMissing?: boolean;
}

export default function SearchKeyPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const secureEntry = useSyncExternalStore(
    () => () => {},
    () => location.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname),
    () => false
  );

  useEffect(() => {
    fetch("/api/admin/search-key")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setStatus(d);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await postSafely("/api/admin/search-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, endpoint: endpoint || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "验证失败");
      setStatus(d);
      setApiKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage title="联网搜索密钥" subtitle="用于深度研究逐题搜索。普通对话的联网仍使用 Dify 中的现有配置">
      <div className="mx-auto max-w-2xl space-y-5">
        {!secureEntry && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-400">
            当前不是 https 页面，为了密钥安全，这里不能填写。请用正式域名打开后台再配置。
          </div>
        )}

        <Panel>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
            {status?.configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>已配置</span>
                <Badge tone="ok">可用</Badge>
                {status.verifiedAt && (
                  <span className="text-muted-foreground">· 上次验证 {new Date(status.verifiedAt).toLocaleString("zh-CN")}</span>
                )}
              </>
            ) : (
              <>
                <span className="text-muted-foreground">尚未配置</span>
                <Badge tone="warn">深度研究暂不可用</Badge>
              </>
            )}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">阿里云 API Key</span>
              <input
                disabled={!secureEntry}
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴阿里云搜索密钥"
                className={INPUT_CLS}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">服务地址（可选）</span>
              <input
                disabled={!secureEntry}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="留空使用当前开物阿里云搜索地址"
                className={INPUT_CLS}
              />
            </label>

            <AdminPanelHint>
              <span className="inline-flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                先执行一次 Lite 搜索验证，成功才加密保存。页面不回显密钥。验证会产生一次搜索调用。
              </span>
            </AdminPanelHint>

            {status?.tableMissing && <p className="text-[12.5px] text-amber-400">需先执行深度研究数据库迁移。</p>}
            {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

            <Button variant="primary" onClick={() => void save()} disabled={!secureEntry || !apiKey.trim()} busy={busy}>
              验证并保存
            </Button>
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}
