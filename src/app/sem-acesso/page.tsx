import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requirePageUser } from "@/server/auth/session";
import { homePathFor } from "@/lib/permissions";

export const metadata = { title: "Sem acesso" };

export default async function NoAccessPage() {
  const user = await requirePageUser();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <ShieldX className="size-10 text-fg-subtle" strokeWidth={1.5} />
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Sem acesso a esta área</h1>
      <p className="mt-2 max-w-sm text-[15px] text-fg-muted">
        A sua conta não tem permissão para esta página. Se precisar de acesso, contacte um administrador.
      </p>
      <Link
        href={homePathFor(user.role)}
        className="mt-8 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-85"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
