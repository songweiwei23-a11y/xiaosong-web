"use client";

/**
 * 工作区的左右分栏骨架。
 *
 * 八个页面原本各自写外层容器，宽度从 380px 到 580px 不等、内边距 16–32px
 * 混用、有的自带背景色有的没有。切页面时侧栏宽度一跳一跳的，很难不注意到。
 *
 * 统一之后：侧栏定宽 470px（标签左置需要 88px 标签列，再窄两列卡片会被挤扁），
 * 容器不设背景——底色交给全站的氛围层，玻璃卡片才透得出光晕。
 *
 * 【手机】上下排，而且不要里外两层滚动：原来两栏各自 overflow-y-auto，
 * 手机上表单一长，结果栏会被压成 0 高；现在手机上整页一起往下滚，
 * 结果接在表单下面（生成时 ResultPanel 会自己滚过去，见 id="workspace-result"）。
 * 内边距手机 16px，电脑 24/32px。
 */
export function WorkspaceLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:h-full lg:flex-row">
      <aside className="w-full border-b border-border/60 px-4 py-6 sm:px-6 lg:w-[470px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-7">
        <div className="space-y-4">{sidebar}</div>
      </aside>

      <main id="workspace-result" className="min-w-0 flex-1 scroll-mt-4 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:px-8 lg:py-7">
        <div className="mx-auto max-w-4xl space-y-5">{children}</div>
      </main>
    </div>
  );
}
