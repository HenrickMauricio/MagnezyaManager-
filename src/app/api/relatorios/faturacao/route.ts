import { getCurrentUser } from "@/server/auth/session";
import { getRevenueReport } from "@/server/services/reports";
import { todayISO } from "@/lib/format";
import { monthlyRevenueCsv } from "@/lib/reports";
import { reportParamsSchema } from "@/lib/validation/reports";

/** Faturação mensal em CSV (?ano=2026&base=evento|aprovacao). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sessão necessária.", { status: 401 });
  if (!user.permissions.has("report:view")) return new Response("Sem permissão.", { status: 403 });

  const url = new URL(request.url);
  const { ano: year, base: basis } = reportParamsSchema(Number(todayISO().slice(0, 4))).parse(Object.fromEntries(url.searchParams));
  const report = await getRevenueReport(user, { year, basis });
  // BOM: o Excel só reconhece os acentos em UTF-8 com ele.
  const csv = "\uFEFF" + monthlyRevenueCsv(report.months, report.previousMonths, year, basis);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faturacao-${year}-${basis}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
