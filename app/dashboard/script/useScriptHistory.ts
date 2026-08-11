"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog, notify } from "@/components/ui/feedback";

/**
 * 脚本历史记录 + 持续对话弹窗状态。
 * 从 ScriptPage 抽离，负责历史的加载、删除与"继续对话"弹窗开关。
 */
export function useScriptHistory() {
  const [scriptHistory, setScriptHistory] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInitialContent, setDialogInitialContent] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadScriptHistory = useCallback(async () => {
    console.log("🔍 开始加载脚本历史记录...");
    try {
      console.log("📡 正在请求 /api/script-history..."); 
      const response = await fetch("/api/script-history");
      console.log("⚠️ API 响应状态:", response.status); 
      if (!response.ok) return;
      const data = await response.json(); 
      console.log("📦 收到数据:", data);
      if (Array.isArray(data)) {
        requestAnimationFrame(() => {
          console.log("✅ 历史记录加载成功:", data.length, "条"); 
          setScriptHistory(data);
        });
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  }, []);

  const deleteHistory = useCallback(
    async (id: string) => {
      if (isDeleting) return;
      
      const confirmed = await confirmDialog("确定要删除这条记录吗？", {
        tone: "danger",
        confirmText: "删除",
        title: "确认删除",
      });
      
      if (!confirmed) return;
      
      setIsDeleting(true);
      
      try {
        const response = await fetch(`/api/script-history?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          setScriptHistory(prev => prev.filter(item => item.id !== id));
          notify("✅ 删除成功");
          
          setTimeout(() => {
            loadScriptHistory();
          }, 300);
        } else {
          notify("❌ 删除失败");
        }
      } catch (error) {
        console.error("删除失败:", error);
        notify("❌ 删除失败");
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
