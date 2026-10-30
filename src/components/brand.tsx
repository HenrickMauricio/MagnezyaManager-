import { cn } from "@/lib/cn";

/**
 * Marca tipográfica provisória. Será substituída pelo logótipo oficial
 * (versões normal e branca) quando os ficheiros forem fornecidos.
 */
export function Wordmark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="font-display text-[19px] font-bold tracking-[0.22em]">MAGNEZYA</div>
      {subtitle && (
        <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.32em] opacity-60">Event Support</div>
      )}
    </div>
  );
}
