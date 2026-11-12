"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function FloatingThemeToggle() {
  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
