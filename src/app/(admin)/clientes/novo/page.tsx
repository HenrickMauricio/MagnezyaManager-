import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { createClientAction } from "@/server/actions/clients";
import { ClientForm } from "@/components/features/clients/client-form";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  await requirePagePermission("client:create");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Novo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <ClientForm action={createClientAction} submitLabel="Criar cliente" cancelHref="/clientes" />
    </div>
  );
}
