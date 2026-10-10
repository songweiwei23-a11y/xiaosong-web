import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_WECHAT } from "@/lib/config/contact";

/**
 * 隐私政策、服务条款共用的版式。
 *
 * 首页页脚原来有「隐私政策」「服务条款」两个链接，都是 href="#"，点了没反应。
 * 这个产品在收邮箱、账号档案和付款截图，这两份东西不能没有。
 */
export const LEGAL_UPDATED = "2026 年 9 月 24 日";

/** updated：这一份自己的更新日期。两份不一定同时改，改了哪份就只动哪份的日期 */
export function LegalPage({
  title,
  updated = LEGAL_UPDATED,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <article className="mx-auto max-w-3xl">
        {/* 上下留出点击范围：手机上 20px 高的一行字很难点中 */}
        <Link href="/" className="-my-2 mb-6 inline-flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mb-10 text-sm text-muted-foreground">最后更新：{updated}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:mb-1.5 [&_p]:mb-3">
          {children}
        </div>
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          对本文有任何疑问，请加客服微信 {SUPPORT_WECHAT}（手机同号）。
        </p>
      </article>
    </div>
  );
}
