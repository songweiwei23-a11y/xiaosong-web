"use client";

import { useState, useCallback, useEffect } from "react";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { checkQuota } from "@/lib/history";

interface GenerationHistory {
  id: string;
  task_type: string;
  result: string;
  created_at: string;
}

interface UseGenerationPageOptions {
  taskType: string;
  historyApiPath?: string;
}

export function useGenerationPage(options: UseGenerationPageOptions) {
  const { taskType, historyApiPath = "/api/script-history" } = options;

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogInitialContent, setDialogInitialContent] = useState("");
  const [quota, setQuota] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(historyApiPath);
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        setHistory(data.filter((item: any) => item.task_type === taskType));
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  }, [historyApiPath, taskType]);

  const deleteHistory = useCallback(
    async (id: string) => {
      const confirmed = await confirmDialog("确定要删除这条记录吗？", {
        tone: "danger",
        confirmText: "删除",
        title: "确认删除",
      });
      if (!confirmed) return;
      try {
        const response = await fetch(`${historyApiPath}?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          await loadHistory();
          notify("✓ 删除成功");
        }
      } catch (error) {
        notify("✗ 删除失败");
      }
    },
    [historyApiPath, loadHistory]
  );

  const openContinuousDialog = useCallback((initialContent: string) => {
    setDialogInitialContent(initialContent);
    setShowDialog(true);
  }, []);

  const closeContinuousDialog = useCallback(() => {
    setShowDialog(false);
    setDialogInitialContent("");
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("✓ 已复制到剪贴板");
    } catch (error) {
      notify("✗ 复制失败");
    }
  }, []);

  const downloadAsFile = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("✓ 下载成功");
  }, []);

  useEffect(() => {
    loadHistory();
    const loadQuota = async () => {
      const q = await checkQuota();
      setQuota(q);
    };
    loadQuota();
  }, [loadHistory]);

  return {
    history,
    loadHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    quota,
    copyToClipboard,
    downloadAsFile,
  };
}