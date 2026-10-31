import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/validation/quotes";

const TONE = {
  RASCUNHO: "neutral",
  AGUARDANDO_APROVACAO: "warning",
  ENVIADO: "info",
  APROVADO: "success",
  REJEITADO: "danger",
  EXPIRADO: "warning",
  CANCELADO: "neutral",
} as const;

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={TONE[status]}>{QUOTE_STATUSES[status]}</Badge>;
}
