"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "@/components/ui/feedback";

/**
 * 脚本历史记录 + 持续对话弹窗状态。
 * 从 ScriptPage 抽离，负责历史的加载、删除与"继续对话"弹窗开关。
 */
export function useScriptHistory() {
  const [scriptHistory, setScriptHistory] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInitialContent, setDialogInitialContent] = useState("");

  const loadScriptHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/script-history");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        setScriptHistory(data);
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  }, []);

  const deleteHistory = useCallback(
    async (id: string) => {
      const confirmed = await confirmDialog("确定要删除这条记录吗？", {
        tone: "danger",
        confirmText: "删除",
        title: "确认删除",
      });
      if (!confirmed) return;
      try {
        const response = await fetch(`/api/script-history?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          await loadScriptHistory();
        }
      } catch (error) {
        console.error("删除失败:", error);
      }
    },
    [loadScriptHistory]
  );

  const openContinuousDialog = useCallback((content: string) => {
    setDialogInitialContent(content);
    setShowDialog(true);
  }, []);

  const closeContinuousDialog = useCallback(() => setShowDialog(false), []);

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
  };
}
