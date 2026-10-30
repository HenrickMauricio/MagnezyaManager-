import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Primeiro nível de proteção (Next.js 16 "proxy", antigo middleware):
 * sem cookie de sessão → redireciona para /login.
 *
 * Isto é apenas uma barreira rápida. A validação real da sessão, do papel e
 * das permissões acontece no servidor (layouts, Server Actions e serviços).
 */
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
