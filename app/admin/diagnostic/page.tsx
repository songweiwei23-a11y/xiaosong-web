'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DiagnosticPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const testResults: any[] = [];

    // 测试1: 用户认证
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      testResults.push({
        test: '用户认证',
        success: !error,
        data: user ? `已登录: ${user.email}` : '未登录',
        error: error?.message
      });
    } catch (e: any) {
      testResults.push({ test: '用户认证', success: false, error: e.message });
    }

    // 测试2: 获取Buckets
    try {
      const { data, error } = await supabase.storage.listBuckets();
      testResults.push({
        test: 'Storage Buckets',
        success: !error,
        data: data?.map(b => b.name).join(', ') || '无',
        error: error?.message
      });
    } catch (e: any) {
      testResults.push({ test: 'Storage Buckets', success: false, error: e.message });
    }

    // 测试3: 检查payment-qrcodes bucket
    try {
      const { data, error } = await supabase.storage
        .from('payment-qrcodes')
        .list();
      testResults.push({
        test: 'payment-qrcodes bucket',
        success: !error,
        data: error ? '不存在或无权限' : `存在,文件数: ${data?.length || 0}`,
        error: error?.message
      });
    } catch (e: any) {
      testResults.push({ test: 'payment-qrcodes bucket', success: false, error: e.message });
    }

    // 测试4: 调用get_payment_config
    try {
      const { data, error } = await supabase.rpc('get_payment_config');
      testResults.push({
        test: 'get_payment_config RPC',
        success: !error,
        data: JSON.stringify(data, null, 2),
        error: error?.message
      });
    } catch (e: any) {
      testResults.push({ test: 'get_payment_config RPC', success: false, error: e.message });
    }

    // 测试5: 测试上传(创建一个1x1的透明PNG)
    try {
      const testBlob = new Blob(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 43, 174, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])],
        { type: 'image/png' }
      );
      
      const testFile = new File([testBlob], 'test.png', { type: 'image/png' });
      const { data, error } = await supabase.storage
        .from('payment-qrcodes')
        .upload(`test_${Date.now()}.png`, testFile);
      
      testResults.push({
        test: '上传测试',
        success: !error,
        data: data ? `成功: ${data.path}` : '失败',
        error: error?.message
      });
    } catch (e: any) {
      testResults.push({ test: '上传测试', success: false, error: e.message });
    }

    setResults(testResults);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          系统诊断
        </h1>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="mb-6 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? '测试中...' : '开始诊断'}
        </button>

        <div className="space-y-4">
          {results.map((result, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                result.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-500'
              }`}
            >
              <h3 className="font-bold text-lg mb-2">
                {result.success ? '✅' : '❌'} {result.test}
              </h3>
              {result.data && (
                <pre className="text-sm bg-white dark:bg-slate-800 p-2 rounded mt-2 overflow-auto">
                  {result.data}
                </pre>
              )}
              {result.error && (
                <p className="text-red-600 dark:text-red-400 mt-2">
                  错误: {result.error}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}