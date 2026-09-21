import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/10 px-4">
      <div className="text-center max-w-md">
        <FileQuestion className="w-24 h-24 mx-auto text-primary mb-6" />
        <h1 className="text-6xl font-bold text-foreground dark:text-foreground mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-foreground dark:text-foreground mb-4">
          页面不存在
        </h2>
        <p className="text-muted-foreground dark:text-muted-foreground mb-8">
          抱歉，您访问的页面不存在或已被移除
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 brand-gradient text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            进入工作台
          </Link>
          <Link
            href="/"
            className="px-6 py-3 glass-panel border border-border dark:border-border text-foreground dark:text-foreground rounded-lg font-medium hover:bg-foreground/[0.06] dark:hover:bg-muted transition-all"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}