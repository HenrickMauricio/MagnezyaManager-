import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { getArticleAvailability } from "@/server/services/availability";
import { availabilityLevel } from "@/components/features/availability/availability-value";
import { PeriodFilter } from "@/components/period-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { dateOnlyToISO, formatInteger, formatISODate, todayISO } from "@/lib/format";
import { parsePeriod } from "@/lib/validation/period";
import { RENTAL_STATUSES, type RentalStatus } from "@/lib/validation/rentals";

export const metadata: Metadata = { title: "Disponibilidade do artigo" };

const MAX_DAYS = 62;
const WEEKDAY = new Intl.DateTimeFormat("pt-PT", { weekday: "short", timeZone: "UTC" });
const CELL = {
  out: "border-danger/30 bg-danger-bg",
  low: "border-warning/30 bg-warning-bg",
  ok: "border-border bg-surface",
} as const;

export default async function ArticleAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requirePagePermission("availability:view");
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const today = todayISO();
  const { from, to } = parsePeriod(raw, today, { defaultDays: 14, maxDays: MAX_DAYS });
  const data = await getArticleAvailability(user, id, from, to);
  if (!data) notFound();
  const { article, days, summary, rentals, maintenances } = data;
  const total = days[0]?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        back={{ href: `/disponibilidade?de=${from}&ate=${to}`, label: "Disponibilidade" }}
        eyebrow={`${article.category.name} · ${article.sku}`}
        title={article.name}
        actions={
          user.permissions.has("article:view") && (
            <Link href={`/artigos/${article.id}`} className="text-[13px] font-medium text-fg-muted hover:text-fg">
              Ver ficha do artigo
            </Link>
          )
        }
      />
      <PeriodFilter from={from} to={to} today={today} maxDays={MAX_DAYS} />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Disponível no período (mínimo)" value={`${formatInteger(summary.minAvailable)} ${article.unit}`} hint={`a ${formatISODate(summary.minDate)}`} />
        <StatCard label="Reservado (máximo num dia)" value={`${formatInteger(summary.maxReserved)} ${article.unit}`} />
        <StatCard
          label="Preparação após recolha"
          value={`${article.category.prepBufferDays} ${article.category.prepBufferDays === 1 ? "dia" : "dias"}`}
          hint="Definido na categoria"
        />
      </section>

      <Card>
        <CardHeader title="Dia a dia" description="Unidades livres em cada dia (reservado e em manutenção por baixo)." />
        <ol className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 md:grid-cols-7">
          {days.map((d) => {
            const level = availabilityLevel(d.available, d.total);
            const date = new Date(`${d.date}T00:00:00Z`);
            return (
              <li
                key={d.date}
                className={cn("rounded-md border px-3 py-2.5", CELL[level], d.date === today && "ring-2 ring-fg")}
              >
                <div className="flex items-baseline justify-between text-[12px] text-fg-muted">
                  <span className="capitalize">{WEEKDAY.format(date).replace(".", "")}</span>
                  <span className="tabular">{formatISODate(d.date).slice(0, 5)}</span>
                </div>
                <div className={cn("tabular mt-1 font-display text-[22px] font-semibold", level === "out" && "text-danger")}>
                  {formatInteger(d.available)}
                </div>
                <div className="tabular text-[11px] text-fg-subtle">
                  res. {formatInteger(d.reserved)}
                  {d.maintenance > 0 && ` · man. ${formatInteger(d.maintenance)}`}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Reservas que ocupam este artigo" description="No período escolhido, incluindo dias de preparação." />
        {rentals.length === 0 ? (
          <EmptyState title="Sem reservas neste período" />
        ) : (
          <ul className="divide-y divide-border">
            {rentals.map((r) => {
              const quantity = r.items.reduce((s, i) => s + i.quantity - i.quantityReturned, 0);
              const label = (
                <span className="font-medium">
                  {r.number} · {r.event.name}
                </span>
              );
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    {user.permissions.has("rental:view") ? (
                      <Link href={`/reservas/${r.id}`} className="hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                    <div className="text-[13px] text-fg-muted">
                      {r.client.name} · {formatISODate(dateOnlyToISO(r.deliveryDate))} – {formatISODate(dateOnlyToISO(r.returnDate))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{RENTAL_STATUSES[r.status as RentalStatus]}</Badge>
                    <span className="tabular text-[14px] font-medium">
                      {formatInteger(quantity)} {article.unit}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {maintenances.length > 0 && (
          <p className="border-t border-border px-5 py-3 text-[13px] text-fg-muted">
            {maintenances.length} {maintenances.length === 1 ? "registo" : "registos"} de manutenção ocupam unidades neste período.
          </p>
        )}
      </Card>
      {total === 0 && <p className="text-[13px] text-fg-muted">Este artigo não tem stock.</p>}
    </div>
  );
}
