"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { notify } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Search } from "lucide-react";
import Image from "next/image";
import { exportOrdersToCSV } from "@/lib/export-utils";

interface Order {
  id: string;
  user_id: string;
  user_email?: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  payment_method: string;
  status: string;
  proof_image_url?: string;
  review_note?: string;
  created_at: string;
  proof_uploaded_at?: string;
  reviewed_at?: string;
  reviewer_id?: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 获取用户邮箱
      const ordersWithEmail = await Promise.all(
        (data || []).map(async (order) => {
          const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
          return { ...order, user_email: userData.user?.email || "未知" };
        })
      );

      setOrders(ordersWithEmail);
    } catch (error: any) {
      console.error("加载订单失败:", error);
      notify("加载订单失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (orderId: string, approved: boolean, note?: string) => {
    setReviewing(true);
    try {
      const response = await fetch("/api/admin/orders/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          approved,
          note,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        notify(approved ? "订单已通过审核" : "订单已拒绝", "success");
        loadOrders();
        setShowProofDialog(false);
      } else {
        notify(result.error || "审核失败", "error");
      }
    } catch (error) {
      console.error("审核失败:", error);
      notify("审核失败", "error");
    } finally {
      setReviewing(false);
    }
  };

  // 筛选订单
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        order.plan_name?.toLowerCase().includes(term) ||
        order.user_email?.toLowerCase().includes(term) ||
        order.amount?.toString().includes(term) ||
        order.id?.toLowerCase().includes(term)
      );
    }

    return true;
  });

  // 统计
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "reviewing").length,
    approved: orders.filter((o) => o.status === "approved").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: "待支付", variant: "default", icon: Clock },
      reviewing: { label: "待审核", variant: "default", icon: AlertCircle },
      approved: { label: "已通过", variant: "success", icon: CheckCircle },
      rejected: { label: "已拒绝", variant: "destructive", icon: XCircle },
    };

    const { label, variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载订单中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-8 py-10">
      <h1 className="text-3xl font-bold mb-8">订单审核</h1>

      {/* 搜索和筛选 */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索订单（用户邮箱、套餐、金额、订单号）"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">全部状态</option>
          <option value="reviewing">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
        <Button
          variant="outline"
          onClick={() => exportOrdersToCSV(filteredOrders, `orders-${new Date().toISOString().split('T')[0]}.csv`)}
          disabled={filteredOrders.length === 0}
        >
          导出订单 ({filteredOrders.length})
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-1">总订单</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="text-sm text-yellow-700 mb-1">待审核</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 mb-1">已通过</div>
            <div className="text-3xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700 mb-1">已拒绝</div>
            <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* 订单列表 */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "没有找到匹配的订单" : "暂无订单"}
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{order.plan_name}</h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                      <div>用户: {order.user_email}</div>
                      <div>金额: ¥{order.amount}</div>
                      <div>周期: {order.billing_cycle === "monthly" ? "月付" : "年付"}</div>
                      <div>支付方式: {order.payment_method === "alipay" ? "支付宝" : "微信"}</div>
                      <div>提交时间: {new Date(order.created_at).toLocaleString()}</div>
                      {order.reviewed_at && (
                        <div>审核时间: {new Date(order.reviewed_at).toLocaleString()}</div>
                      )}
                    </div>
                    {order.review_note && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        备注: {order.review_note}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {order.proof_image_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowProofDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看凭证
                      </Button>
                    )}
                    {order.status === "reviewing" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleReview(order.id, true)}
                          disabled={reviewing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          通过
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            const note = prompt("拒绝原因（可选）:");
                            handleReview(order.id, false, note || undefined);
                          }}
                          disabled={reviewing}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          拒绝
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 支付凭证对话框 */}
      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>支付凭证</DialogTitle>
          </DialogHeader>
          {selectedOrder?.proof_image_url && (
            <div className="space-y-4">
              <div className="relative w-full h-96">
                <Image
                  src={selectedOrder.proof_image_url}
                  alt="支付凭证"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => handleReview(selectedOrder.id, true)}
                  disabled={reviewing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  通过审核
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const note = prompt("拒绝原因（可选）:");
                    handleReview(selectedOrder.id, false, note || undefined);
                  }}
                  disabled={reviewing}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  拒绝
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}