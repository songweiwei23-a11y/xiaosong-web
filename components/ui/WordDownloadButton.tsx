"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { notify } from "@/components/ui/feedback";
import { downloadDocx } from "@/lib/doc-export";

/**
 * 「下载 Word」按钮（2026-11-02 产品方：所有产出的内容都支持下载成 Word，排版干净整洁、简约大气）。
 * 版式在 lib/doc-export；浏览器里生成，不上传、不扣次数。各板块的结果区、报告卡片都用这一个按钮。
 */
export function WordDownloadButton({ content, title, board, date, className, label = "下载 Word" }: {
  /** 要下载的 Markdown 正文 */
  content: string;
  /** 文档标题（不填就取正文第一个标题） */
  title?: string;
  /** 哪个板块产出的，写在文档抬头那一行 */
  board?: string;
  /** 文档日期（历史记录用生成那天），默认今天 */
  date?: Date;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!content.trim()) return null;
  const run = async () => {
    setBusy(true);
    try {
      await downloadDocx(content, { title, board, date });
    } catch {
      notify("Word 没生成出来，请重试", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      title="下载成 Word 文档（.docx），打开能接着改"
      className={className ?? "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-60"}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
