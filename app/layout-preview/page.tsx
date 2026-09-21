"use client";

/**
 * 布局方向的线框预览页，用于选型。
 *
 * 只画结构不画内容：选布局时要看的是「信息怎么组织、密度多大、视线怎么走」，
 * 填上真实文字反而会被措辞和配色带偏注意力。
 *
 * 方向定下来后本页删除。
 */

import { useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";

type LayoutId = "current" | "wizard" | "refined" | "canvas";

const OPTIONS: {
  id: LayoutId;
  name: string;
  tagline: string;
  pros: string[];
  cons: string[];
  fit: string;
}[] = [
  {
    id: "current",
    name: "现在这样",
    tagline: "左侧 420px 表单，右侧结果区",
    pros: ["所有参数一屏可见，不用翻页", "你已经用习惯了"],
    cons: [
      "一屏塞十几个控件，压迫感强",
      "所有配置视觉权重相同，找不到重点",
      "结果区只剩一半宽，长脚本读起来费劲",
    ],
    fit: "参数少的工具。但这个页面参数太多了",
  },
  {
    id: "wizard",
    name: "A · 分步向导",
    tagline: "拆成 3 步，一次只做一件事",
    pros: [
      "每屏内容少，留白充足，观感最干净",
      "新手不会被一堆选项吓住",
      "天然引导：先想清楚说什么，再管怎么拍",
    ],
    cons: [
      "改参数要退回上一步，熟练后嫌慢",
      "你每天用，可能觉得多点了两下",
    ],
    fit: "面向新用户、或想把产品做成「傻瓜式」时最合适",
  },
  {
    id: "refined",
    name: "B · 精简双栏",
    tagline: "保持左右结构，但只露必填，其余收起",
    pros: [
      "改动最小，操作习惯不变",
      "默认只看 4 个必填项，高级选项要用才展开",
      "间距字号放大后，同样内容观感差很多",
    ],
    cons: ["本质还是表单，上限没有 A 和 C 高"],
    fit: "想要立刻变好看、又不想改操作习惯",
  },
  {
    id: "canvas",
    name: "C · 顶栏 + 全宽结果",
    tagline: "参数收进顶部一条，结果占满整屏",
    pros: [
      "结果区宽度翻倍，长脚本阅读体验最好",
      "参数不用时完全不占地方",
      "最像成熟的专业工具",
    ],
    cons: [
      "参数藏在抽屉里，频繁调整时要反复开合",
      "改动最大，需要重新适应",
    ],
    fit: "以「读结果、改结果」为主的使用方式",
  },
];

/* ---------- 线框基础件 ---------- */

function Block({
  h,
  label,
  tone = "muted",
  className = "",
}: {
  h: number;
  label?: string;
  tone?: "muted" | "line" | "brand" | "text";
  className?: string;
}) {
  const tones = {
    muted: "bg-foreground/[0.07] border border-foreground/10",
    line: "bg-transparent border border-dashed border-foreground/20",
    brand: "bg-primary/25 border border-primary/40",
    text: "bg-foreground/15",
  };
  return (
    <div
      style={{ height: h }}
      className={`flex items-center justify-center rounded-lg ${tones[tone]} ${className}`}
    >
      {label && (
        <span className="px-2 text-center text-[10px] leading-tight text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      {/* 顶栏示意 */}
      <div className="flex h-8 items-center gap-1.5 border-b border-border/60 px-3">
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
        <span className="h-2 w-2 rounded-full bg-foreground/20" />
      </div>
      <div className="flex" style={{ height: 420 }}>
        {/* 侧边栏示意，四个方案都一样，不参与对比 */}
        <div className="w-14 shrink-0 space-y-1.5 border-r border-border/60 p-2">
          <Block h={18} tone="brand" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Block key={i} h={14} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- 四种布局 ---------- */

function CurrentWire() {
  return (
    <Frame>
      {/* 左：密集表单 */}
      <div className="w-[42%] shrink-0 space-y-1.5 overflow-hidden border-r border-border/60 p-2">
        <Block h={20} label="标题" tone="text" />
        <div className="grid grid-cols-2 gap-1.5">
          <Block h={22} />
          <Block h={22} />
        </div>
        {/* 密集控件：刻意画满，反映一屏塞十几个的现状 */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Block h={8} tone="text" className="w-1/3" />
            <Block h={i % 3 === 0 ? 28 : 18} />
          </div>
        ))}
        <Block h={26} tone="brand" label="生成" />
      </div>
      {/* 右：结果 */}
      <div className="flex-1 space-y-2 p-3">
        <Block h={14} tone="text" className="w-1/3" />
        <Block h={80} label="历史记录" />
        <Block h={200} label="结果区（宽度只有一半）" tone="line" />
      </div>
    </Frame>
  );
}

function WizardWire() {
  return (
    <Frame>
      <div className="flex flex-1 flex-col p-4">
        {/* 步骤条 */}
        <div className="mb-5 flex items-center gap-2">
          <Block h={22} tone="brand" className="w-24" label="① 说什么" />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Block h={22} className="w-24" label="② 怎么说" />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Block h={22} className="w-24" label="③ 怎么拍" />
        </div>
        {/* 当前步：内容少、块大、留白足 */}
        <div className="mx-auto w-full max-w-md space-y-4">
          <Block h={12} tone="text" className="w-24" />
          <Block h={56} label="视频主题" />
          <Block h={12} tone="text" className="w-24" />
          <div className="grid grid-cols-2 gap-3">
            <Block h={48} />
            <Block h={48} />
            <Block h={48} />
            <Block h={48} />
          </div>
          <Block h={40} tone="brand" label="下一步" />
        </div>
      </div>
    </Frame>
  );
}

function RefinedWire() {
  return (
    <Frame>
      {/* 左：只露必填，其余折叠 */}
      <div className="w-[34%] shrink-0 space-y-3 border-r border-border/60 p-3">
        <Block h={16} tone="text" className="w-1/2" />
        <div className="space-y-2">
          <Block h={10} tone="text" className="w-1/3" />
          <Block h={44} label="主题" />
        </div>
        <div className="space-y-2">
          <Block h={10} tone="text" className="w-1/3" />
          <div className="grid grid-cols-2 gap-2">
            <Block h={34} />
            <Block h={34} />
          </div>
        </div>
        {/* 折叠起来的高级选项 */}
        <Block h={30} tone="line" label="进阶设置  ▾" />
        <Block h={30} tone="line" label="拍摄条件  ▾" />
        <Block h={30} tone="line" label="账号关联  ▾" />
        <div className="pt-1">
          <Block h={36} tone="brand" label="生成" />
        </div>
      </div>
      {/* 右：结果区变宽 */}
      <div className="flex-1 space-y-2.5 p-3">
        <div className="flex items-center justify-between">
          <Block h={14} tone="text" className="w-24" />
          <div className="flex gap-1.5">
            <Block h={14} className="w-10" />
            <Block h={14} className="w-10" />
          </div>
        </div>
        <Block h={250} label="结果区（比现在宽约三成）" tone="line" />
        <Block h={60} label="历史记录（收到下面）" />
      </div>
    </Frame>
  );
}

function CanvasWire() {
  return (
    <Frame>
      <div className="flex flex-1 flex-col">
        {/* 顶部参数条 */}
        <div className="flex items-center gap-2 border-b border-border/60 p-2.5">
          <Block h={28} className="flex-1" label="视频主题" />
          <Block h={28} className="w-20" label="类型" />
          <Block h={28} className="w-16" label="时长" />
          <Block h={28} tone="line" className="w-16" label="更多 ⋯" />
          <Block h={28} tone="brand" className="w-16" label="生成" />
        </div>
        {/* 全宽结果 */}
        <div className="flex-1 space-y-2 p-4">
          <div className="flex items-center justify-between">
            <Block h={16} tone="text" className="w-28" />
            <div className="flex gap-1.5">
              <Block h={16} className="w-12" />
              <Block h={16} className="w-12" />
            </div>
          </div>
          <Block h={300} label="结果区（整屏宽度，阅读体验最好）" tone="line" />
        </div>
      </div>
    </Frame>
  );
}

const WIRES: Record<LayoutId, () => JSX.Element> = {
  current: CurrentWire,
  wizard: WizardWire,
  refined: RefinedWire,
  canvas: CanvasWire,
};

export default function LayoutPreviewPage() {
  const [active, setActive] = useState<LayoutId>("refined");
  const opt = OPTIONS.find((o) => o.id === active)!;
  const Wire = WIRES[active];

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">布局方向对比</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            只画结构不填内容——选布局看的是信息怎么组织、密度多大，填上文字反而会被内容带偏
          </p>
        </div>

        {/* 切换 */}
        <div className="glass-panel mb-5 flex flex-wrap gap-1 rounded-2xl p-1">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setActive(o.id)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                active === o.id
                  ? "btn-brand"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Wire />

          {/* 说明 */}
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-5">
              <div className="text-[15px] font-semibold">{opt.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{opt.tagline}</div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                好处
              </div>
              <ul className="space-y-2">
                {opt.pros.map((p) => (
                  <li key={p} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/85">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                代价
              </div>
              <ul className="space-y-2">
                {opt.cons.map((c) => (
                  <li key={c} className="flex gap-2 text-sm">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                适合谁
              </div>
              <p className="text-sm text-foreground/85">{opt.fit}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel mt-5 rounded-2xl p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">三个方案都会同时做这些：</span>
            正文字号从 13px 回到 15px、卡片内边距从 12px 提到 20px、
            阴影收敛成三级、圆角全站统一。这些是地基，跟选哪个方向无关——
            现在界面里 87% 的文字都是 12–13px，间距八成用的是最小档 8px，
            这才是「不高级」最直接的来源。
          </p>
        </div>
      </div>
    </div>
  );
}
