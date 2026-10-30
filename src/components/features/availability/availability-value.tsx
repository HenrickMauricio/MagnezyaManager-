import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";

/** Nível de disponibilidade: esgotado / pouco / livre (menos de 25 % do stock = pouco). */
export function availabilityLevel(available: number, total: number): "out" | "low" | "ok" {
  if (available <= 0) return "out";
  if (total > 0 && available / total < 0.25) return "low";
  return "ok";
}

const LEVEL_CLASS = {
  out: "bg-danger-bg text-danger",
  low: "bg-warning-bg text-warning",
  ok: "bg-success-bg text-success",
} as const;

export function AvailabilityValue({
  available,
  total,
  unit,
  className,
}: {
  available: number;
  total: number;
  unit?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold",
        LEVEL_CLASS[availabilityLevel(available, total)],
        className,
      )}
    >
      {formatInteger(available)}
      {unit && <span className="ml-1 font-normal opacity-80">{unit}</span>}
    </span>
  );
}
