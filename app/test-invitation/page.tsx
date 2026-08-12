"use client";

import { useState } from "react";

export default function TestInvitationPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testValidate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/invitation/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setResult({ status: res.status, data });
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-slate-900 dark:text-white">
          邀请码功能测试
        </h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
            测试邀请码验证
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                邀请码
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="输入邀请码（如：XS-ABC123）"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={testValidate}
              disabled={loading || !code}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-2 rounded-lg font-semibold transition"
            >
              {loading ? "测试中..." : "验证邀请码"}
            </button>
          </div>

          {result && (
            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <h3 className="font-semibold mb-2 text-slate-900 dark:text-white">
                测试结果:
              </h3>
              <pre className="text-sm overflow-auto text-slate-800 dark:text-slate-200">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            💡 测试提示
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-2">
            <li>1. 在Supabase Dashboard中查看invitation_codes表，找到status=active的邀请码</li>
            <li>2. 复制邀请码到上方输入框测试</li>
            <li>3. 然后前往 <a href="/login" className="underline font-semibold">/login</a> 测试完整注册流程</li>
            <li>4. 数据库已预生成100个邀请码（格式：XS-XXXXXX）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
