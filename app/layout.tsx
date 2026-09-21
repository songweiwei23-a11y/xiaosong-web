// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
// 备选配色，放在 globals 之后以覆盖其中的色相变量
import './palettes.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AmbientBackground } from '@/components/theme/AmbientBackground';
import { FeedbackHost } from '@/components/ui/feedback';

export const metadata: Metadata = {
  title: '小宋编导工作台 - AI短视频脚本生成',
  description: '3秒生成专业级短视频脚本，达到MCN团队水平（25/35分）',
};

// 在 React 接管前就把主题类名打上，否则首屏会先渲染成另一套配色再跳变。
// 默认值必须与 ThemeProvider 保持一致（深色），两处不同步就会闪一下。
const themeInitScript = `
(function() {
  try {
    var key = 'xiaosong-theme';
    var stored = localStorage.getItem(key);
    var theme = (stored === 'light' || stored === 'dark') ? stored : 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    // 配色方案同样要在首屏前定好，否则会先闪一下默认色再切换。
    // 默认值需与 components/theme/palettes.ts 的 DEFAULT_PALETTE 一致。
    var palette = localStorage.getItem('xiaosong-palette') || 'graphite';
    if (palette !== 'default') {
      document.documentElement.setAttribute('data-palette', palette);
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-palette', 'graphite');
  }
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
          {/* 全站背景氛围层。玻璃组件需要它垫在下面才透得出色彩 */}
          <AmbientBackground />
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
          <FeedbackHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
