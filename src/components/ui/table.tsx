import Link from "next/link";
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[640px] border-collapse text-left text-[14px]", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-5 py-3.5 align-middle", className)} {...props} />;
}

/** Linha clicável: o link principal ocupa a linha inteira (acessível por teclado). */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium after:absolute after:inset-0 hover:underline">
      {children}
    </Link>
  );
}

export const rowClass = "relative transition-colors hover:bg-surface-2/60";

/** Constrói um URL de lista mantendo os filtros atuais. */
export function listHref(
  path: string,
  params: Record<string, string | number | undefined>,
  defaults: Record<string, string | number> = {},
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || defaults[key] === value) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    "inline-flex size-9 items-center justify-center rounded-md border border-border text-fg transition-colors hover:bg-surface-2";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-[13px] text-fg-muted">
      <span className="tabular">
        {formatInteger(from)}–{formatInteger(to)} de {formatInteger(total)}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Link
            href={hrefFor(page - 1)}
            aria-label="Página anterior"
            aria-disabled={page <= 1}
            className={cn(btn, page <= 1 && disabled)}
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="tabular px-1">
            {page} / {pages}
          </span>
          <Link
            href={hrefFor(page + 1)}
            aria-label="Página seguinte"
            aria-disabled={page >= pages}
            className={cn(btn, page >= pages && disabled)}
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
