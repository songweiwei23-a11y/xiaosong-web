"use client";

/**
 * 表单精细化对比页：同样的字段，左边是现在的做法，右边是调整后的做法。
 *
 * 并排放是有意的——单看任何一边都容易觉得「还行」，只有并排时
 * 对齐、间距、字号这些差异才会变得明显。
 *
 * 方案确认后本页删除，组件（Field / OptionCard / FieldGroup）留用。
 */

import { useState } from "react";
import { FileText, Lightbulb, Film, MessageSquare } from "lucide-react";
import { Field, OptionCard, FieldGroup } from "@/components/form/Field";
// 真实页面用的折叠分组，放进来一起看，确认两者观感一致
import { CollapsibleSection } from "@/components/form/CollapsibleSection";

const TYPES = [
  { key: "teach", label: "教知识型", desc: "分享有价值的专业知识", icon: FileText, accent: "sky" as const },
  { key: "show", label: "晒过程型", desc: "展示某件事的完整过程", icon: Film, accent: "amber" as const },
  { key: "talk", label: "聊观点型", desc: "表达独特的个人观点", icon: MessageSquare, accent: "violet" as const },
  { key: "story", label: "讲故事型", desc: "通过故事化内容吸引观众", icon: Lightbulb, accent: "emerald" as const },
];

const PLATFORMS = ["抖音", "快手", "视频号", "小红书"];
const DURATIONS = ["15秒", "30秒", "60秒", "3分钟"];
const ELEMENTS = ["成本", "人群", "头牌", "奇葩", "最差", "反差", "怀旧", "荷尔蒙"];

export default function FormPreviewPage() {
  const [type, setType] = useState("teach");
  const [platform, setPlatform] = useState("抖音");
  const [duration, setDuration] = useState("60秒");
  const [picked, setPicked] = useState<string[]>(["反差"]);

  const toggle = (e: string) =>
    setPicked((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">表单精细化对比</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            同样的字段，左右两种做法。并排看差异才明显——单看一边都容易觉得「还行」
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---------- 左：现在的做法 ---------- */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-lg bg-foreground/[0.08] px-2 py-1 text-[11px] text-muted-foreground">
                现在
              </span>
              <span className="text-xs text-muted-foreground">
                标签在上 · 字号 12–13px · 间距 8px
              </span>
            </div>

            <div className="glass-panel space-y-4 rounded-2xl p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  👤 选择档案（可选）
                </label>
                <select className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  <option>不使用档案</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">脚本类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className={`rounded-lg border p-3 text-left text-sm ${
                        type === t.key ? "glass-selected" : "glass-panel"
                      }`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  视频主题 <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  defaultValue="普通人做短视频最容易踩的3个坑"
                  className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">发布平台</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${
                        platform === p ? "glass-selected" : "glass-panel"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">视频时长</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${
                        duration === d ? "glass-selected" : "glass-panel"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  爆款元素（可多选）
                </label>
                <div className="flex flex-wrap gap-2">
                  {ELEMENTS.map((e) => (
                    <button
                      key={e}
                      onClick={() => toggle(e)}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${
                        picked.includes(e) ? "glass-selected" : "glass-panel"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">补充说明</label>
                <textarea
                  rows={2}
                  placeholder="希望的风格、目标人群、特殊要求等"
                  className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm"
                />
              </div>
            </div>
          </div>

          {/* ---------- 右：精细化后 ---------- */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-lg bg-primary/15 px-2 py-1 text-[11px] text-primary">
                精细化后
              </span>
              <span className="text-xs text-muted-foreground">
                标签左置 · 徽章 · 图标锚点 · 间距 20px
              </span>
            </div>

            <div className="space-y-4">
              <FieldGroup title="基础信息">
                <Field label="人设档案" optional>
                  <select className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option>不使用档案</option>
                  </select>
                </Field>

                {/* stacked：让出标签列、内容占满整行。多列网格在 430px 的侧栏里
                    若再扣掉 88px 标签列，卡片副标题会被挤成三行 */}
                <Field label="脚本类型" required stacked>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TYPES.map((t) => (
                      <OptionCard
                        key={t.key}
                        icon={t.icon}
                        title={t.label}
                        desc={t.desc}
                        accent={t.accent}
                        selected={type === t.key}
                        onClick={() => setType(t.key)}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="视频主题" required>
                  <textarea
                    rows={2}
                    defaultValue="普通人做短视频最容易踩的3个坑"
                    className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-[13px] leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </FieldGroup>

              {/* 这一组用真实页面的折叠分组，与上下两组的 FieldGroup 对比观感 */}
              <CollapsibleSection title="发布设置" defaultOpen>
                <Field label="发布平台" required>
                  {/* 分段控件：四选一用一个整体的槽，比四个独立描边按钮干净 */}
                  <div className="glass-panel inline-flex gap-0.5 rounded-xl p-1">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                          platform === p
                            ? "bg-primary/20 font-medium text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="视频时长" required>
                  <div className="glass-panel inline-flex gap-0.5 rounded-xl p-1">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
                          duration === d
                            ? "bg-primary/20 font-medium text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
              </CollapsibleSection>

              <FieldGroup title="创作风格">
                <Field
                  label="爆款元素"
                  optional
                  hint={`已选 ${picked.length} 个，建议 2–3 个`}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {ELEMENTS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggle(e)}
                        className={`glass-interactive rounded-lg border px-2.5 py-1.5 text-[12px] ${
                          picked.includes(e)
                            ? "glass-selected text-foreground"
                            : "glass-panel text-muted-foreground"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="补充说明" optional>
                  <textarea
                    rows={2}
                    placeholder="希望的风格、目标人群、特殊要求等"
                    className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-[13px] leading-relaxed placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </FieldGroup>

              <button className="btn-brand w-full rounded-2xl py-3.5 text-[15px] font-semibold">
                ✨ 生成专业脚本
              </button>
            </div>
          </div>
        </div>

        <div className="glass-panel mt-6 rounded-2xl p-5">
          <div className="mb-3 text-[13px] font-medium text-foreground">具体改了这几处</div>
          <ul className="grid gap-2 text-[13px] text-muted-foreground sm:grid-cols-2">
            <li>· 标签移到左侧定宽列，右侧内容形成对齐轴</li>
            <li>· 红色星号换成「必填 / 可选」徽章</li>
            <li>· 选项卡片加身份色图标，扫读有锚点</li>
            <li>· 平台、时长改用分段控件，不再是一排独立描边按钮</li>
            <li>· 字段间距 8px → 20px，卡片内边距 12px → 20px</li>
            <li>· 分组各自成卡片，不再是一长条折叠面板</li>
            <li>· 圆角 8px → 12/16px，与整站统一</li>
            <li>· 补充说明挂在字段下方，不再另起一行</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
