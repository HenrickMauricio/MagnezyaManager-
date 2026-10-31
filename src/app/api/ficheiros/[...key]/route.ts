import { getCurrentUser } from "@/server/auth/session";
import { CONTENT_TYPES, getObject, isValidStorageKey } from "@/server/services/storage";

/**
 * Serve ficheiros guardados (fotografias de artigos) apenas a utilizadores com
 * sessão e permissão. O acesso do portal do cliente entra na Fase 7.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/ficheiros/[...key]">) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sessão necessária.", { status: 401 });

  const key = (await params).key.join("/");
  if (!isValidStorageKey(key)) return new Response(null, { status: 404 });
  // Fotografias de artigos: equipa interna. Logótipo da empresa: qualquer sessão.
  if (key.startsWith("articles/")) {
    if (!user.permissions.has("article:view")) return new Response(null, { status: 403 });
  } else if (!key.startsWith("branding/")) {
    return new Response(null, { status: 404 });
  }

  const data = await getObject(key);
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[key.split(".").pop()!] ?? "application/octet-stream",
      // Chaves únicas por ficheiro: o conteúdo nunca muda para a mesma chave.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
