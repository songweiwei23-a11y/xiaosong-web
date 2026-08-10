"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog, notify } from "@/components/ui/feedback";

/**
 * 鑴氭湰鍘嗗彶璁板綍 + 鎸佺画瀵硅瘽寮圭獥鐘舵€併€? * 浠?ScriptPage 鎶界锛岃礋璐ｅ巻鍙茬殑鍔犺浇銆佸垹闄や笌"缁х画瀵硅瘽"寮圭獥寮€鍏炽€? */
export function useScriptHistory() {
  const [scriptHistory, setScriptHistory] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInitialContent, setDialogInitialContent] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadScriptHistory = useCallback(async () => {
    console.log("🔍 开始加载脚本历史记录...");
    try {
      console.log("📡 正在请求 /api/script-history..."); const response = await fetch("/api/script-history");
      console.log("⚠️ API 响应状态:", response.status); if (!response.ok) return;
      const data = await response.json(); console.log("📦 收到数据:", data);
      if (Array.isArray(data)) {
        requestAnimationFrame(() => {
          console.log("✅ 历史记录加载成功:", data.length, "条"); setScriptHistory(data);
        });
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  }, []);

  const deleteHistory = useCallback(
    async (id: string) => {
      if (isDeleting) return;
      
      const confirmed = await confirmDialog("纭畾瑕佸垹闄よ繖鏉¤褰曞悧锛?, {
        tone: "danger",
        confirmText: "删除",
        title: "纭删除",
      });
      
      if (!confirmed) return;
      
      setIsDeleting(true);
      
      try {
        const response = await fetch(`/api/script-history?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          setScriptHistory(prev => prev.filter(item => item.id !== id));
          notify("鉁?删除鎴愬姛");
          
          setTimeout(() => {
            loadScriptHistory();
          }, 300);
        } else {
          notify("鉁?删除澶辫触");
        }
      } catch (error) {
        console.error("删除澶辫触:", error);
        notify("鉁?删除澶辫触");
      } finally {
        setTimeout(() => {
          setIsDeleting(false);
        }, 500);
      }
    },
    [isDeleting, loadScriptHistory]
  );

  const openContinuousDialog = useCallback((content: string) => {
    setDialogInitialContent(content);
    setTimeout(() => {
      setShowDialog(true);
    }, 0);
  }, []);

  const closeContinuousDialog = useCallback(() => {
    setShowDialog(false);
    setTimeout(() => {
      setDialogInitialContent("");
    }, 300);
  }, []);

  useEffect(() => {
    loadScriptHistory();
  }, [loadScriptHistory]);

  return {
    scriptHistory,
    loadScriptHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    isDeleting,
  };
}