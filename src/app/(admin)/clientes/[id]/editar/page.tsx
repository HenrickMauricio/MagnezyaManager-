import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { getClient } from "@/server/services/clients";
import { updateClientAction } from "@/server/actions/clients";
import { orNotFound } from "@/server/page-helpers";
import { ClientForm } from "@/components/features/clients/client-form";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("client:edit");
  const c = await orNotFound(getClient(user, id));
  if (c.archivedAt) redirect(`/clientes/${id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Editar cliente" eyebrow={c.name} back={{ href: `/clientes/${id}`, label: "Ficha do cliente" }} />
      <ClientForm
        action={updateClientAction.bind(null, id)}
        submitLabel="Guardar alterações"
        cancelHref={`/clientes/${id}`}
        initial={{
          type: c.type,
          name: c.name,
          nif: c.nif,
          email: c.email ?? "",
          phone: c.phone ?? "",
          billingAddress: c.billingAddress ?? "",
          postalCode: c.postalCode ?? "",
          city: c.city ?? "",
          country: c.country,
          notes: c.notes ?? "",
          gdprConsent: c.gdprConsentAt !== null,
        }}
      />
    </div>
  );
}
