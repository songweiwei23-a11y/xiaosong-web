"use client";

/**
 * 配色选型用的预览页。
 *
 * 不放在 /dashboard 下是有意为之：那里需要登录，而选配色时要能随手打开对比。
 * 页面刻意还原工作台的真实组件（侧边栏、折叠面板、选项卡片、按钮、正文），
 * 因为配色好不好看只有放进真实密度的界面里才看得出来——色卡图没有参考价值。
 *
 * 配色定下来后，本页连同 PaletteSwitcher 一起删除。
 */

import { useState } from "react";
import {
  FileText, Lightbulb, Film, CheckCircle, Tag, Target,
  Sparkles, Copy, Download, ChevronDown, Home,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV_GROUPS = [
  { label: null, items: [{ name: "工作台", icon: Home }] },
  {
    label: "内容创作",
    items: [
      { name: "选题策划", icon: Lightbulb },
      { name: "脚本生成", icon: FileText },
      { name: "分镜脚本", icon: Film },
      { name: "审稿优化", icon: CheckCircle },
      { name: "标题封面", icon: Tag },
    ],
  },
  { label: "账号运营", items: [{ name: "账号定位", icon: Target }] },
];

const SCRIPT_TYPES = [
  { key: "teach", label: "教知识型", desc: "分享专业知识" },
  { key: "show", label: "晒过程型", desc: "展示完整过程" },
  { key: "talk", label: "聊观点型", desc: "表达独特见解" },
  { key: "story", label: "讲故事型", desc: "故事化吸引" },
];

const ELEMENTS = ["成本", "人群", "头牌", "奇葩", "最差", "反差", "怀旧", "荷尔蒙"];

export default function PalettePreviewPage() {
  const [activeNav, setActiveNav] = useState("脚本生成");
  const [scriptType, setScriptType] = useState("teach");
  const [picked, setPicked] = useState<string[]>(["反差", "怀旧"]);
  const [tab, setTab] = useState<"content" | "ad">("content");

  const toggle = (e: string) =>
    setPicked((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <aside className="glass hidden w-[272px] shrink-0 flex-col border-y-0 border-l-0 md:flex">
        <div className="flex h-[72px] items-center gap-3 px-5">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-primary/25">
            <Sparkles className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">小宋编导工作台</div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              AI 短视频创作智能体
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-4">
          {NAV_GROUPS.map((g, gi) => (
            <div key={g.label ?? gi} className={gi === 0 ? "" : "mt-5"}>
              {g.label && (
                <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {g.label}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = activeNav === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveNav(item.name)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-primary/12 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="brand-gradient absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                      )}
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          active ? "text-primary" : ""
                        }`}
                      />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <div className="glass sticky top-0 z-20 flex h-[72px] items-center justify-between gap-4 border-x-0 border-t-0 px-6">
          <div>
            <div className="text-[15px] font-semibold">配色预览</div>
            <div className="text-xs text-muted-foreground">
              右下角调色板切换方案 · 这里切明暗
            </div>
          </div>
          <ThemeToggle />
        </div>

        <main className="flex-1 p-6">
          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
            {/* 左列：表单类组件 */}
            <div className="space-y-5">
              {/* 分段控件 */}
              <div className="glass-panel flex gap-1 rounded-2xl p-1">
                {(["content", "ad"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                      tab === t
                        ? "btn-brand"
                        : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                    }`}
                  >
                    {t === "content" ? "📝 内容创作" : "💰 广告引流"}
                  </button>
                ))}
              </div>

              {/* 折叠面板 + 选项卡片 */}
              <div className="glass-panel overflow-hidden rounded-2xl">
                <div className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12">
                      <FileText className="h-4 w-4 text-primary" />
                    </span>
                    <span className="text-[15px] font-medium">基础设置</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-4 border-t border-border/60 p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">脚本类型</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SCRIPT_TYPES.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setScriptType(s.key)}
                          className={`glass-interactive rounded-xl border p-3 text-left text-sm ${
                            scriptType === s.key
                              ? "glass-selected text-foreground"
                              : "glass-panel text-foreground/90"
                          }`}
                        >
                          <div className="font-medium">{s.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">视频主题</label>
                    <textarea
                      defaultValue="普通人做短视频最容易踩的3个坑"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-border bg-background/50 p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">爆款元素</label>
                    <div className="flex flex-wrap gap-2">
                      {ELEMENTS.map((e) => (
                        <button
                          key={e}
                          onClick={() => toggle(e)}
                          className={`glass-interactive rounded-xl border px-3 py-1.5 text-xs ${
                            picked.includes(e)
                              ? "glass-selected text-foreground"
                              : "glass-panel text-muted-foreground"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
                    💡 提示信息长这样：已选 {picked.length} 个元素
                  </div>
                </div>
              </div>

              <button className="btn-brand w-full rounded-2xl py-4 font-semibold">
                ✨ 生成专业脚本
              </button>
            </div>

            {/* 右列：结果类组件 */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">生成结果</h2>
                <div className="flex gap-2">
                  <button className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
                    <Copy className="h-4 w-4" />
                    复制
                  </button>
                  <button className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
                    <Download className="h-4 w-4" />
                    下载
                  </button>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-7">
                <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:leading-relaxed">
                  <h3>开篇钩子（0-3秒）</h3>
                  <p>
                    你有没有发现，同样是拍探店视频，有人一条涨粉两万，
                    有人拍了三十条还是个位数播放。差别不在设备，在这三个地方。
                  </p>
                  <h3>中段干货（3-45秒）</h3>
                  <p>
                    第一个坑是<strong>定位模糊</strong>。很多人开号就是一通乱拍，
                    今天美食明天穿搭，算法根本不知道该把你推给谁。
                  </p>
                  <ul>
                    <li>定位要窄到一句话说得清</li>
                    <li>前十条内容必须同一个方向</li>
                  </ul>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm font-medium">历史记录</span>
                  <span className="text-sm text-muted-foreground">(39)</span>
                </div>
                <div className="space-y-2">
                  {["脚本策略卡 1. 目标用户：刚入局短视频的实体老板…", "回答你的问题 上一条脚本写的内容…"].map(
                    (t, i) => (
                      <div key={i} className="glass-panel glass-interactive rounded-xl p-3">
                        <p className="line-clamp-2 text-sm">{t}</p>
                        <p className="mt-1 text-xs text-muted-foreground">2026/9/21 17:59:05</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* 文字层级：高级感很大程度取决于层级是否拉得开 */}
              <div className="glass-panel rounded-2xl p-6">
                <div className="mb-3 text-sm font-medium">文字层级</div>
                <p className="text-foreground">主要文字 foreground</p>
                <p className="text-foreground/80">次级文字 foreground/80</p>
                <p className="text-muted-foreground">辅助文字 muted-foreground</p>
                <p className="text-primary">强调文字 primary</p>
                <p className="brand-text font-semibold">品牌渐变文字</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
