import type { Metadata } from "next";
import { requireClientPage } from "@/server/auth/session";
import { getPortalOverview } from "@/server/services/portal";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { formatInteger } from "@/lib/format";

export const metadata: Metadata = { title: "Portal do cliente" };

export default async function PortalHome() {
  const user = await requireClientPage();
  const { client, pending, total } = await getPortalOverview(user);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[13px] font-medium text-fg-muted">{client.name}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-tight">
          Bem-vindo, {user.name.split(" ")[0]}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Propostas a aguardar a sua resposta" value={formatInteger(pending)} />
        <StatCard label="Propostas recebidas" value={formatInteger(total)} />
      </div>

      <Card>
        <CardHeader title="Os seus dados" description="Informação associada à sua conta" />
        <dl className="grid gap-x-8 gap-y-4 px-5 py-5 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">Empresa</dt>
            <dd className="mt-0.5 font-medium">{client.name}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Email de contacto</dt>
            <dd className="mt-0.5 font-medium">{client.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Telefone</dt>
            <dd className="mt-0.5 font-medium">{client.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Localidade</dt>
            <dd className="mt-0.5 font-medium">{client.city ?? "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
