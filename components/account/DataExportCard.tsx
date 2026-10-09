"use client";

import { useRef, useState } from "react";
import { Database, Download, FileCheck2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { checkExportBundle, type RestoreCheck } from "@/lib/account-export";

/**
 * 我的数据（2026-10-04）：全量导出 + 恢复预检。说明见 lib/account-export.ts。
 * 预检在浏览器里读文件，不上传（文件可能好几 MB，用户线路传大文件会断），只核对不写库。
 */
export function DataExportCard() {
  const [check, setCheck] = useState<RestoreCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const verify = async (file: File) => {
    setChecking(true); setError(""); setCheck(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("请先登录");
      const parsed = JSON.parse(await file.text());
      setCheck(checkExportBundle(parsed, data.session.user.id));
    } catch (e) {
      setError(e instanceof SyntaxError ? "文件不是有效的 JSON" : (e as Error).message);
    } finally {
      setChecking(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="glass-panel mb-4 rounded-2xl border border-border p-4 sm:p-5">
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-foreground"><Database className="h-4 w-4 text-primary" />我的数据</h2>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        档案、定位、每次生成的结果、作品、素材库、风格预设、对话会一直保存，删除只在你自己点删除时发生（唯一会自动删除的是：已勾完成的待办，第二天删掉）。
        可以随时把全部数据导出成一个文件留底。拍摄清单的勾选、画布未保存的草稿只存在这台设备的浏览器里，不在导出里。
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/account/export" download className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90">
          <Download className="h-4 w-4" />导出全部数据
        </a>
        <button type="button" onClick={() => input.current?.click()} disabled={checking}
          className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-60">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}检查导出文件是否完整
        </button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) verify(f); }} />
      </div>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{error}</p>}
      {check && (
        <div className="mt-3 rounded-xl bg-foreground/[0.04] p-3 text-[12.5px]">
          <p className={check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
            {check.ok ? "文件完整，属于当前账号，可以作为备份保存。" : "这份文件有问题："}
          </p>
          {check.problems.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted-foreground">{check.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <p className="mt-2 text-muted-foreground">{check.summary.filter((s) => s.rows).map((s) => `${s.label} ${s.rows} 条`).join(" · ") || "没有内容"}</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">这里只检查文件，不会改动你账号里的任何数据。</p>
        </div>
      )}
    </section>
  );
}
