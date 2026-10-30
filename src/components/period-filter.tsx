"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/field";
import { addDaysISO } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Escolha do período ("de"/"até" no URL), com atalhos de 7, 14 e 30 dias. */
export function PeriodFilter({ from, to, today, maxDays }: { from: string; to: string; today: string; maxDays: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(de: string, ate: string) {
    const next = new URLSearchParams(params.toString());
    next.set("de", de);
    next.set("ate", ate);
    next.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  }

  const shortcuts = [7, 14, 30].filter((d) => d <= maxDays);
  const shortcut = "h-11 rounded-md px-3 text-[13px] font-medium transition-colors";

  return (
    <div className={cn("flex flex-wrap items-end gap-3", pending && "opacity-80")}>
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 shrink-0 text-fg-subtle" />
        <Input
          type="date"
          aria-label="De"
          value={from}
          onChange={(e) => e.target.value && apply(e.target.value, e.target.value > to ? e.target.value : to)}
          className="w-[160px]"
        />
        <span className="text-fg-subtle">–</span>
        <Input
          type="date"
          aria-label="Até"
          value={to}
          min={from}
          max={addDaysISO(from, maxDays - 1)}
          onChange={(e) => e.target.value && apply(from, e.target.value)}
          className="w-[160px]"
        />
      </div>
      <div className="flex gap-1">
        {shortcuts.map((days) => {
          const ate = addDaysISO(today, days - 1);
          const active = from === today && to === ate;
          return (
            <button
              key={days}
              type="button"
              onClick={() => apply(today, ate)}
              className={cn(shortcut, active ? "bg-primary text-primary-fg" : "bg-surface-2 hover:bg-surface-3")}
            >
              {days} dias
            </button>
          );
        })}
      </div>
    </div>
  );
}
