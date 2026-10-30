import { cn } from "@/lib/cn";
import { BRAND } from "@/config/brand";

/** Marca tipográfica da instalação (nome e subtítulo em src/config/brand.ts). */
export function Wordmark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="font-display text-[19px] font-bold uppercase tracking-[0.22em]">{BRAND.name}</div>
      {subtitle && (
        <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.32em] opacity-60">{BRAND.tagline}</div>
      )}
    </div>
  );
}
