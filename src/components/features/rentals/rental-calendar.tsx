"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import ptLocale from "@fullcalendar/core/locales/pt";
import type { EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import { calendarRentalsAction } from "@/server/actions/rentals";
import { RENTAL_COLORS } from "@/components/features/rentals/rental-status";
import { toast } from "@/components/ui/toast";
import { addDaysISO } from "@/lib/format";
import { cn } from "@/lib/cn";
import { RENTAL_STATUSES, type RentalStatus } from "@/lib/validation/rentals";

const DEFAULT_STATUSES: RentalStatus[] = ["RESERVADO", "CONFLITO_STOCK", "EM_PREPARACAO", "ENTREGUE", "EM_DEVOLUCAO"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Calendário de reservas (FullCalendar, vistas gratuitas: mês, semana, lista).
 * Cada reserva ocupa da entrega à recolha; a cor indica o estado.
 */
export function RentalCalendar({ canOpen }: { canOpen: boolean }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<RentalStatus[]>(DEFAULT_STATUSES);

  async function loadEvents(info: EventSourceFuncArg): Promise<EventInput[]> {
    try {
      const rows = await calendarRentalsAction({ from: iso(info.start), to: iso(info.end), statuses });
      return rows.map((r) => ({
        id: r.id,
        title: `${r.number} · ${r.event} — ${r.client}${r.overdue ? " · EM ATRASO" : ""}`,
        start: r.deliveryDate,
        // FullCalendar usa fim exclusivo em eventos de dia inteiro.
        end: addDaysISO(r.displayEnd, 1),
        allDay: true,
        backgroundColor: RENTAL_COLORS[r.status].bg,
        borderColor: r.overdue ? "#c4161c" : RENTAL_COLORS[r.status].bg,
        classNames: r.overdue ? ["mz-overdue"] : [],
        textColor: RENTAL_COLORS[r.status].fg,
        extendedProps: { status: r.status, city: r.city },
      }));
    } catch {
      toast.error("Não foi possível carregar as reservas.");
      return [];
    }
  }

  // Mudar os filtros cria uma nova função de eventos: o calendário volta a carregar sozinho.
  function toggle(status: RentalStatus) {
    setStatuses((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status]));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {(Object.keys(RENTAL_STATUSES) as RentalStatus[]).map((s) => {
          const active = statuses.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(s)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors",
                active ? "border-border-strong bg-surface" : "border-border bg-surface-2 text-fg-subtle",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: active ? RENTAL_COLORS[s].bg : "transparent", border: `1.5px solid ${RENTAL_COLORS[s].bg}` }}
              />
              {RENTAL_STATUSES[s]}
            </button>
          );
        })}
      </div>

      <div className="mz-calendar rounded-lg border border-border bg-surface p-3 sm:p-5">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          locale={ptLocale}
          initialView="dayGridMonth"
          firstDay={1}
          height="auto"
          dayMaxEvents={4}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek,listMonth" }}
          buttonText={{ today: "Hoje", month: "Mês", week: "Semana", list: "Lista" }}
          events={loadEvents}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            if (canOpen) router.push(`/reservas/${info.event.id}`);
          }}
          eventClassNames={canOpen ? "cursor-pointer" : undefined}
        />
      </div>
    </div>
  );
}
