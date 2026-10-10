"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { notify, confirmDialog } from "@/components/ui/feedback";
import { isUsableQrcodeUrl } from "@/lib/payment-qrcode";
import { AdminPage, Badge, Button, ErrorState, Panel, readError } from "@/components/admin/kit";

/*
 * 收款二维码。
 * 用户付款时看到的就是这里启用的码，所以这一页只允许：上传真实的收款码、启用或停用。
 * 占位图、非 https 的地址不能启用；付款页也只展示通过校验的码（见 lib/payment-qrcode）。
 */

interface QRCode {
  id: string;
  payment_method: string;
  qrcode_url: string;
  is_active: boolean;
  updated_at: string;
}

const METHODS: { value: "alipay" | "wechat"; label: string }[] = [
  { value: "alipay", label: "支付宝" },
  { value: "wechat", label: "微信支付" },
];

export default function AdminQRCodesPage() {
  const [qrcodes, setQrcodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 走服务端：表加了 RLS 之后浏览器读不到，而且这本来就该经过管理员校验
      const res = await fetch("/api/admin/qrcodes");
      if (!res.ok) throw new Error(await readError(res, "加载失败"));
      setQrcodes((await res.json()) || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (method: "alipay" | "wechat", file: File) => {
    const label = METHODS.find((m) => m.value === method)?.label ?? method;
    const ok = await confirmDialog(
      `用「${file.name}」替换${label}收款码？上传后会立刻生效，用户付款时看到的就是这张图。`,
      { tone: "danger", confirmText: "确定替换", title: "替换收款码" }
    );
    if (!ok) return;
    setBusy(method);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `qrcode-${method}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-qrcodes")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("payment-qrcodes").getPublicUrl(fileName);

      /*
       * 「把地址记进表」这一步必须经过服务端。
       * 服务端会拒掉占位图和非 https 的地址，所以这里的校验只是提前提示。
       */
      const res = await fetch("/api/admin/qrcodes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, qrcodeUrl: urlData.publicUrl }),
      });
      if (!res.ok) throw new Error(await readError(res, "保存失败"));
      notify("二维码已上传并启用", "success");
      void load();
    } catch (e) {
      notify("上传失败：" + (e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (method: "alipay" | "wechat", isActive: boolean) => {
    const label = METHODS.find((m) => m.value === method)?.label ?? method;
    const ok = await confirmDialog(
      isActive
        ? `启用${label}收款码？启用后用户付款时会看到这张码。`
        : `停用${label}收款码？停用后付款页将看不到这张码，用户可能无法付款。`,
      { tone: isActive ? "default" : "danger", confirmText: isActive ? "确定启用" : "确定停用", title: isActive ? "启用收款码" : "停用收款码" }
    );
    if (!ok) return;
    setBusy(method);
    try {
      const res = await fetch("/api/admin/qrcodes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, isActive }),
      });
      if (!res.ok) throw new Error(await readError(res, "切换失败"));
      notify(isActive ? "已启用，用户付款时会看到这张码" : "已停用，用户付款时将看不到这张码", "success");
      void load();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminPage
      title="收款二维码"
      subtitle="用户付款时看到的就是这里启用的码。停用后，付款页会提示「还没有收款码」，不会展示旧图"
      actions={<Button variant="default" onClick={() => void load()} busy={loading}>刷新</Button>}
    >
      {error && <div className="mb-5"><ErrorState message={error} onRetry={() => void load()} /></div>}

      <div className="grid gap-5 md:grid-cols-2">
        {METHODS.map((m) => {
          const row = qrcodes.find((q) => q.payment_method === m.value);
          const usable = isUsableQrcodeUrl(row?.qrcode_url);
          const placeholder = !!row?.qrcode_url && !usable;
          const working = busy === m.value;
          return (
            <Panel
              key={m.value}
              title={m.label}
              action={
                loading ? null : !row || !row.qrcode_url ? (
                  <Badge tone="warn">未上传</Badge>
                ) : placeholder ? (
                  <Badge tone="danger">地址不可用</Badge>
                ) : row.is_active ? (
                  <Badge tone="ok">已启用</Badge>
                ) : (
                  <Badge tone="neutral">已停用</Badge>
                )
              }
            >
              <div className="space-y-4">
                <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white">
                  {loading ? (
                    <span className="text-[13px] text-muted-foreground">加载中…</span>
                  ) : usable && row ? (
                    // 签名/公开链接不走 Next 图片优化，直接用普通图片标签
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.qrcode_url} alt={`${m.label}收款码`} className="h-full w-full object-contain p-4" />
                  ) : (
                    <span className="px-6 text-center text-[13px] text-muted-foreground">
                      {placeholder ? "这张图的地址不能用（占位图，或不是 https 地址）。请重新上传真实的收款码" : "还没有上传收款码"}
                    </span>
                  )}
                </div>

                {row?.updated_at && (
                  <p className="text-[12px] text-muted-foreground">最后更新：{new Date(row.updated_at).toLocaleString("zh-CN")}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-border px-3.5 py-2 text-[13px] text-foreground hover:bg-foreground/[0.05]">
                    {working ? "上传中…" : usable ? "更换收款码" : "上传收款码"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={working}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void upload(m.value, f);
                      }}
                    />
                  </label>
                  {usable && row && (
                    <Button
                      variant={row.is_active ? "default" : "primary"}
                      onClick={() => void toggle(m.value, !row.is_active)}
                      busy={working}
                    >
                      {row.is_active ? "停用" : "启用"}
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </AdminPage>
  );
}
