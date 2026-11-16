"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { confirmDialog, notify } from "@/components/ui/feedback";
import { checkQuota } from "@/lib/history";
import { useCreatorContext } from '@/hooks/useCreatorContext';
import { profileHistoryQuery } from '@/lib/profile-history';
import { postSafely } from '@/lib/safe-post';

interface GenerationHistory {
  id: string;
  task_type: string;
  result: string;
  created_at: string;
  /** 生成时的参数（接口返回整行）。选题库按它认这批属于哪个档案 */
  input_data?: Record<string, any> | null;
}

interface UseGenerationPageOptions {
  taskType: string;
  historyApiPath?: string;
}

export function useGenerationPage(options: UseGenerationPageOptions) {
  const { taskType, historyApiPath = "/api/script-history" } = options;
  const { context, loading: contextLoading } = useCreatorContext();
  const resultScope = contextLoading ? undefined : context.profile?.id || 'default';
  const currentScopeRef = useRef(resultScope);
  currentScopeRef.current = resultScope;
  const scopeRef = useRef<string>();
  const requestRef = useRef(0);

  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [historyError, setHistoryError] = useState('');
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

  /*
   * 列表和删除各自拼 URL。
   *
   * historyApiPath 传进来的是**不带查询串的路径**，查询参数在这里加：
   *   取列表 → ?taskType=xxx
   *   删单条 → ?id=xxx
   * 之前删除那行是 `${historyApiPath}?id=`，如果调用方自己在路径上带了
   * 查询串，就会拼出两个 ?，删除直接失效。
   */
  const listUrl = `${historyApiPath}?taskType=${encodeURIComponent(taskType)}${profileHistoryQuery(context.profile?.id || null)}`;

  const loadHistory = useCallback(async () => {
    if (!resultScope || resultScope !== currentScopeRef.current) return;
    if (scopeRef.current !== resultScope) {
      scopeRef.current = resultScope;
      restoredRef.current = false;
      setLastResult('');
      setShowDialog(false);
      setDialogInitialContent('');
      setHistory([]);
      setHistoryError('');
    }
    const request = ++requestRef.current;
    try {
      const response = await fetch(listUrl);
      // 历史读取失败必须与“确实没有历史”区分，不能静默显示为空。
      if (!response.ok) {
        if (request === requestRef.current) {
          setHistoryError(response.status === 401 || response.status === 403
            ? '当前登录状态已失效，请重新登录后恢复历史记录。'
            : response.status === 404
              ? '当前板块的历史接口暂不可用，结果仍可继续生成。'
              : '历史记录暂时读取失败，请稍后重试。');
        }
        return;
      }
      const data = await response.json();
      if (request !== requestRef.current) return;
      setHistoryError('');
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
      if (request === requestRef.current) setHistoryError('历史记录暂时读取失败，请检查网络后重试。');
    }
  }, [listUrl, taskType, resultScope]);

  const deleteHistory = useCallback(
    async (id: string) => {
      const confirmed = await confirmDialog("确定要删除这条记录吗？", {
        tone: "danger",
        confirmText: "删除",
        title: "确认删除",
      });
      if (!confirmed) return;
      try {
        const response = await postSafely(`${historyApiPath}?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          await loadHistory();
          notify("✓ 删除成功");
        }
      } catch {
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
    } catch {
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
    return () => { ++requestRef.current; };
  }, [loadHistory]);

  useEffect(() => {
    const loadQuota = async () => {
      const q = await checkQuota();
      setQuota(q);
    };
    loadQuota();
  }, []);

  return {
    history: scopeRef.current === resultScope ? history : [],
    historyError,
    loadHistory,
    deleteHistory,
    showDialog,
    dialogInitialContent,
    openContinuousDialog,
    closeContinuousDialog,
    quota,
    copyToClipboard,
    downloadAsFile,
    lastResult: scopeRef.current === resultScope ? lastResult : '',
    resultScope,
  };
}
