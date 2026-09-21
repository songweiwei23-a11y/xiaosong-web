"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  /**
   * 进入页面时最近一条历史的正文，供页面回填到结果区。
   *
   * 生成结果原本只存在组件 state 里，切到别的页面再回来就空了——内容其实
   * 一直在云端历史里，只是界面没把它取回来。
   */
  const [lastResult, setLastResult] = useState("");
  // 只在首次加载时回填。生成结束后也会调 loadHistory 刷新列表，
  // 那时若再回填，就会用旧内容盖掉用户刚生成的东西。
  const restoredRef = useRef(false);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(historyApiPath);
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        const mine = data.filter((item: any) => item.task_type === taskType);
        setHistory(mine);

        if (!restoredRef.current) {
          restoredRef.current = true;
          if (mine[0]?.result) setLastResult(mine[0].result);
        }
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
    lastResult,
  };
}