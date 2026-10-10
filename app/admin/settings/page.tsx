"use client";

import Link from "next/link";
import { AlertTriangle, DollarSign, Database, ExternalLink, Ticket, ShieldCheck } from "lucide-react";
import { SUBSCRIPTION_PLANS, quotaSummary } from "@/lib/config/plans";
import { AdminPage, Badge, Panel } from "@/components/admin/kit";

/*
 * 系统设置：只读的配置总览。
 *
 * 为什么不留可编辑控件：以前这里有价格、额度、功能开关三组输入，点保存会提示「已保存」，
 * 但没有任何代码读这些配置——改了等于没改。一个不起作用的开关，比没有开关更危险：
 * 真出事时管理员会以为已经关停了某个功能。所以改为如实显示当前生效的配置，写明每一项在哪里改。
 */

export default function AdminSettingsPage() {
  const planIds = Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[];

  return (
    <AdminPage title="系统设置" subtitle="当前生效的配置，以及每一项在哪里改">
      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-[12.5px] text-muted-foreground">
          <p className="font-medium text-foreground">这一页是只读的</p>
          <p className="mt-1">
            之前这里有可编辑的价格、额度和功能开关，但它们存进数据库后没有任何代码读取，改了等于没改。已经撤掉，
            免得在需要的时候误以为某个功能被关停了。
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title={<span className="flex items-center gap-2"><DollarSign className="h-4 w-4" />套餐与额度</span>}
          action={<span className="text-[11.5px] text-muted-foreground">首页、会员页、收款页和服务端校验都从这里取值</span>}
        >
          <div className="space-y-3">
            {planIds.map((id) => {
              const plan = SUBSCRIPTION_PLANS[id];
              return (
                <div key={id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{plan.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {plan.price === 0 ? "免费" : `¥${plan.price}/月（只卖月付）`}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {quotaSummary(id).map((line) => (
                      <li key={line} className="text-[11.5px] text-muted-foreground">· {line}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
            改这里：<code className="rounded bg-foreground/10 px-1">lib/config/plans.ts</code>，改完重新部署
          </p>
        </Panel>

        <Panel title="其他配置在哪里改">
          <div className="space-y-2.5">
            <Row
              icon={Ticket}
              title="用户注册"
              desc="当前为邀请制。没有有效邀请码无法注册，由数据库触发器强制——绕过页面直接调接口也会被拒。"
              action={{ label: "去管理邀请码", href: "/admin/invitations" }}
            />
            <Row
              icon={ShieldCheck}
              title="谁能进后台"
              desc="管理员名单。撤销自己的权限是被禁止的，避免把所有人锁在外面。"
              action={{ label: "去权限管理", href: "/admin/permissions" }}
            />
            <Row
              icon={DollarSign}
              title="收款方式"
              desc="用户按收款码转账后上传截图，你在订单审核里核对后通过，套餐自动开通。"
              action={{ label: "去收款二维码", href: "/admin/qrcodes" }}
            />
            <Row
              icon={Database}
              title="各功能的开放范围"
              desc="由套餐额度决定：某档位的额度为 0，即该档位不开放这个功能。"
            />
          </div>
        </Panel>
      </div>
    </AdminPage>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: typeof Ticket;
  title: string;
  desc: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 p-4">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            {title}
            {!action && <Badge tone="neutral">只读</Badge>}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {action && (
        <Link href={action.href} className="flex shrink-0 items-center gap-1 text-[12px] text-primary hover:opacity-80">
          {action.label}
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
