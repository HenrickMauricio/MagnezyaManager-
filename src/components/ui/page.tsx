import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-fg-muted">{eyebrow}</div>}
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
          {description && <p className="mt-1.5 text-[15px] text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 text-fg-subtle">{icon}</div>}
      <p className="font-display text-[16px] font-semibold tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[14px] text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Lista de pares etiqueta/valor (fichas de detalhe). */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; wide?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 px-5 py-5 text-[14px] sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className={cn(item.wide && "sm:col-span-2")}>
          <dt className="text-fg-muted">{item.label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words font-medium">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
