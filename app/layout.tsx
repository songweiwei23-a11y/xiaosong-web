// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { FeedbackHost } from '@/components/ui/feedback';

export const metadata: Metadata = {
  title: '小宋编导工作台 - AI短视频脚本生成',
  description: '3秒生成专业级短视频脚本，达到MCN团队水平（25/35分）',
};

const themeInitScript = `
(function() {
  try {
    var key = 'xiaosong-theme';
    var stored = localStorage.getItem(key);
    var theme = stored;
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
          <FeedbackHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
