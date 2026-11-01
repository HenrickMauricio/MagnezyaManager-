import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changeBp,
  monthlyRevenue,
  monthlyRevenueCsv,
  niceTicks,
  proposalOutcome,
  revenueByArticle,
  revenueByClient,
  sellerPerformance,
  summarize,
  type RevenueQuote,
} from "../../src/lib/reports";

let n = 0;
const quote = (over: Partial<RevenueQuote>): RevenueQuote => ({
  id: `q${++n}`,
  number: `ORC-${n}`,
  clientId: "c1",
  clientName: "Alfa",
  sellerId: "s1",
  sellerName: "Ana",
  eventStart: "2026-03-10",
  approvedOn: "2026-02-20",
  discountBp: 0,
  netCents: 100_000,
  taxCents: 23_000,
  totalCents: 123_000,
  servicesCents: 0,
  items: [],
  rentalCancelled: false,
  ...over,
});

test("faturação mensal: pelo mês do evento ou pelo mês da aprovação", () => {
  const quotes = [quote({}), quote({ eventStart: "2026-03-28", netCents: 50_000, taxCents: 11_500, totalCents: 61_500 })];
  const byEvent = monthlyRevenue(quotes, 2026, "evento", "2026-12-31");
  assert.equal(byEvent.length, 12);
  assert.equal(byEvent[2]!.count, 2);
  assert.equal(byEvent[2]!.netCents, 150_000);
  assert.equal(byEvent[2]!.taxCents, 34_500);
  assert.equal(byEvent[2]!.totalCents, 184_500);
  assert.equal(byEvent[1]!.netCents, 0);

  const byApproval = monthlyRevenue(quotes, 2026, "aprovacao", "2026-12-31");
  assert.equal(byApproval[1]!.netCents, 150_000);
  assert.equal(byApproval[2]!.netCents, 0);
});

test("faturação: outros anos e reservas canceladas depois da aprovação não contam", () => {
  const quotes = [
    quote({}),
    quote({ eventStart: "2025-03-10", approvedOn: "2025-02-01" }),
    quote({ rentalCancelled: true }),
    // Aprovada em dezembro, evento em janeiro: conta em anos diferentes conforme a base.
    quote({ approvedOn: "2025-12-15", eventStart: "2026-01-08" }),
  ];
  assert.equal(summarize(monthlyRevenue(quotes, 2026, "evento", "2026-12-31")).count, 2);
  assert.equal(summarize(monthlyRevenue(quotes, 2026, "aprovacao", "2026-12-31")).count, 1);
  assert.equal(summarize(monthlyRevenue(quotes, 2025, "aprovacao", "2026-12-31")).count, 2);
});

test("eventos realizados e futuros separados pela data de hoje", () => {
  const quotes = [quote({ eventStart: "2026-03-05" }), quote({ eventStart: "2026-03-20", netCents: 40_000 })];
  const [march] = monthlyRevenue(quotes, 2026, "evento", "2026-03-10").slice(2, 3);
  assert.equal(march!.pastNetCents, 100_000);
  assert.equal(march!.futureNetCents, 40_000);
  // O próprio dia do evento já conta como realizado.
  assert.equal(monthlyRevenue(quotes, 2026, "evento", "2026-03-20")[2]!.futureNetCents, 0);
});

test("resumo até um mês e variação face ao ano anterior", () => {
  const rows = monthlyRevenue([quote({ eventStart: "2026-01-10" }), quote({ eventStart: "2026-11-10" })], 2026, "evento", "2026-12-31");
  assert.equal(summarize(rows).netCents, 200_000);
  assert.equal(summarize(rows, 10).netCents, 100_000);
  assert.equal(changeBp(150, 100), 5000);
  assert.equal(changeBp(50, 100), -5000);
  assert.equal(changeBp(100, 0), null);
});

test("por cliente: ordenado pelo valor", () => {
  const rows = revenueByClient([
    quote({ clientId: "c1", clientName: "Alfa", netCents: 100 }),
    quote({ clientId: "c2", clientName: "Beta", netCents: 300 }),
    quote({ clientId: "c1", clientName: "Alfa", netCents: 150 }),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.name, r.count, r.netCents]),
    [
      ["Beta", 1, 300],
      ["Alfa", 2, 250],
    ],
  );
});

test("por artigo: desconto global repartido como no motor de preço; serviços à parte", () => {
  const { articles, servicesCents } = revenueByArticle([
    quote({
      discountBp: 1000,
      servicesCents: 9_500,
      items: [
        { articleId: "a1", name: "Cadeira", quantity: 100, lineTotalCents: 121_500 },
        { articleId: "a2", name: "Mesa", quantity: 10, lineTotalCents: 20_000 },
      ],
    }),
    quote({ items: [{ articleId: "a1", name: "Cadeira", quantity: 50, lineTotalCents: 60_000 }] }),
  ]);
  const chair = articles.find((a) => a.articleId === "a1")!;
  assert.equal(chair.quantity, 150);
  assert.equal(chair.quotes, 2);
  assert.equal(chair.netCents, 121_500 - 12_150 + 60_000);
  assert.equal(articles[0]!.articleId, "a1");
  assert.equal(servicesCents, 9_500);
});

test("desfecho das propostas e conversão por vendedor", () => {
  const today = "2026-06-01";
  const base = { sellerId: "s1", sellerName: "Ana", validUntil: "2026-12-31", netCents: 1000, rentalCancelled: false };
  assert.equal(proposalOutcome({ ...base, status: "ENVIADO", validUntil: "2026-05-31" }, today), "expirada");
  assert.equal(proposalOutcome({ ...base, status: "ENVIADO" }, today), "em_aberto");
  assert.equal(proposalOutcome({ ...base, status: "APROVADO", rentalCancelled: true }, today), "cancelada");
  assert.equal(proposalOutcome({ ...base, status: "RASCUNHO" }, today), "em_aberto");

  const [ana, rui] = sellerPerformance(
    [
      { ...base, status: "APROVADO" },
      { ...base, status: "APROVADO", netCents: 500 },
      { ...base, status: "REJEITADO" },
      { ...base, status: "EXPIRADO" },
      { ...base, status: "ENVIADO" },
      { ...base, sellerId: "s2", sellerName: "Rui", status: "ENVIADO" },
    ],
    today,
  );
  assert.equal(ana!.issued, 5);
  assert.equal(ana!.approved, 2);
  assert.equal(ana!.approvedNetCents, 1500);
  assert.equal(ana!.open, 1);
  // 2 aprovadas de 4 com desfecho (a em aberto não conta).
  assert.equal(ana!.conversionBp, 5000);
  assert.equal(rui!.conversionBp, null);
});

test("eixo: marcas redondas que cobrem o máximo", () => {
  assert.deepEqual(niceTicks(0), [0]);
  assert.deepEqual(niceTicks(95_000), [0, 50_000, 100_000]);
  assert.deepEqual(niceTicks(1_234_500), [0, 500_000, 1_000_000, 1_500_000]);
  for (const max of [1, 99, 12_345, 7_777_777]) {
    const t = niceTicks(max);
    assert.ok(t[t.length - 1]! >= max && t.length <= 6, `${max}: ${t}`);
  }
});

test("CSV: separador ';', vírgula decimal e linha de total", () => {
  const months = monthlyRevenue([quote({ netCents: 123_456, taxCents: 28_395, totalCents: 151_851 })], 2026, "evento", "2026-12-31");
  const previous = monthlyRevenue([], 2025, "evento", "2026-12-31");
  const lines = monthlyRevenueCsv(months, previous, 2026, "evento").split("\r\n");
  assert.equal(lines[0], "Mês;Propostas aprovadas;Sem IVA (€);IVA (€);Com IVA (€);2025 sem IVA (€)");
  assert.equal(lines[3], "março 2026;1;1234,56;283,95;1518,51;0,00");
  assert.equal(lines[13], "Total;1;1234,56;283,95;1518,51;0,00");
});
