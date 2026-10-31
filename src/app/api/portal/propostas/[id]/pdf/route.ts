import { getPortalPdf } from "@/server/services/portal";
import { pdfResponse } from "@/server/pdf/response";

/** PDF de uma proposta do próprio cliente (?versao=N; sem parâmetro, a última). */
export async function GET(request: Request, { params }: RouteContext<"/api/portal/propostas/[id]/pdf">) {
  const { id } = await params;
  const url = new URL(request.url);
  const raw = url.searchParams.get("versao");
  const version = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : undefined;
  return pdfResponse((user) => getPortalPdf(user, id, version), url.searchParams.get("ver") === "1" ? "inline" : "attachment");
}
