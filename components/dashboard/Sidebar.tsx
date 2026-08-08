"use client";

import ProfileSwitcher from '@/app/dashboard/components/ProfileSwitcher';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  FileText, 
  Lightbulb, 
  Film, 
  CheckCircle, 
  Tag, 
  Target,
  BookOpen,
  User,
  Home,
  Sparkles,
  Award,
  MessagesSquare
} from "lucide-react";

const navigation = [
  { name: "工作台", href: "/dashboard", icon: Home },
  { name: "脚本生成", href: "/dashboard/script", icon: FileText },
  { name: "高阶自由", href: "/dashboard/free-chat", icon: MessagesSquare },
  { name: "选题策划", href: "/dashboard/topic", icon: Lightbulb },
  { name: "分镜脚本", href: "/dashboard/storyboard", icon: Film },
  { name: "审稿优化", href: "/dashboard/review", icon: CheckCircle },
  { name: "标题封面", href: "/dashboard/title", icon: Tag },
  { name: "账号定位", href: "/dashboard/positioning", icon: Target },
  { name: "成交理由", href: "/dashboard/deal-reason", icon: Award },
  { name: "知识库", href: "/dashboard/knowledge", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Sparkles className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold text-foreground">小宋编导工作台</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Profile Switcher */}
      <div className="border-t border-border px-3 py-3">
        <ProfileSwitcher />
      </div>

      {/* User Section */}
      <div className="border-t border-border p-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <User className="h-5 w-5" />
          <div>
            <div className="font-medium text-foreground">个人中心</div>
            <div className="text-xs text-muted-foreground">免费版 • 5次/月</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
