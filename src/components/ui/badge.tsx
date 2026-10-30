import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "solid" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  solid: "bg-primary text-primary-fg",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
