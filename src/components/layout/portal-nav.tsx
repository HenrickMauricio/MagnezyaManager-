"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/portal", label: "Início" },
  { href: "/portal/propostas", label: "Propostas" },
  { href: "/portal/reservas", label: "Reservas" },
  { href: "/portal/conta", label: "Conta" },
];

export function PortalNav({ pending }: { pending: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal" className="-mb-px flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.href === "/portal" ? pathname === "/portal" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[14px] font-medium transition-colors",
              active ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {link.label}
            {link.href === "/portal/propostas" && pending > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg">
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
