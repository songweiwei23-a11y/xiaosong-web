import { Sidebar } from "@/components/dashboard/Sidebar";
import { UserProfile } from "@/components/auth/UserProfile";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* Top Bar with User Info */}
        <div className="h-16 border-b border-border bg-card/80 backdrop-blur px-8 flex items-center justify-end gap-4">
          <ThemeToggle />
          <UserProfile />
        </div>
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
