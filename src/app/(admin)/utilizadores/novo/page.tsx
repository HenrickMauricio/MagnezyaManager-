import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { createUserAction } from "@/server/actions/users";
import { listClientOptions } from "@/server/services/clients";
import { UserForm } from "@/components/features/users/user-form";
import { PageHeader } from "@/components/ui/page";
import { ROLE_KEYS, type RoleKey } from "@/lib/permissions";

export const metadata: Metadata = { title: "Novo utilizador" };

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; cliente?: string }>;
}) {
  const actor = await requirePagePermission("user:manage");
  const { perfil, cliente } = await searchParams;
  const clients = await listClientOptions(actor);
  const role: RoleKey = ROLE_KEYS.includes(perfil as RoleKey) ? (perfil as RoleKey) : "VENDEDOR";
  const back = cliente
    ? { href: `/clientes/${cliente}`, label: "Ficha do cliente" }
    : { href: "/utilizadores", label: "Utilizadores" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Novo utilizador" back={back} />
      <UserForm
        mode="create"
        action={createUserAction}
        clients={clients}
        cancelHref={back.href}
        initial={{
          name: "",
          email: "",
          phone: "",
          role,
          clientId: clients.some((c) => c.id === cliente) ? cliente! : "",
          maxDiscount: role === "ADMIN" ? "100" : "0",
        }}
      />
    </div>
  );
}
