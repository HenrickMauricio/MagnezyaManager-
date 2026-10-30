"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  CalendarRange,
  FileText,
  FolderTree,
  LayoutGrid,
  Menu,
  Package,
  Settings,
  Truck,
  Users,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/cn";
import type { NavGroup, NavIcon } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutGrid,
  quotes: FileText,
  calendar: CalendarDays,
  availability: CalendarRange,
  rentals: Truck,
  articles: Package,
  categories: FolderTree,
  inventory: Boxes,
  clients: Users,
  users: UserCog,
  reports: BarChart3,
  settings: Settings,
};

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Navegação principal">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const soon = item.availableInPhase !== undefined;
              const content = (
                <>
                  <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {soon && (
                    <span className="rounded-full border border-white/15 px-1.5 py-px text-[10px] font-medium text-sidebar-muted">
                      Brevemente
                    </span>
                  )}
                </>
              );
              const base = "flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors";
              return (
                <li key={item.href}>
                  {soon ? (
                    <span
                      aria-disabled="true"
                      title={`Disponível na fase ${item.availableInPhase}`}
                      className={cn(base, "cursor-not-allowed text-sidebar-muted/70")}
                    >
                      {content}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        base,
                        active
                          ? "bg-sidebar-active text-sidebar-active-fg"
                          : "text-sidebar-fg/85 hover:bg-sidebar-hover hover:text-sidebar-fg",
                      )}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-fg lg:flex">
      <div className="px-6 pb-8 pt-7">
        <Wordmark />
      </div>
      <NavList groups={groups} />
    </aside>
  );
}

export function MobileNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  // Guarda o caminho em que o menu foi aberto: ao navegar, fecha-se sozinho.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = (value: boolean) => setOpenedAt(value ? pathname : null);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-fg hover:bg-surface-2 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="animate-slide-in absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sidebar text-sidebar-fg">
            <div className="flex items-center justify-between px-6 pb-8 pt-6">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sidebar-hover"
                aria-label="Fechar menu"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
