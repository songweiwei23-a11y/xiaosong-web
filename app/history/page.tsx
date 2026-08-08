"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { notify, confirmDialog } from '@/components/ui/feedback';
import { 
  FileText,
  Clock,
  Download,
  Copy,
  Trash2,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
} from "lucide-react";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    checkUserAndLoadHistory();
  }, []);

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

  const loadHistory = async (uid: string) => {
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
        return;
      }

      setHistory(data || []);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("已复制到剪贴板！");
  };

  const deleteItem = async (id: string) => {
    if (!await confirmDialog("确定要删除这条记录吗？", { tone: 'danger', confirmText: '删除', title: '确认删除' })) return;

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
      loadHistory(userId);
    } catch (error) {
      notify("删除失败");
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-card border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-foreground">生成历史</h1>
                <p className="text-sm text-muted-foreground">查看您的所有生成记录</p>
              </div>
            </div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:text-blue-700">
              返回工作台
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-card rounded-lg border p-6">
            <div className="text-sm text-muted-foreground mb-2">总记录数</div>
            <div className="text-3xl font-bold text-foreground">{history.length}</div>
          </div>
        </div>

        <div className="bg-card rounded-lg border overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
              加载中...
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">暂无生成记录</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((item) => (
                <div key={item.id} className="p-6 hover:bg-muted transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {item.task_type}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {new Date(item.created_at).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-3">
                        {item.result?.substring(0, 200)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(item.result)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="复制"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="删除"
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