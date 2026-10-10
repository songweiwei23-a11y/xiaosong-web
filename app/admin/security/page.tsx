"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { INPUT_CLS } from "@/components/form/controls";
import { AdminPage, Badge, Button, Panel } from "@/components/admin/kit";

/*
 * 账号安全：管理员二次验证（TOTP，用手机验证器 App 扫码）。
 * 绑定之后，这个账号每次登录后台都要再输入一次验证码（规则见 lib/admin-mfa）。
 * 这一页不经过后台的 check-role 接口，所以即使本次会话还没验，也能打开来完成验证。
 */

interface Factor {
  id: string;
  friendly_name?: string | null;
  status: string;
}

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState<Factor[]>([]);
  const [pending, setPending] = useState<Factor[]>([]);
  const [level, setLevel] = useState<{ currentLevel: string | null; nextLevel: string | null }>({ currentLevel: null, nextLevel: null });
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 读取本身不同步改加载态（effect 里调用它，不会引起级联渲染）；加载态由 load 在触发前切换
  const fetchData = useCallback(async () => {
    try {
      const [{ data: factors, error: fErr }, { data: aal }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (fErr) throw fErr;
      const totp = (factors?.totp ?? []) as Factor[];
      setVerified(totp.filter((f) => f.status === "verified"));
      setPending(totp.filter((f) => f.status !== "verified"));
      setLevel({ currentLevel: aal?.currentLevel ?? null, nextLevel: aal?.nextLevel ?? null });
    } catch (e) {
      setError((e as Error).message || "读取安全设置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** 第一步：生成二维码。还没验证过的绑定会留在列表里，可以取消 */
  const startEnroll = async () => {
    setBusy(true);
    setError("");
    try {
      const { data, error: eErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `admin-${new Date().toISOString().slice(0, 10)}`,
      });
      if (eErr || !data) throw eErr ?? new Error("生成二维码失败");
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError((e as Error).message || "生成二维码失败");
    } finally {
      setBusy(false);
    }
  };

  /** 第二步：输入 App 里的 6 位码，验证通过才算绑定成功（并把本次会话升到 AAL2） */
  const verify = async (factorId: string) => {
    if (!/^\d{6}$/.test(code.trim())) {
      notify("请输入 App 里显示的 6 位数字", "warning");
      return;
    }
    setBusy(true);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (vErr) throw vErr;
      notify("验证通过", "success");
      setEnrolling(null);
      setCode("");
      await load();
      // 验证通过后直接回后台首页
      router.push("/admin");
    } catch (e) {
      notify((e as Error).message || "验证码不对，请重试", "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async (factorId: string) => {
    const ok = await confirmDialog("取消这次未完成的绑定？取消后可以重新生成二维码。", { confirmText: "取消绑定", title: "取消绑定" });
    if (!ok) return;
    setBusy(true);
    try {
      const { error: uErr } = await supabase.auth.mfa.unenroll({ factorId });
      if (uErr) throw uErr;
      setEnrolling(null);
      await load();
    } catch (e) {
      notify((e as Error).message || "取消失败", "error");
    } finally {
      setBusy(false);
    }
  };

  /** 已绑定、但本次会话还没验：输入验证码升到 AAL2 */
  const submitStepUp = async (e: FormEvent) => {
    e.preventDefault();
    const factor = verified[0];
    if (factor) await verify(factor.id);
  };

  const needStepUp = verified.length > 0 && level.nextLevel === "aal2" && level.currentLevel !== "aal2";

  return (
    <AdminPage title="账号安全" subtitle="管理员二次验证。绑定后，每次登录后台都要再输入手机验证器里的 6 位码">
      <div className="mx-auto max-w-2xl space-y-5">
        {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

        {needStepUp && (
          <Panel title={<span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-400" />请完成二次验证</span>}>
            <p className="mb-4 text-[12.5px] text-muted-foreground">
              你的账号已绑定验证器。请打开验证器 App，输入当前显示的 6 位码，验证通过后才能使用后台。
            </p>
            <form onSubmit={submitStepUp} className="flex flex-wrap items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位验证码"
                aria-label="6 位验证码"
                className={`${INPUT_CLS} max-w-[12rem] tracking-[0.3em]`}
              />
              <Button type="submit" variant="primary" busy={busy}>验证</Button>
            </form>
          </Panel>
        )}

        <Panel
          title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />验证器状态</span>}
        >
          {loading ? (
            <p className="text-[12.5px] text-muted-foreground">正在读取…</p>
          ) : verified.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Badge tone="ok">已绑定</Badge>
              <span className="text-muted-foreground">
                {level.currentLevel === "aal2" ? "本次会话已通过二次验证" : "本次会话还需要验证"}
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone="warn">未绑定</Badge>
                <span className="text-muted-foreground">建议绑定。绑定后，别人即使拿到你的密码也进不了后台</span>
              </div>
              {!enrolling && (
                <Button variant="primary" onClick={() => void startEnroll()} busy={busy}>
                  <KeyRound className="h-3.5 w-3.5" />生成绑定二维码
                </Button>
              )}
            </div>
          )}
        </Panel>

        {enrolling && (
          <Panel title="用验证器 App 扫码">
            <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
              {/* Supabase 返回的是 SVG 的 data 地址，next/image 不处理这种地址，所以用原生 img */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolling.qr} alt="验证器绑定二维码" className="h-44 w-44 rounded-xl bg-white p-2" />
              <div className="space-y-3 text-[12.5px] text-muted-foreground">
                <p>1. 用 Google Authenticator、Microsoft Authenticator 等验证器 App 扫描左边的二维码。</p>
                <p>2. 扫不了的话，手动输入这个密钥：</p>
                <code className="block select-all break-all rounded-lg border border-border bg-foreground/[0.04] px-3 py-2 font-mono text-[12px] text-foreground">{enrolling.secret}</code>
                <p>3. 输入 App 里显示的 6 位码，验证通过即完成绑定。</p>
                <form
                  onSubmit={(e) => { e.preventDefault(); void verify(enrolling.factorId); }}
                  className="flex flex-wrap items-center gap-2 pt-1"
                >
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 位验证码"
                    aria-label="6 位验证码"
                    className={`${INPUT_CLS} max-w-[12rem] tracking-[0.3em]`}
                  />
                  <Button type="submit" variant="primary" busy={busy}>完成绑定</Button>
                  <Button variant="default" onClick={() => void cancelPending(enrolling.factorId)} disabled={busy}>取消</Button>
                </form>
              </div>
            </div>
          </Panel>
        )}

        {pending.length > 0 && !enrolling && (
          <Panel title="还没完成的绑定">
            <p className="mb-3 text-[12.5px] text-muted-foreground">上次绑定没完成。可以取消，然后重新生成二维码。</p>
            <Button variant="default" onClick={() => void cancelPending(pending[0].id)} disabled={busy}>取消这次绑定</Button>
          </Panel>
        )}
      </div>
    </AdminPage>
  );
}
