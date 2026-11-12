interface Order {
  id: string;
  user_email?: string;
  plan_name: string;
  billing_cycle: string;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
}

/**
 * 导出订单为CSV
 */
export function exportOrdersToCSV(orders: Order[], filename = 'orders.csv') {
  // CSV 表头
  const headers = [
    '订单ID',
    '用户邮箱',
    '套餐名称',
    '计费周期',
    '金额',
    '支付方式',
    '状态',
    '创建时间',
    '审核时间',
  ];

  // 状态映射
  const statusMap: Record<string, string> = {
    pending: '待支付',
    reviewing: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    expired: '已过期',
  };

  // 转换数据
  const rows = orders.map(order => [
    order.id,
    order.user_email || '',
    order.plan_name,
    order.billing_cycle === 'monthly' ? '月付' : '年付',
    order.amount,
    order.payment_method === 'alipay' ? '支付宝' : '微信',
    statusMap[order.status] || order.status,
    new Date(order.created_at).toLocaleString('zh-CN'),
    order.reviewed_at ? new Date(order.reviewed_at).toLocaleString('zh-CN') : '',
  ]);

  // 组合CSV内容
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 下载文件
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 导出统计数据为JSON
 */
export function exportStatsToJSON(stats: any, filename = 'stats.json') {
  const jsonContent = JSON.stringify(stats, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 生成Excel格式（简化版，使用CSV）
 */
export function exportOrdersToExcel(orders: Order[], filename = 'orders.xlsx') {
  // 由于纯前端生成真正的Excel比较复杂，这里使用CSV但改后缀为.xlsx
  // 实际上仍是CSV格式，但Excel可以直接打开
  exportOrdersToCSV(orders, filename.replace('.xlsx', '.csv'));
}