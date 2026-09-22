"use client";

import { DollarSign, Zap, ShieldCheck, Ticket, Database, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { SUBSCRIPTION_PLANS, quotaSummary } from "@/lib/config/plans";

/*
 * 系统设置 —— 改成一份只读的配置总览。
 *
 * 【为什么不留可编辑控件】这一页原先有三组输入：套餐价格、功能额度、
 * 功能开关（用户注册／支付／脚本生成／选题策划）。三组都会存进
 * system_settings 表，点保存也会提示「设置已保存」——但**没有任何代码
 * 读过这张表**。改价格不影响收款，改额度不影响校验，关掉「用户注册」
 * 照样能注册。
 *
 * 一个不起作用的开关比没有开关更危险：真出事时，管理员会以为自己
 * 已经关停了某个功能。所以整组撤掉，改为如实显示当前生效的配置，
 * 并写明每一项真正在哪里改。
 *
 * 也没有把它接成「数据库里的配置」。这个产品刚为「说的是一套、跑的是
 * 另一套」付过代价——价格曾经在四个地方各写一份，企业版首页写 199、
 * 收款页收 599。再开一个来源，等于又给自己埋一颗同样的雷。
 */

export default function AdminSettingsPage() {
  const planIds = Object.keys(SUBSCRIPTION_PLANS) as (keyof typeof SUBSCRIPTION_PLANS)[];

  return (
    <div className="h-full overflow-y-auto px-8 py-9">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground">系统设置</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            当前生效的配置，以及每一项在哪里改
          </p>
        </header>

        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-[12.5px] text-muted-foreground">
            <p className="font-medium text-foreground">这一页是只读的</p>
            <p className="mt-1">
              之前这里有价格、额度、功能开关三组可编辑项，改完会提示「保存成功」，
              但它们存进数据库后没有任何代码读——改了等于没改。已经撤掉，
              免得在需要的时候误以为某个功能被关停了。
            </p>
          </div>
        </div>

        {/* 套餐 */}
        <section className="glass-panel mb-4 rounded-2xl p-5">
          <h2 className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <DollarSign className="h-4 w-4" />
            套餐与额度
          </h2>
          <p className="mb-4 text-[11.5px] text-muted-foreground">
            首页、会员页、收款页和服务端的额度校验都从同一处取值
          </p>

          <div className="space-y-2.5">
            {planIds.map((id) => {
              const plan = SUBSCRIPTION_PLANS[id];
              return (
                <div key={id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{plan.name}</span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {plan.price === 0
                        ? "免费"
                        : `¥${plan.price}/月 · ¥${plan.yearlyPrice}/年（省 ¥${plan.price * 12 - plan.yearlyPrice}）`}
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

          <p className="mt-3 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
            改这里：<code className="rounded bg-foreground/10 px-1">lib/config/plans.ts</code>，改完重新部署
          </p>
        </section>

        {/* 其余几项的真实入口 */}
        <section className="glass-panel rounded-2xl p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <Zap className="h-4 w-4" />
            其他配置在哪里改
          </h2>

          <div className="space-y-2">
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
              desc="用户按收款码转账后上传截图，你在订单审核里放行，套餐自动开通。"
              action={{ label: "去传收款码", href: "/admin/qrcodes" }}
            />
            <Row
              icon={Database}
              title="各功能的开放范围"
              desc="由套餐额度决定：某档位的额度为 0，即该档位不开放这个功能。"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: typeof Zap;
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
          <div className="text-[13px] font-medium text-foreground">{title}</div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="flex shrink-0 items-center gap-1 text-[12px] text-primary hover:opacity-80"
        >
          {action.label}
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
