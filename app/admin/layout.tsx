import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FloatingThemeToggle />
      {children}
    </>
  );
}
