'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * 版本检测组件
 * 每30秒检查一次是否有新版本部署
 * 有新版本时提示用户刷新页面
 */
export function VersionChecker() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);
  const baselineRef = useRef<string | null>(null);
  const promptedRef = useRef(false);

  useEffect(() => {
    let checking = false;
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const checkVersion = async () => {
      if (checking || promptedRef.current) return;
      checking = true;
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { buildId?: unknown };
        if (typeof data.buildId !== 'string' || !data.buildId) return;
        if (!baselineRef.current) {
          baselineRef.current = data.buildId;
          if (mounted) setCurrentBuildId(data.buildId);
          return;
        }
        if (data.buildId !== baselineRef.current) {
          promptedRef.current = true;
          if (mounted) setShowPrompt(true);
          if (interval) clearInterval(interval);
        }
      } catch {
        // 网络错误不改变基准版本，继续等待下一次成功检查。
      } finally {
        checking = false;
      }
    };

    void checkVersion();
    interval = setInterval(() => { void checkVersion(); }, 30_000);
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  if (!showPrompt) return null;

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl p-5 border-2 border-primary max-w-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="font-semibold text-sm mb-1">
              🎉 有新版本可用
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              开物已更新到最新版本，刷新页面即可使用新功能
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                立即刷新
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                稍后
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
