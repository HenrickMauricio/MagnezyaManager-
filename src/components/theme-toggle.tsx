"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemeToggle({ className }: { className?: string }) {
  // null no servidor: o tema só é conhecido no browser (script de arranque).
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    // 1 ano; SameSite=Lax; disponível no servidor para evitar "flash" de tema.
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const isDark = theme === "dark";
  const label = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      {theme === null ? (
        <span className="size-[18px]" />
      ) : isDark ? (
        <Sun className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <Moon className="size-[18px]" strokeWidth={1.75} />
      )}
    </button>
  );
}
