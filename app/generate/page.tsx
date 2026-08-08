import { redirect } from "next/navigation";

// 遗留路由：已并入 dashboard，永久重定向以保留旧书签可用性。
export default function LegacyRedirectPage() {
  redirect("/dashboard/script");
}
