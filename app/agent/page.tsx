import { redirect } from "next/navigation";

// 代理后台已搬进工作台（2026-10-28）：旧地址 /agent 跳到 /dashboard/agent，保留发出去的链接可用
export default function LegacyAgentRedirect() {
  redirect("/dashboard/agent");
}
