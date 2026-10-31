// Tem de ser o primeiro import: aponta DATABASE_URL para a base de dados de teste.
import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/server/db";
import * as quotes from "../../src/server/services/quotes";
import * as rentals from "../../src/server/services/rentals";
import * as portal from "../../src/server/services/portal";
import { ConflictError, NotFoundError } from "../../src/server/errors";
import type { CurrentUser } from "../../src/server/auth/session";
import { addDaysISO, todayISO } from "../../src/lib/format";
import { defaultTaxRate, makeClientUser, makeUser, uniquePrefix } from "./fixtures";

const RUN = Date.now().toString(36);
let admin: CurrentUser;
let seller: CurrentUser;
let alfa: CurrentUser;
let beta: CurrentUser;
let alfaId: string;
let betaId: string;
let categoryId: string;
let taxRateId: string;

before(async () => {
  admin = await makeUser("ADMIN", "p-admin@teste.local", 10_000);
  seller = await makeUser("VENDEDOR", "p-vendedor@teste.local", 1000);
  taxRateId = (await defaultTaxRate()).id;
  categoryId = (await prisma.category.create({ data: { name: `PCat ${RUN}`, slug: `pcat-${RUN}`, skuPrefix: uniquePrefix() } })).id;
  alfaId = (await prisma.client.create({ data: { name: `Alfa ${RUN}`, nif: `6${RUN}a`.slice(0, 12) } })).id;
  betaId = (await prisma.client.create({ data: { name: `Beta ${RUN}`, nif: `6${RUN}b`.slice(0, 12) } })).id;
  alfa = await makeClientUser(`alfa-${RUN}@cliente.test`, alfaId);
  beta = await makeClientUser(`beta-${RUN}@cliente.test`, betaId);
});

after(async () => {
  await prisma.$disconnect();
});

let counter = 0;
async function article(stock: number) {
  counter++;
  return prisma.article.create({
    data: { sku: `P-${RUN}-${counter}`, name: `Artigo P ${counter}`, categoryId, priceCents: 500, taxRateId, stockBase: stock },
  });
}

async function quoteFor(clientId: string, articleId: string, quantity: number, { issue = true, validDays = 15 } = {}) {
  const day = addDaysISO(todayISO(), 600 + counter * 3);
  const q = await quotes.createQuote(seller, {
    clientId,
    eventName: "Evento portal",
    venue: null,
    city: null,
    deliveryDate: day,
    startDate: day,
    endDate: day,
    returnDate: day,
    validUntil: addDaysISO(todayISO(), validDays),
    discount: 0,
    notes: null,
    internalNotes: null,
    terms: "Condição",
    items: [{ articleId, quantity, discountBp: 0 }],
    services: [],
  });
  if (issue) await quotes.issueQuote(seller, q.id);
  return q;
}

test("rascunhos nunca emitidos não aparecem ao cliente", async () => {
  const a = await article(10);
  const draft = await quoteFor(alfaId, a.id, 1, { issue: false });
  assert.ok(!(await portal.listPortalQuotes(alfa)).some((q) => q.id === draft.id));
  await assert.rejects(portal.getPortalQuote(alfa, draft.id), NotFoundError);
});

test("isolamento: um cliente nunca vê nem responde a propostas de outro", async () => {
  const a = await article(10);
  const q = await quoteFor(alfaId, a.id, 2);
  assert.ok((await portal.listPortalQuotes(alfa)).some((x) => x.id === q.id));
  assert.ok(!(await portal.listPortalQuotes(beta)).some((x) => x.id === q.id));
  await assert.rejects(portal.getPortalQuote(beta, q.id), NotFoundError);
  await assert.rejects(portal.getPortalPdf(beta, q.id), NotFoundError);
  await assert.rejects(portal.respondToQuote(beta, q.id, { decision: "approve", version: 1, acceptTerms: true }), NotFoundError);
  await assert.rejects(portal.respondToQuote(beta, q.id, { decision: "reject", version: 1, reason: null }), NotFoundError);
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status, "ENVIADO");
});

test("cliente descarrega o PDF guardado da sua proposta", async () => {
  const a = await article(10);
  const q = await quoteFor(alfaId, a.id, 1);
  const { pdf, filename } = await portal.getPortalPdf(alfa, q.id);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(filename, `${q.number}-v1.pdf`);
});

test("aprovar exige aceitar as condições e a versão atual; cria a reserva com registo", async () => {
  const a = await article(10);
  const q = await quoteFor(alfaId, a.id, 4);
  await assert.rejects(portal.respondToQuote(alfa, q.id, { decision: "approve", version: 1, acceptTerms: false }), ConflictError);
  await assert.rejects(
    portal.respondToQuote(alfa, q.id, { decision: "approve", version: 2, acceptTerms: true }),
    (err: Error) => /atualizada para a versão 1/.test(err.message),
  );

  const result = await portal.respondToQuote(alfa, q.id, { decision: "approve", version: 1, acceptTerms: true });
  assert.equal(result.rental?.status, "RESERVADO");
  const saved = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
  assert.equal(saved.status, "APROVADO");
  assert.equal(saved.approvedVia, "PORTAL");
  assert.equal(saved.approvedVersion, 1);
  assert.equal(saved.approvedById, alfa.id);
  assert.equal((await prisma.rental.findUniqueOrThrow({ where: { quoteId: q.id } })).clientId, alfaId);

  // Já respondida: não volta a aceitar resposta.
  await assert.rejects(portal.respondToQuote(alfa, q.id, { decision: "reject", version: 1, reason: null }), ConflictError);
  assert.ok((await portal.listPortalRentals(alfa)).some((r) => r.quote?.id === q.id));
  assert.ok(!(await portal.listPortalRentals(beta)).some((r) => r.quote?.id === q.id));
});

test("recusar regista motivo, quem e por que via", async () => {
  const a = await article(10);
  const q = await quoteFor(betaId, a.id, 1);
  await portal.respondToQuote(beta, q.id, { decision: "reject", version: 1, reason: "Datas mudaram" });
  const saved = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
  assert.equal(saved.status, "REJEITADO");
  assert.equal(saved.rejectedVia, "PORTAL");
  assert.equal(saved.rejectedById, beta.id);
  assert.equal(saved.rejectedReason, "Datas mudaram");
});

test("proposta expirada ou em revisão não aceita resposta", async () => {
  const a = await article(10);
  const expired = await quoteFor(alfaId, a.id, 1);
  await prisma.quote.update({ where: { id: expired.id }, data: { validUntil: new Date(`${addDaysISO(todayISO(), -1)}T00:00:00Z`) } });
  await assert.rejects(
    portal.respondToQuote(alfa, expired.id, { decision: "approve", version: 1, acceptTerms: true }),
    (err: Error) => /expirou/.test(err.message),
  );

  const revised = await quoteFor(alfaId, a.id, 1);
  const current = await quotes.getQuote(seller, revised.id);
  await quotes.updateQuote(seller, revised.id, {
    clientId: alfaId,
    eventName: "Evento portal",
    venue: null,
    city: null,
    deliveryDate: current.deliveryDate.toISOString().slice(0, 10),
    startDate: current.startDate.toISOString().slice(0, 10),
    endDate: current.endDate.toISOString().slice(0, 10),
    returnDate: current.returnDate.toISOString().slice(0, 10),
    validUntil: current.validUntil.toISOString().slice(0, 10),
    discount: 0,
    notes: null,
    internalNotes: null,
    terms: null,
    items: [{ articleId: a.id, quantity: 2, discountBp: 0 }],
    services: [],
  });
  assert.equal((await portal.getPortalQuote(alfa, revised.id)).state, "EM_REVISAO");
  await assert.rejects(portal.respondToQuote(alfa, revised.id, { decision: "approve", version: 1, acceptTerms: true }), ConflictError);
});

test("D6: aprovação sem stock fica em conflito; a equipa confirma quando houver stock", async () => {
  const a = await article(5);
  const q = await quoteFor(alfaId, a.id, 3);
  const day = (await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).deliveryDate.toISOString().slice(0, 10);
  // Entretanto, a equipa reservou 4 das 5 unidades para outro evento.
  const other = await rentals.createRental(admin, {
    clientId: betaId,
    eventName: "Outro evento",
    venue: null,
    city: null,
    deliveryDate: day,
    startDate: day,
    endDate: day,
    returnDate: day,
    notes: null,
    lines: [{ articleId: a.id, quantity: 4 }],
  });

  const result = await portal.respondToQuote(alfa, q.id, { decision: "approve", version: 1, acceptTerms: true });
  assert.equal(result.rental?.status, "CONFLITO_STOCK");
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status, "APROVADO");

  await assert.rejects(rentals.confirmConflict(admin, result.rental!.id), (err: Error) => /Ainda não há stock/.test(err.message));
  await rentals.cancelRental(admin, other.id);
  await rentals.confirmConflict(admin, result.rental!.id);
  assert.equal((await prisma.rental.findUniqueOrThrow({ where: { id: result.rental!.id } })).status, "RESERVADO");
});

test("aprovações simultâneas da mesma proposta criam uma só reserva", async () => {
  const a = await article(20);
  const q = await quoteFor(alfaId, a.id, 2);
  const results = await Promise.allSettled([
    portal.respondToQuote(alfa, q.id, { decision: "approve", version: 1, acceptTerms: true }),
    portal.respondToQuote(alfa, q.id, { decision: "approve", version: 1, acceptTerms: true }),
    portal.respondToQuote(alfa, q.id, { decision: "reject", version: 1, reason: null }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await prisma.rental.count({ where: { quoteId: q.id } }), (await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status === "APROVADO" ? 1 : 0);
});

test("utilizador interno sem cliente associado não acede ao portal", async () => {
  await assert.rejects(portal.listPortalQuotes(seller));
});
