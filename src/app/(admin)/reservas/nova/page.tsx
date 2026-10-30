import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { listClientOptions } from "@/server/services/clients";
import { RentalForm } from "@/components/features/rentals/rental-form";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Nova reserva" };

export default async function NewRentalPage() {
  const user = await requirePagePermission("rental:manage");
  const [clients, articles] = await Promise.all([
    listClientOptions(user),
    prisma.article.findMany({
      where: { archivedAt: null, status: "ATIVO" },
      orderBy: { name: "asc" },
      select: { id: true, sku: true, name: true, unit: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Nova reserva"
        description="Reserva direta, sem orçamento (pedido por telefone, cliente habitual, evento interno)."
        back={{ href: "/reservas", label: "Reservas" }}
      />
      <RentalForm clients={clients.map(({ id, name }) => ({ id, name }))} articles={articles} />
    </div>
  );
}
