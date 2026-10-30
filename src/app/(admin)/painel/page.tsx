import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, FileText, Package, UserCog, Users } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { auditTargetHref, describeAction, getDashboardOverview } from "@/server/services/dashboard";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateLong, formatDateTime, formatInteger } from "@/lib/format";
import type { Permission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Painel" };

const iconProps = { className: "size-[18px]", strokeWidth: 1.75 } as const;

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const data = await getDashboardOverview(user);
  const firstName = user.name.split(" ")[0];
  const can = (permission: Permission) => user.permissions.has(permission);
  const canOpen = (href: string | null) =>
    href !== null &&
    ((href.startsWith("/clientes") && user.permissions.has("client:view")) ||
      (href.startsWith("/utilizadores") && user.permissions.has("user:manage")) ||
      (href.startsWith("/artigos") && user.permissions.has("article:view")) ||
      (href.startsWith("/categorias") && user.permissions.has("category:manage")));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-[13px] font-medium text-fg-muted first-letter:uppercase">{formatDateLong(new Date())}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-tight">Olá, {firstName}</h1>
      </div>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Clientes ativos"
          href={can("client:view") ? "/clientes" : undefined}
          value={formatInteger(data.clients)}
          hint={`${formatInteger(data.newClients)} novos nos últimos 30 dias`}
          icon={<Users {...iconProps} />}
        />
        {data.users ? (
          <StatCard
            label="Orçamentos"
            value={formatInteger(data.quotes)}
            hint="Módulo ativo na fase 5"
            icon={<FileText {...iconProps} />}
          />
        ) : (
          <StatCard
            label="Os meus orçamentos"
            value={formatInteger(data.myQuotes)}
            hint={`${formatInteger(data.quotes)} no total`}
            icon={<FileText {...iconProps} />}
          />
        )}
        <StatCard
          label="Artigos ativos"
          href={can("article:view") ? "/artigos" : undefined}
          value={formatInteger(data.articles)}
          icon={<Package {...iconProps} />}
        />
        <StatCard
          label="Unidades em stock"
          href={can("inventory:manage") ? "/inventario" : can("article:view") ? "/artigos" : undefined}
          value={formatInteger(data.units)}
          hint={
            data.maintenance.units > 0
              ? `${formatInteger(data.maintenance.units)} em manutenção (${formatInteger(data.maintenance.articles)} ${data.maintenance.articles === 1 ? "artigo" : "artigos"})`
              : "Nenhuma unidade em manutenção"
          }
          icon={<Boxes {...iconProps} />}
        />
        {data.users && (
          <StatCard
            label="Equipa ativa"
            href="/utilizadores"
            value={formatInteger(data.users.internal)}
            hint={
              `${formatInteger(data.users.portal)} contas no portal` +
              (data.users.pendingPassword ? ` · ${formatInteger(data.users.pendingPassword)} com palavra-passe temporária` : "")
            }
            icon={<UserCog {...iconProps} />}
          />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {data.recentClients && (
          <Card>
            <CardHeader
              title="Clientes recentes"
              description="Últimos clientes criados"
              action={
                <Link href="/clientes?ordem=recentes" className="text-[13px] font-medium text-fg-muted hover:text-fg">
                  Ver todos
                </Link>
              }
            />
            {data.recentClients.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-fg-muted">Ainda não há clientes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentClients.map((c) => (
                  <li key={c.id} className="relative flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                    <div className="min-w-0">
                      <Link href={`/clientes/${c.id}`} className="block truncate text-[14px] font-medium after:absolute after:inset-0">
                        {c.name}
                      </Link>
                      <div className="truncate text-[12px] text-fg-muted">
                        {[c.city, c.createdBy?.name && `criado por ${c.createdBy.name}`].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <time className="tabular shrink-0 text-[12px] text-fg-subtle" dateTime={c.createdAt.toISOString()}>
                      {formatDate(c.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {data.recentActivity && (
          <Card>
            <CardHeader title="Atividade recente" description="Registo de auditoria" />
            {data.recentActivity.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-fg-muted">Ainda sem atividade registada.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((log) => {
                  const href = auditTargetHref(log.entity, log.entityId);
                  const label = describeAction(log.action);
                  return (
                    <li key={log.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">
                          {canOpen(href) ? (
                            <Link href={href!} className="hover:underline">
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                        </div>
                        <div className="truncate text-[12px] text-fg-muted">{log.actor?.name ?? "Sistema"}</div>
                      </div>
                      <time className="tabular shrink-0 text-[12px] text-fg-subtle" dateTime={log.createdAt.toISOString()}>
                        {formatDateTime(log.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        <Card className={data.recentActivity ? "xl:col-span-2" : undefined}>
          <CardHeader
            title="Disponibilidade e alugueres"
            description="Alugados, em manutenção, próximos eventos e devoluções."
            action={<Badge>Fase 4</Badge>}
          />
          <p className="px-5 py-10 text-center text-[14px] text-fg-muted">
            Estes indicadores ficam ativos com o motor de disponibilidade e o calendário.
          </p>
        </Card>
      </div>
    </div>
  );
}
