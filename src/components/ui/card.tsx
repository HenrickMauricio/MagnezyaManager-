import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="animate-fade-in p-5">
      <div className="flex items-center justify-between text-fg-muted">
        <span className="text-[13px] font-medium">{label}</span>
        {icon}
      </div>
      <div className="tabular mt-3 font-display text-[32px] font-semibold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-fg-subtle">{hint}</div>}
    </Card>
  );
}
