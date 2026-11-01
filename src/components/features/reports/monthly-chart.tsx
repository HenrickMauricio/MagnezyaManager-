import { cn } from "@/lib/cn";
import { formatCents, formatCentsCompact, formatInteger } from "@/lib/format";
import { MONTH_LABELS, MONTH_NAMES, niceTicks, type MonthRow } from "@/lib/reports";

const PLOT_HEIGHT = 220;

/**
 * Colunas da faturação mensal (sem IVA). Uma série: eventos já realizados na
 * cor principal; eventos futuros (confirmados) no tom claro, empilhados por cima.
 * O tooltip abre ao passar o rato ou com o teclado (Tab); a tabela abaixo do
 * gráfico tem todos os valores.
 */
export function MonthlyRevenueChart({ months, highlightMonth }: { months: MonthRow[]; highlightMonth?: number }) {
  const ticks = niceTicks(Math.max(...months.map((m) => m.netCents)));
  const top = ticks[ticks.length - 1]!;
  const peak = months.reduce((best, m) => (m.netCents > best.netCents ? m : best), months[0]!);
  const pct = (cents: number) => (top === 0 ? 0 : (cents / top) * 100);

  return (
    <div className="flex gap-2 px-4 pb-4 pt-6 sm:px-5">
      {/* Eixo Y */}
      <div className="relative w-12 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="tabular absolute right-0 translate-y-1/2 text-[11px] leading-none text-fg-subtle"
            style={{ bottom: `${pct(t)}%` }}
          >
            {t === 0 ? "0" : formatCentsCompact(t)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute inset-x-0 h-px bg-border" style={{ bottom: `${pct(t)}%` }} />
          ))}
          <div role="list" aria-label="Faturação por mês, sem IVA" className="absolute inset-0 grid grid-cols-12">
            {months.map((m, i) => {
              const both = m.pastNetCents > 0 && m.futureNetCents > 0;
              return (
                <div
                  key={m.month}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${MONTH_NAMES[i]}: ${formatCents(m.netCents)} sem IVA, ${m.count} ${m.count === 1 ? "proposta" : "propostas"}`}
                  className="group relative flex h-full flex-col items-center justify-end rounded-sm outline-none hover:bg-surface-2/70 focus:bg-surface-2/70 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {m === peak && m.netCents > 0 && (
                    <span
                      className="tabular pointer-events-none absolute whitespace-nowrap text-[11px] font-medium text-fg-muted"
                      style={{ bottom: `calc(${pct(m.netCents)}% + 4px)` }}
                    >
                      {formatCentsCompact(m.netCents)}
                    </span>
                  )}
                  {m.netCents > 0 && (
                    <div className="flex w-[min(24px,62%)] flex-col gap-[2px] transition-opacity group-hover:opacity-80" style={{ height: `${pct(m.netCents)}%` }}>
                      {m.futureNetCents > 0 && (
                        <div className="min-h-px rounded-t-[4px] bg-chart-1-light" style={{ flexGrow: m.futureNetCents }} />
                      )}
                      {m.pastNetCents > 0 && (
                        <div className={cn("min-h-px bg-chart-1", !both && "rounded-t-[4px]")} style={{ flexGrow: m.pastNetCents }} />
                      )}
                    </div>
                  )}

                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none invisible absolute top-0 z-10 w-48 rounded-md border border-border bg-surface px-3 py-2.5 text-left opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100",
                      i < 2 ? "left-0" : i > 9 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <div className="text-[12px] capitalize text-fg-muted">{MONTH_NAMES[i]}</div>
                    <div className="tabular text-[15px] font-semibold">{formatCents(m.netCents)}</div>
                    <div className="text-[11px] text-fg-subtle">sem IVA · {formatCents(m.totalCents)} com IVA</div>
                    {both && (
                      <div className="mt-2 space-y-1 border-t border-border pt-2 text-[12px]">
                        <TooltipRow swatch="bg-chart-1" label="Realizados" value={m.pastNetCents} />
                        <TooltipRow swatch="bg-chart-1-light" label="Futuros" value={m.futureNetCents} />
                      </div>
                    )}
                    <div className="mt-1.5 text-[12px] text-fg-muted">
                      {formatInteger(m.count)} {m.count === 1 ? "proposta aprovada" : "propostas aprovadas"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-12" aria-hidden>
          {months.map((m, i) => (
            <span
              key={m.month}
              className={cn("text-center text-[11px] text-fg-subtle", m.month === highlightMonth && "font-semibold text-fg")}
            >
              {MONTH_LABELS[i]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-fg-muted">
        <span className={cn("h-0.5 w-3 rounded-full", swatch)} />
        {label}
      </span>
      <span className="tabular font-medium">{formatCents(value)}</span>
    </div>
  );
}

/** Legenda — só quando o gráfico mostra os dois tons. */
export function MonthlyRevenueLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-chart-1" /> Eventos realizados
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-chart-1-light" /> Eventos futuros (confirmados)
      </span>
    </div>
  );
}
