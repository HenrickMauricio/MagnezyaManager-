import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { requireClientPage } from "@/server/auth/session";
import { listPortalQuotes } from "@/server/services/portal";
import { PortalStateBadge } from "@/components/features/portal/portal-state";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { dateOnlyToISO, formatCents, formatISODate } from "@/lib/format";

export const metadata: Metadata = { title: "Propostas" };

export default async function PortalProposalsPage() {
  const user = await requireClientPage();
  const quotes = await listPortalQuotes(user);

  return (
    <div className="space-y-6">
      <PageHeader title="Propostas" description="Todas as propostas que lhe enviámos." />
      <Card className="overflow-hidden">
        {quotes.length === 0 ? (
          <EmptyState icon={<FileText className="size-8" strokeWidth={1.5} />} title="Ainda não tem propostas" />
        ) : (
          <ul className="divide-y divide-border">
            {quotes.map((q) => {
              const v = q.versions[0];
              return (
                <li key={q.id} className="relative flex items-center gap-3 px-5 py-4 hover:bg-surface-2/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/portal/propostas/${q.id}`} className="font-medium after:absolute after:inset-0">
                        {q.number}
                      </Link>
                      <PortalStateBadge state={q.state} />
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-fg-muted">
                      {q.event.name} · {formatISODate(dateOnlyToISO(q.startDate))}
                      {q.state === "PENDENTE" && ` · válida até ${formatISODate(dateOnlyToISO(q.validUntil))}`}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-right font-medium">{v ? formatCents(v.totalCents) : "—"}</div>
                  <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
