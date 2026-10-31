import { previewPdf } from "@/server/services/quotes";
import { pdfResponse } from "@/server/pdf/response";

/** Pré-visualização do estado atual do orçamento (marcada "RASCUNHO", não é guardada). */
export async function GET(_request: Request, { params }: RouteContext<"/api/orcamentos/[id]/pre-visualizacao">) {
  const { id } = await params;
  return pdfResponse((user) => previewPdf(user, id), "inline");
}
