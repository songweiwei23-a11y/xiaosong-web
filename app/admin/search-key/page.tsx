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

interface EngineState { configured: boolean; enabled: boolean; verifiedAt?: string }
interface Status {
  configured: boolean;
  verifiedAt?: string;
  tableMissing?: boolean;
  /** 第二个搜索引擎（lib/search-engines） */
  engines?: Record<"zhipu" | "bocha", EngineState>;
}

const ENGINES: { id: "zhipu" | "bocha"; label: string; hint: string }[] = [
  { id: "zhipu", label: "智谱搜索", hint: "智谱开放平台（open.bigmodel.cn）→ API Keys 里新建的密钥。用的是智谱高阶版搜索，可按一天内 / 一周内过滤" },
  { id: "bocha", label: "博查搜索", hint: "博查开放平台（open.bocha.cn）→ API KEY 管理里的密钥。可按一天内 / 一周内过滤" },
];

/** 第二个搜索引擎：粘密钥 → 真搜一次读得出结果才保存；打开后自由对话、开物助理联网时和阿里云一起搜 */
function EnginePanel({ id, label, hint, state, secureEntry, onStatus }: { id: "zhipu" | "bocha"; label: string; hint: string; state?: EngineState; secureEntry: boolean; onStatus: (s: Status) => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const r = await postSafely("/api/admin/search-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine: id, ...payload }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      onStatus(d);
      setKey("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-medium">{label}</span>
        {state?.configured ? <Badge tone={state.enabled ? "ok" : "warn"}>{state.enabled ? "联网时一起用" : "已配置、未打开"}</Badge> : <Badge tone="warn">未配置</Badge>}
        {state?.verifiedAt && <span className="text-muted-foreground">· 上次验证 {new Date(state.verifiedAt).toLocaleString("zh-CN")}</span>}
      </div>
      <div className="space-y-3">
        <input disabled={!secureEntry} type="password" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={`粘贴${label}密钥`} className={INPUT_CLS} />
        <AdminPanelHint>{hint}。先真搜一次、读得出结果才加密保存，页面不回显密钥；验证会产生一次搜索调用。</AdminPanelHint>
        {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void send({ apiKey: key })} disabled={!secureEntry || !key.trim()} busy={busy}>验证并保存</Button>
          {state?.configured && (
            <Button onClick={() => void send({ enabled: !state.enabled })} disabled={!secureEntry} busy={busy}>{state.enabled ? "关掉（只用阿里云）" : "打开（和阿里云一起搜）"}</Button>
          )}
        </div>
      </div>
    </Panel>
  );
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
    <AdminPage title="联网搜索密钥" subtitle="自由对话、开物助理、深度研究联网都用这里的密钥（阿里云为主，可再加一个搜索引擎）">
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

        {/* 第二个搜索引擎（2026-11-09 联网整改阶段 3）：和阿里云一起搜、互为补充 */}
        <p className="pt-2 text-[13px] font-medium text-foreground">第二个搜索引擎（可选）</p>
        <p className="-mt-3 text-[12px] text-muted-foreground">打开后，自由对话和开物助理联网时同一个搜索词也交给它搜，结果和阿里云的合并去重；它出问题时只少它那一份，不影响阿里云。</p>
        {ENGINES.map((e) => (
          <EnginePanel key={e.id} {...e} state={status?.engines?.[e.id]} secureEntry={secureEntry} onStatus={setStatus} />
        ))}
      </div>
    </AdminPage>
  );
}
