import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <SearchX className="size-10 text-fg-subtle" strokeWidth={1.5} />
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Não encontrámos esta página</h1>
      <p className="mt-2 max-w-sm text-[15px] text-fg-muted">
        O registo pode ter sido removido, ou o endereço está incorreto.
      </p>
      <Link href="/" className={buttonClasses({ className: "mt-8" })}>
        Voltar ao início
      </Link>
    </main>
  );
}
