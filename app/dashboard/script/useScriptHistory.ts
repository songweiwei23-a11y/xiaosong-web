"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  /**
   * 进入页面时最近一条历史的正文，供页面回填到结果区。
   *
   * 生成结果原本只存在组件 state 里，切到别的页面再回来就空了——内容其实
   * 一直在云端历史里，只是界面没把它取回来。
   */
  const [lastResult, setLastResult] = useState("");
  // 只在首次加载时回填。生成结束、删除记录后也会调 loadScriptHistory，
  // 那时若再回填，就会用旧内容盖掉用户当前正在看的东西。
  const restoredRef = useRef(false);

  const loadScriptHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/script-history");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data)) {
        requestAnimationFrame(() => {
          setScriptHistory(data);
        });

        if (!restoredRef.current) {
          restoredRef.current = true;
          const latest = data[0]?.result || data[0]?.script_content || "";
          if (latest) setLastResult(latest);
        }
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
          notify("✓ 删除成功");
          
          setTimeout(() => {
            loadScriptHistory();
          }, 300);
        } else {
          notify("✗ 删除失败");
        }
      } catch (error) {
        console.error("删除失败:", error);
        notify("✗ 删除失败");
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
    lastResult,
  };
}