import { FloatingThemeToggle } from "@/components/theme/FloatingThemeToggle";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FloatingThemeToggle />
      {children}
    </>
  );
}
