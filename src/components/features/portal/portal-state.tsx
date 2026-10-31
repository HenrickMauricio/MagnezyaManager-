import { Badge } from "@/components/ui/badge";
import type { PortalQuoteState } from "@/server/services/portal";

const LABELS: Record<PortalQuoteState, string> = {
  PENDENTE: "A aguardar a sua resposta",
  EM_REVISAO: "Em revisão",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
  CANCELADA: "Cancelada",
};

const TONE = {
  PENDENTE: "info",
  EM_REVISAO: "warning",
  APROVADA: "success",
  RECUSADA: "neutral",
  EXPIRADA: "neutral",
  CANCELADA: "neutral",
} as const;

export function PortalStateBadge({ state }: { state: PortalQuoteState }) {
  return <Badge tone={TONE[state]}>{LABELS[state]}</Badge>;
}

/** Estado de uma reserva explicado ao cliente. */
export const PORTAL_RENTAL_LABELS: Record<string, string> = {
  RESERVADO: "Reservado",
  CONFLITO_STOCK: "A confirmar disponibilidade",
  EM_PREPARACAO: "Em preparação",
  ENTREGUE: "Entregue",
  EM_DEVOLUCAO: "Recolha em curso",
  DEVOLVIDO: "Concluído",
};
