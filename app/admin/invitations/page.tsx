"use client";

import { useState, useEffect } from "react";
import { 
  Ticket, Plus, Search, Filter, Download, RefreshCw,
  CheckCircle, XCircle, Clock, TrendingUp
} from "lucide-react";

interface InvitationCode {
  id: string;
  code: string;
  status: string;
  plan_type: string;
  created_by: string;
  used_by: string | null;
  created_at: string;
  used_at: string | null;
  expires_at: string;
  notes: string | null;
  is_public: boolean;
  created_by_admin: boolean;
  creator_email?: string;
  user_email?: string;
}

interface Stats {
  overview: {
    total: number;
    active: number;
    used: number;
    expired: number;
    usageRate: number;
  };
  byPlanType: Record<string, number>;
}

export default function InvitationsAdminPage() {
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 筛选条件
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // 生成对话框
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    count: 10,
    planType: "free",
    expiresInDays: 30,
    notes: "",
    isPublic: false,
  });
  const [generateLoading, setGenerateLoading] = useState(false);

  // 加载统计数据
  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/invitation/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("加载统计失败:", error);
    }
  };

  // 加载邀请码列表
  const loadCodes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      
      if (statusFilter) params.append("status", statusFilter);
      if (planFilter) params.append("planType", planFilter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/admin/invitation/list?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setCodes(data.data.codes);
        setTotalPages(data.data.pagination.totalPages);
        setTotal(data.data.pagination.total);
      }
    } catch (error) {
      console.error("加载邀请码失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 批量生成邀请码
  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await fetch("/api/admin/invitation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateForm),
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        setShowGenerateDialog(false);
        loadCodes();
        loadStats();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ 生成失败");
      console.error(error);
    } finally {
      setGenerateLoading(false);
    }
  };

  // 作废邀请码
  const handleRevoke = async (code: string) => {
    if (!confirm(`确定要作废邀请码 ${code} 吗？`)) return;

    try {
      const res = await fetch("/api/admin/invitation/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          codes: [code],
          reason: "管理员手动作废" 
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert("✅ 作废成功");
        loadCodes();
        loadStats();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ 作废失败");
      console.error(error);
    }
  };

  // 复制邀请码
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`✅ 已复制: ${code}`);
  };

  useEffect(() => {
    loadStats();
    loadCodes();
  }, [page, statusFilter, planFilter]);

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      used: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      expired: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    }[status] || "bg-gray-100 text-gray-700";

    const labels = {
      active: "可用",
      used: "已用",
      expired: "过期",
    }[status] || status;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles}`}>
        {labels}
      </span>
    );
  };

  const getPlanBadge = (planType: string) => {
    const styles = {
      free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      basic: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      pro: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      enterprise: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    }[planType] || "bg-gray-100 text-gray-700";

    const labels = {
      free: "体验版",
      basic: "基础版",
      pro: "专业版",
      enterprise: "企业版",
    }[planType] || planType;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles}`}>
        {labels}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <Ticket className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">邀请码管理</h1>
          <p className="text-sm text-muted-foreground">批量生成、查看和管理所有邀请码</p>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总数</p>
                <p className="text-2xl font-bold text-foreground">{stats.overview.total}</p>
              </div>
              <Ticket className="w-10 h-10 text-primary opacity-20" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已使用</p>
                <p className="text-2xl font-bold text-foreground">{stats.overview.used}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">可用</p>
                <p className="text-2xl font-bold text-foreground">{stats.overview.active}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">使用率</p>
                <p className="text-2xl font-bold text-foreground">{stats.overview.usageRate}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* 操作栏 */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            批量生成
          </button>

          <button
            onClick={() => { loadCodes(); loadStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索邀请码..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadCodes()}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-background border border-border rounded-lg text-foreground"
          >
            <option value="">全部状态</option>
            <option value="active">可用</option>
            <option value="used">已用</option>
            <option value="expired">过期</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-background border border-border rounded-lg text-foreground"
          >
            <option value="">全部类型</option>
            <option value="free">体验版</option>
            <option value="basic">基础版</option>
            <option value="pro">专业版</option>
            <option value="enterprise">企业版</option>
          </select>
        </div>
      </div>

      {/* 邀请码列表 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">邀请码</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">创建者</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">使用者</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">过期时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    暂无数据
                  </td>
                </tr>
              ) : (
                codes.map((code) => (
                  <tr key={code.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-foreground">{code.code}</code>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-xs text-primary hover:underline"
                        >
                          复制
                        </button>
                      </div>
                      {code.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{code.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(code.status)}</td>
                    <td className="px-4 py-3">{getPlanBadge(code.plan_type)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">
                        {code.created_by_admin ? "🔧 管理员" : "👤 用户"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {code.used_by ? code.user_email || "已使用" : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(code.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(code.expires_at).toLocaleDateString("zh-CN")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {code.status === "active" && (
                        <button
                          onClick={() => handleRevoke(code.code)}
                          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          作废
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              共 {total} 条记录，第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-muted text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-muted text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 生成对话框 */}
      {showGenerateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">批量生成邀请码</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  生成数量（1-500）
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={generateForm.count}
                  onChange={(e) => setGenerateForm({...generateForm, count: parseInt(e.target.value) || 1})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  会员类型
                </label>
                <select
                  value={generateForm.planType}
                  onChange={(e) => setGenerateForm({...generateForm, planType: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="free">体验版</option>
                  <option value="basic">基础版</option>
                  <option value="pro">专业版</option>
                  <option value="enterprise">企业版</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  有效期（天）
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={generateForm.expiresInDays}
                  onChange={(e) => setGenerateForm({...generateForm, expiresInDays: parseInt(e.target.value) || 30})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  备注（可选）
                </label>
                <input
                  type="text"
                  placeholder="如：2026年8月活动专用"
                  value={generateForm.notes}
                  onChange={(e) => setGenerateForm({...generateForm, notes: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={generateForm.isPublic}
                  onChange={(e) => setGenerateForm({...generateForm, isPublic: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="isPublic" className="text-sm text-foreground">
                  公开邀请码（用于营销活动）
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGenerate}
                disabled={generateLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateLoading ? "生成中..." : "确认生成"}
              </button>
              <button
                onClick={() => setShowGenerateDialog(false)}
                disabled={generateLoading}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
