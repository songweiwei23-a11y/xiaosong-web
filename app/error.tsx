'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-24 h-24 mx-auto text-orange-600 dark:text-orange-400 mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
          出错了
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mb-2">
          {error.message || '抱歉，页面遇到了意外错误'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-8">
            错误 ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            重试
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            返回工作台
          </a>
        </div>
      </div>
    </div>
  );
}