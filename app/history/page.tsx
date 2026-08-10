"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { notify, confirmDialog } from '@/components/ui/feedback';
import { 
  FileText,
  Clock,
  Copy,
  Trash2,
  Calendar,
  RefreshCw,
} from "lucide-react";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      checkUserAndLoadHistory();
    }
  }, [mounted]);

  const checkUserAndLoadHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log("未登录");
        setLoading(false);
        return;
      }

      setUserId(session.user.id);
      await loadHistory(session.user.id);
    } catch (error) {
      console.error("加载失败:", error);
      setLoading(false);
    }
  };

  const loadHistory = useCallback(async (uid: string) => {
    if (!uid) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("script_history")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("查询失败:", error);
        notify("加载历史记录失败");
        return;
      }

      setHistory(data || []);
    } catch (error) {
      console.error("加载历史记录失败:", error);
      notify("加载历史记录失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("已复制到剪贴板！");
    } catch (error) {
      notify("复制失败");
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const confirmed = await confirmDialog("确定要删除这条记录吗？", { 
      tone: 'danger', 
      confirmText: '删除', 
      title: '确认删除' 
    });
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("script_history")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) {
        notify("删除失败");
        return;
      }

      notify("删除成功！");
      await loadHistory(userId);
    } catch (error) {
      notify("删除失败");
    }
  }, [userId, loadHistory]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">生成历史</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">查看您的所有生成记录</p>
              </div>
            </div>
            <Link 
              href="/dashboard" 
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              返回工作台
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">总记录数</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{history.length}</div>
          </div>
        </div>

        {/* History List */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
              <p className="text-slate-600 dark:text-slate-400">加载中...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
              <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">暂无生成记录</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">开始使用工作台生成内容吧</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {item.task_type || '未知类型'}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap">
                        {item.result ? (item.result.length > 200 ? item.result.substring(0, 200) + '...' : item.result) : '暂无内容'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyToClipboard(item.result || '')}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="复制"
                        type="button"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="删除"
                        type="button"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
