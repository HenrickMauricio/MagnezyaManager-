import "server-only";
import { getCurrentUser, type CurrentUser } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";

/**
 * Resposta HTTP de um PDF gerado por um serviço, com verificação de sessão e
 * tradução dos erros de domínio para códigos HTTP.
 */
export async function pdfResponse(
  load: (user: CurrentUser) => Promise<{ pdf: Buffer; filename: string }>,
  disposition: "inline" | "attachment",
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sessão necessária.", { status: 401 });
  try {
    const { pdf, filename } = await load(user);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return new Response(err.message, { status: 404 });
    if (err instanceof ForbiddenError) return new Response(err.message, { status: 403 });
    if (err instanceof AppError) return new Response(err.message, { status: 409 });
    console.error(err);
    return new Response("Não foi possível gerar o PDF.", { status: 500 });
  }
}
