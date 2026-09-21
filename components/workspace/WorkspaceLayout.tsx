"use client";

/**
 * 工作区的左右分栏骨架。
 *
 * 八个页面原本各自写外层容器，宽度从 380px 到 580px 不等、内边距 16–32px
 * 混用、有的自带背景色有的没有。切页面时侧栏宽度一跳一跳的，很难不注意到。
 *
 * 统一之后：侧栏定宽 470px（标签左置需要 88px 标签列，再窄两列卡片会被挤扁），
 * 容器不设背景——底色交给全站的氛围层，玻璃卡片才透得出光晕。
 */
export function WorkspaceLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="w-full shrink-0 overflow-y-auto border-b border-border/60 px-6 py-7 lg:w-[470px] lg:border-b-0 lg:border-r">
        <div className="space-y-4">{sidebar}</div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        <div className="mx-auto max-w-4xl space-y-5">{children}</div>
      </main>
    </div>
  );
}
