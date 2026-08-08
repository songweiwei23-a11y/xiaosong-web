"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={isDark ? "切换到白天模式" : "切换到夜晚模式"}
      title={isDark ? "切换到白天模式" : "切换到夜晚模式"}
      className="relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-secondary px-1 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-transform duration-300 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-blue-300" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </span>
    </button>
  );
}
