"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1120", color: "#e5e7eb" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>应用出错了</h2>
          <p style={{ maxWidth: 420, fontSize: 14, color: "#9ca3af" }}>
            页面遇到了意料之外的错误。请重试，或刷新页面。
          </p>
          <button
            onClick={reset}
            style={{ borderRadius: 8, background: "#2563eb", color: "#fff", padding: "8px 16px", fontSize: 14, border: "none", cursor: "pointer" }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
