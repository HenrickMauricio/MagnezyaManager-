// Tem de ser o primeiro import: aponta DATABASE_URL para a base de dados de teste.
import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/server/db";
import * as quotes from "../../src/server/services/quotes";
import * as rentals from "../../src/server/services/rentals";
import * as reports from "../../src/server/services/reports";
import { ForbiddenError } from "../../src/server/errors";
import type { CurrentUser } from "../../src/server/auth/session";
import { addDaysISO, todayISO } from "../../src/lib/format";
import { defaultTaxRate, makeUser, uniquePrefix } from "./fixtures";

// Os ficheiros de integração correm em paralelo: este é o único que usa eventos
// em 2031, e as verificações comparam antes/depois em vez de totais absolutos.
const YEAR = 2031;
const RUN = Date.now().toString(36);
let admin: CurrentUser;
let seller: CurrentUser;
let clientId: string;
let articleId: string;
const created: string[] = [];

before(async () => {
  admin = await makeUser("ADMIN", "r-admin@teste.local", 10_000);
  // Vendedor novo em cada execução: a sua linha no relatório é só deste teste.
  seller = await makeUser("VENDEDOR", `r-vendedor-${RUN}@teste.local`, 1000);
  const taxRateId = (await defaultTaxRate()).id;
  const categoryId = (await prisma.category.create({ data: { name: `RCat ${RUN}`, slug: `rcat-${RUN}`, skuPrefix: uniquePrefix() } })).id;
  clientId = (await prisma.client.create({ data: { name: `Relatório ${RUN}`, nif: `7${RUN}`.slice(0, 12) } })).id;
  articleId = (await prisma.article.create({ data: { sku: `R-${RUN}`, name: `Artigo R ${RUN}`, categoryId, priceCents: 1250, taxRateId, stockBase: 100 } })).id;
});

after(async () => {
  // Limpa só o que este teste criou, para o ano de teste ficar sempre vazio.
  await prisma.rental.deleteMany({ where: { quoteId: { in: created } } });
  const events = await prisma.quote.findMany({ where: { id: { in: created } }, select: { eventId: true } });
  await prisma.quote.deleteMany({ where: { id: { in: created } } });
  await prisma.event.deleteMany({ where: { id: { in: events.map((e) => e.eventId) } } });
  await prisma.$disconnect();
});

async function issued(day: string, quantity: number) {
  const q = await quotes.createQuote(seller, {
    clientId,
    eventName: "Evento relatório",
    venue: null,
    city: null,
    deliveryDate: day,
    startDate: day,
    endDate: day,
    returnDate: day,
    validUntil: addDaysISO(todayISO(), 15),
    discount: 0,
    notes: null,
    internalNotes: null,
    terms: null,
    items: [{ articleId, quantity, discountBp: 0 }],
    services: [],
  });
  created.push(q.id);
  await quotes.issueQuote(seller, q.id);
  return prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
}

const revenue = () => reports.getRevenueReport(admin, { year: YEAR, basis: "evento" });

test("relatórios exigem a permissão report:view (vendedores não a têm por omissão)", async () => {
  await assert.rejects(reports.getRevenueReport(seller, { year: YEAR, basis: "evento" }), ForbiddenError);
  await assert.rejects(reports.getSalesReport(seller, YEAR), ForbiddenError);
});

test("proposta aprovada entra na faturação do mês do evento; sai se a reserva for cancelada", async () => {
  const before = await revenue();
  const q = await issued(`${YEAR}-05-14`, 8);
  const net = q.totalCents - q.taxCents;
  assert.ok(net > 0);

  // Emitida mas não aprovada: ainda não é faturação.
  assert.equal((await revenue()).summary.count, before.summary.count);

  const rental = await quotes.approveQuote(admin, q.id);
  const afterApproval = await revenue();
  assert.equal(afterApproval.summary.count, before.summary.count + 1);
  assert.equal(afterApproval.summary.netCents, before.summary.netCents + net);
  assert.equal(afterApproval.summary.taxCents, before.summary.taxCents + q.taxCents);
  assert.equal(afterApproval.months[4]!.netCents, before.months[4]!.netCents + net);
  // Evento em 2031: ainda por realizar.
  assert.equal(afterApproval.summary.futureNetCents, before.summary.futureNetCents + net);
  assert.equal(afterApproval.clients.find((c) => c.clientId === clientId)?.netCents, net);
  assert.equal(afterApproval.articles.find((a) => a.articleId === articleId)?.quantity, 8);

  // Pela data de aprovação, conta no ano atual e não em 2031.
  const byApproval = await reports.getRevenueReport(admin, { year: YEAR, basis: "aprovacao" });
  assert.ok(!byApproval.clients.some((c) => c.clientId === clientId));

  await rentals.cancelRental(admin, rental.id);
  const afterCancel = await revenue();
  assert.equal(afterCancel.summary.netCents, before.summary.netCents);
  assert.equal(afterCancel.cancelled.count, before.cancelled.count + 1);
  assert.equal(afterCancel.cancelled.netCents, before.cancelled.netCents + net);
});

test("desempenho por vendedor: emitidas no ano, desfecho e conversão", async () => {
  const approved = await issued(`${YEAR}-06-10`, 2);
  await issued(`${YEAR}-06-11`, 3); // fica em aberto
  const rejected = await issued(`${YEAR}-06-12`, 1);
  await quotes.approveQuote(admin, approved.id);
  await quotes.rejectQuote(seller, rejected.id, "Orçamento alto");

  // As propostas contam no ano em que foram emitidas pela primeira vez (hoje).
  const { sellers } = await reports.getSalesReport(admin, Number(todayISO().slice(0, 4)));
  const row = sellers.find((s) => s.sellerId === seller.id);
  assert.ok(row);
  assert.equal(row.issued, 4); // inclui a do teste anterior
  assert.equal(row.approved, 1); // a do teste anterior foi cancelada depois
  assert.equal(row.rejected, 1);
  assert.equal(row.lost, 1);
  assert.equal(row.open, 1);
  assert.equal(row.approvedNetCents, approved.totalCents - approved.taxCents);
  // 1 aprovada de 3 com desfecho.
  assert.equal(row.conversionBp, 3333);
});
