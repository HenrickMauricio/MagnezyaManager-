import type { Metadata } from "next";
import { Boxes, FileText, FolderTree, Package, Users } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { describeAction, getDashboardOverview } from "@/server/services/dashboard";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateLong, formatDateTime, formatInteger } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

const iconProps = { className: "size-[18px]", strokeWidth: 1.75 } as const;

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const data = await getDashboardOverview(user);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-[13px] font-medium text-fg-muted first-letter:uppercase">{formatDateLong(new Date())}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-tight">Olá, {firstName}</h1>
      </div>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Artigos ativos" value={formatInteger(data.articles)} icon={<Package {...iconProps} />} />
        <StatCard
          label="Unidades em stock"
          value={formatInteger(data.units)}
          hint="Stock total, antes de reservas"
          icon={<Boxes {...iconProps} />}
        />
        <StatCard label="Categorias" value={formatInteger(data.categories)} icon={<FolderTree {...iconProps} />} />
        <StatCard label="Clientes" value={formatInteger(data.clients)} icon={<Users {...iconProps} />} />
        <StatCard label="Orçamentos" value={formatInteger(data.quotes)} icon={<FileText {...iconProps} />} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Disponibilidade e alugueres"
            description="Alugados, em manutenção, próximos eventos e devoluções."
            action={<Badge>Fase 4</Badge>}
          />
          <p className="px-5 py-10 text-center text-[14px] text-fg-muted">
            Estes indicadores ficam ativos com o motor de disponibilidade e o calendário.
          </p>
        </Card>

        {data.recentActivity && (
          <Card>
            <CardHeader title="Atividade recente" description="Registo de auditoria" />
            {data.recentActivity.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-fg-muted">Ainda sem atividade registada.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{describeAction(log.action)}</div>
                      <div className="truncate text-[12px] text-fg-muted">{log.actor?.name ?? "Sistema"}</div>
                    </div>
                    <time className="tabular shrink-0 text-[12px] text-fg-subtle" dateTime={log.createdAt.toISOString()}>
                      {formatDateTime(log.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
