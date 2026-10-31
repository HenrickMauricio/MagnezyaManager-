import { getVersionPdf } from "@/server/services/quotes";
import { pdfResponse } from "@/server/pdf/response";

/** PDF guardado de uma versão emitida (?versao=N; sem parâmetro, a última). */
export async function GET(request: Request, { params }: RouteContext<"/api/orcamentos/[id]/pdf">) {
  const { id } = await params;
  const raw = new URL(request.url).searchParams.get("versao");
  const version = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : undefined;
  const inline = new URL(request.url).searchParams.get("ver") === "1";
  return pdfResponse((user) => getVersionPdf(user, id, version), inline ? "inline" : "attachment");
}
