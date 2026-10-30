import { Badge } from "@/components/ui/badge";
import { RENTAL_STATUSES, type RentalStatus } from "@/lib/validation/rentals";

export const RENTAL_TONE = {
  RESERVADO: "info",
  CONFLITO_STOCK: "danger",
  EM_PREPARACAO: "warning",
  ENTREGUE: "solid",
  EM_DEVOLUCAO: "warning",
  DEVOLVIDO: "success",
  CANCELADO: "neutral",
} as const;

/** Cor de cada estado no calendário (texto sobre fundo). */
export const RENTAL_COLORS: Record<RentalStatus, { bg: string; fg: string }> = {
  RESERVADO: { bg: "#276ef1", fg: "#ffffff" },
  CONFLITO_STOCK: { bg: "#c4161c", fg: "#ffffff" },
  EM_PREPARACAO: { bg: "#9a6700", fg: "#ffffff" },
  ENTREGUE: { bg: "#111111", fg: "#ffffff" },
  EM_DEVOLUCAO: { bg: "#c26a00", fg: "#ffffff" },
  DEVOLVIDO: { bg: "#0e8345", fg: "#ffffff" },
  CANCELADO: { bg: "#8a8a8a", fg: "#ffffff" },
};

export function RentalStatusBadge({ status, overdue }: { status: RentalStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone={RENTAL_TONE[status]}>{RENTAL_STATUSES[status]}</Badge>
      {overdue && <Badge tone="danger">Em atraso</Badge>}
    </span>
  );
}

/** Material com o cliente depois da data de recolha prevista. */
export function isOverdue(status: string, returnDateISO: string, todayISO: string): boolean {
  return (status === "ENTREGUE" || status === "EM_DEVOLUCAO") && returnDateISO < todayISO;
}
