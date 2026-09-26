"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Plus, Settings, User } from "lucide-react";
import { getActiveProfileId, onActiveProfileChange, setActiveProfileId } from "@/lib/active-profile";
import { profileCompletion } from "@/lib/profile-options";
import { AdaptivePopover } from "@/components/ui/AdaptivePopover";

/**
 * 首页右上角的「切换档案」：点开就是档案列表，点哪个切哪个。
 *
 * 原来这个按钮只是跳到档案管理页，而那一页只能编辑、删除，根本没有"切换"——
 * 按钮写着切换，点过去切不了，看着就是没反应。
 * 切换走统一入口 setActiveProfileId：侧边栏、首页、各创作板块都会收到广播跟着变。
 */
interface ProfileRow {
  id: string;
  profile_name: string;
  account_platform?: string[] | null;
  [key: string]: unknown;
}

export function ProfileQuickSwitch({ loading, hasProfile }: { loading: boolean; hasProfile: boolean }) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 当前是哪个：打开时读，别处切了也跟着变
  useEffect(() => {
    setActiveId(getActiveProfileId());
    return onActiveProfileChange(() => setActiveId(getActiveProfileId()));
  }, []);

  // 每次打开都重新取一遍，刚改过的档案、刚算好的完整度都是新的
  useEffect(() => {
    if (!open) return;
    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setProfiles(Array.isArray(list) ? list : []))
      .catch(() => setProfiles([]));
  }, [open]);

  // 点外面、按 Esc 收起
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // 手机上列表挂在 body 上，不在按钮那棵树里，也要算"里面"
      const t = e.target as Node;
      if (boxRef.current && !boxRef.current.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!loading && !hasProfile) {
    return (
      <Link
        href="/dashboard/profiles/new"
        className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-[13px]"
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
        创建档案
      </Link>
    );
  }

  const pick = (p: ProfileRow) => {
    setOpen(false);
    if (p.id === activeId) return;
    setActiveProfileId(p.id, p);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="glass-panel glass-interactive flex items-center gap-2 rounded-xl px-4 py-2 text-[13px]"
      >
        <User className="h-4 w-4 text-muted-foreground" />
        {loading ? "档案" : "切换档案"}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/*
        电脑上挂在按钮下面；手机上从底部升起。原来手机上按钮被挤到左边，
        以按钮右缘为基准往左展开的列表大半截伸到屏幕外
      */}
      <AdaptivePopover
        open={open}
        onClose={() => setOpen(false)}
        panelRef={panelRef}
        title="切换档案"
        desktopClassName="glass-panel absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl p-2 shadow-xl"
      >
        <div>
          <p className="px-2 pb-1.5 pt-1 text-[11px] text-muted-foreground max-sm:hidden">选择工作档案</p>
          {profiles === null ? (
            <div className="space-y-1.5 p-1">
              <div className="h-10 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ) : (
            <ul role="listbox" className="max-h-72 space-y-0.5 overflow-y-auto">
              {profiles.map((p) => {
                const active = p.id === activeId;
                const pct = profileCompletion(p).percent;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(p)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                        active ? "bg-primary/10" : "hover:bg-foreground/[0.05]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          active ? "bg-primary text-primary-foreground" : "border border-foreground/20"
                        }`}
                      >
                        {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] ${active ? "font-medium text-foreground" : "text-foreground/85"}`}>
                          {p.profile_name || "未命名档案"}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {p.account_platform?.[0] || "未设平台"} · 完整度 {pct}%
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-border/50 px-2 pt-2 text-[12px]">
            <Link
              href="/dashboard/profiles"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              管理档案
            </Link>
            <Link
              href="/dashboard/profiles/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-primary hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </Link>
          </div>
        </div>
      </AdaptivePopover>
    </div>
  );
}
