import type { Metadata } from "next";
import Link from "next/link";
import { Power, PowerOff } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { getUser } from "@/server/services/users";
import { listClientOptions } from "@/server/services/clients";
import { setUserActiveAction, updateUserAction } from "@/server/actions/users";
import { orNotFound } from "@/server/page-helpers";
import { PermissionsForm } from "@/components/features/users/permissions-form";
import { ResetPasswordButton } from "@/components/features/users/reset-password-button";
import { UserForm } from "@/components/features/users/user-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page";
import { ROLE_DEFAULT_PERMISSIONS, ROLE_LABELS, isPermission, type Permission, type RoleKey } from "@/lib/permissions";
import { overridablePermissions } from "@/lib/user-rules";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Utilizador" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePagePermission("user:manage");
  const [u, clients] = await Promise.all([orNotFound(getUser(actor, id)), listClientOptions(actor)]);
  const role = u.role.key as RoleKey;
  const isSelf = actor.id === u.id;

  // Um cliente arquivado continua na lista para não perder a associação.
  const linked = u.client;
  const clientOptions =
    linked && !clients.some((c) => c.id === linked.id)
      ? [...clients, { id: linked.id, name: `${linked.name} (arquivado)`, nif: "" }]
      : clients;

  const overrides: Partial<Record<Permission, "grant" | "revoke">> = {};
  for (const o of u.permissionOverrides) {
    if (isPermission(o.permission.key)) overrides[o.permission.key] = o.granted ? "grant" : "revoke";
  }
  const overridable = overridablePermissions(role);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        back={{ href: "/utilizadores", label: "Utilizadores" }}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            {ROLE_LABELS[role]}
            <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativo" : "Inativo"}</Badge>
            {u.mustChangePassword && <Badge tone="warning">Palavra-passe temporária</Badge>}
            {isSelf && <Badge>Você</Badge>}
          </span>
        }
        title={u.name}
        description={
          <>
            {u.email} · Último acesso: {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "nunca"}
            {linked && (
              <>
                {" · "}
                <Link href={`/clientes/${linked.id}`} className="underline underline-offset-2 hover:text-fg">
                  {linked.name}
                </Link>
              </>
            )}
          </>
        }
        actions={
          !isSelf && (
            <>
              <ResetPasswordButton userId={u.id} userName={u.name} />
              {u.active ? (
                <ConfirmButton
                  variant="secondary"
                  title="Desativar conta?"
                  description={`${u.name} deixa de conseguir iniciar sessão e as sessões abertas terminam de imediato. Pode reativar a conta a qualquer momento.`}
                  confirmLabel="Desativar"
                  action={setUserActiveAction.bind(null, u.id, false)}
                >
                  <PowerOff className="size-4" /> Desativar
                </ConfirmButton>
              ) : (
                <ConfirmButton
                  variant="secondary"
                  tone="primary"
                  title="Ativar conta?"
                  description={`${u.name} volta a conseguir iniciar sessão.`}
                  confirmLabel="Ativar"
                  action={setUserActiveAction.bind(null, u.id, true)}
                >
                  <Power className="size-4" /> Ativar
                </ConfirmButton>
              )}
            </>
          )
        }
      />

      <UserForm
        mode="edit"
        action={updateUserAction.bind(null, u.id)}
        clients={clientOptions}
        lockRole={isSelf}
        cancelHref="/utilizadores"
        initial={{
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          role,
          clientId: u.clientId ?? "",
          maxDiscount: String(u.maxDiscountBp / 100).replace(".", ","),
        }}
      />

      {overridable.length > 0 && (
        <Card>
          <CardHeader
            title="Permissões"
            description={
              isSelf
                ? "Não pode alterar as suas próprias permissões."
                : `Ajustes individuais em relação ao perfil ${ROLE_LABELS[role]}. Ao mudar de perfil, os ajustes são removidos.`
            }
          />
          <PermissionsForm
            key={JSON.stringify(overrides)}
            userId={u.id}
            permissions={overridable}
            roleDefaults={[...ROLE_DEFAULT_PERMISSIONS[role]]}
            initial={overrides}
            readOnly={isSelf}
          />
        </Card>
      )}
    </div>
  );
}
