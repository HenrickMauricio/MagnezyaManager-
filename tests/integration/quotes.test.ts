// Tem de ser o primeiro import: aponta DATABASE_URL para a base de dados de teste.
import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prisma } from "../../src/server/db";
import * as quotes from "../../src/server/services/quotes";
import { ConflictError, ForbiddenError } from "../../src/server/errors";
import type { CurrentUser } from "../../src/server/auth/session";
import { ROLE_DEFAULT_PERMISSIONS, type Permission, type RoleKey } from "../../src/lib/permissions";
import type { QuoteInput } from "../../src/lib/validation/quotes";
import type { QuoteSnapshot } from "../../src/lib/quote-snapshot";
import { addDaysISO, todayISO } from "../../src/lib/format";

const RUN = Date.now().toString(36);
const uniquePrefix = () => Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
let admin: CurrentUser;
let sellerA: CurrentUser;
let sellerB: CurrentUser;
let clientId: string;
let categoryId: string;
let taxRateId: string;

async function makeUser(role: RoleKey, email: string, maxDiscountBp: number): Promise<CurrentUser> {
  const r = await prisma.role.upsert({ where: { key: role }, update: {}, create: { key: role, name: role } });
  const u = await prisma.user.upsert({
    where: { email },
    update: { maxDiscountBp },
    create: { email, name: email.split("@")[0]!, roleId: r.id, maxDiscountBp },
  });
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    roleName: role,
    clientId: null,
    maxDiscountBp,
    mustChangePassword: false,
    permissions: new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]),
  };
}

before(async () => {
  admin = await makeUser("ADMIN", "q-admin@teste.local", 10_000);
  sellerA = await makeUser("VENDEDOR", "q-vendedor-a@teste.local", 1000);
  sellerB = await makeUser("VENDEDOR", "q-vendedor-b@teste.local", 1000);
  const tax = await prisma.taxRate.upsert({
    where: { name_region: { name: "Taxa normal", region: "CONTINENTE" } },
    update: {},
    create: { name: "Taxa normal", rateBp: 2300, region: "CONTINENTE", isDefault: true },
  });
  taxRateId = tax.id;
  categoryId = (await prisma.category.create({ data: { name: `QCat ${RUN}`, slug: `qcat-${RUN}`, skuPrefix: uniquePrefix() } })).id;
  clientId = (await prisma.client.create({ data: { name: `Cliente Q ${RUN}`, nif: `8${RUN}`.slice(0, 12) } })).id;
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: { legalName: "Empresa Teste, Lda.", tradeName: "Empresa Teste" },
    create: { id: "default", legalName: "Empresa Teste, Lda.", tradeName: "Empresa Teste" },
  });
});

after(async () => {
  await prisma.$disconnect();
});

let counter = 0;
async function article(stock: number, priceCents: number) {
  counter++;
  return prisma.article.create({
    data: { sku: `Q-${RUN}-${counter}`, name: `Artigo Q ${counter}`, categoryId, priceCents, taxRateId, stockBase: stock },
  });
}

/** Evento daqui a ~1 ano, 3 dias (de 10 a 12). */
function input(lines: { articleId: string; quantity: number; discountBp?: number }[], over: Partial<QuoteInput> = {}): QuoteInput {
  const base = addDaysISO(todayISO(), 365 + counter * 7);
  return {
    clientId,
    eventName: "Evento Q",
    venue: null,
    city: null,
    deliveryDate: base,
    startDate: base,
    endDate: addDaysISO(base, 2),
    returnDate: addDaysISO(base, 2),
    validUntil: addDaysISO(todayISO(), 15),
    discount: 0,
    notes: null,
    internalNotes: null,
    terms: "Condição de teste",
    items: lines.map((l) => ({ articleId: l.articleId, quantity: l.quantity, discountBp: l.discountBp ?? 0 })),
    services: [{ serviceId: null, description: "Transporte", quantity: 1, price: 9500 }],
    ...over,
  };
}

test("totais calculados no servidor a partir do preço do catálogo", async () => {
  const chairs = await article(100, 450);
  const q = await quotes.createQuote(sellerA, input([{ articleId: chairs.id, quantity: 100, discountBp: 500 }]));
  // 100 × 4,50 € × 3 dias = 1350 €; −5 % = 1282,50 €; + transporte 95 € = 1377,50 €; IVA 23 % = 316,83 €.
  assert.equal(q.subtotalCents, 128_250);
  assert.equal(q.servicesCents, 9_500);
  assert.equal(q.taxCents, 31_683);
  assert.equal(q.totalCents, 169_433);
  assert.match(q.number, /^ORC-\d{4}-\d{4}$/);
});

test("emitir cria versão imutável com PDF e hash; versões antigas não mudam", async () => {
  const table = await article(20, 1500);
  const q = await quotes.createQuote(sellerA, input([{ articleId: table.id, quantity: 4 }]));
  assert.deepEqual(await quotes.issueQuote(sellerA, q.id), { status: "ENVIADO", version: 1 });

  const v1 = await quotes.getVersionPdf(sellerA, q.id, 1);
  assert.equal(v1.pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(v1.filename, `${q.number}-v1.pdf`);

  // Mudanças posteriores: preço do catálogo e nome da empresa.
  await prisma.article.update({ where: { id: table.id }, data: { priceCents: 9999 } });
  await prisma.companySettings.update({ where: { id: "default" }, data: { tradeName: "Empresa Renomeada" } });
  const saved = await quotes.getQuote(sellerA, q.id);
  await quotes.updateQuote(sellerA, q.id, { ...input([{ articleId: table.id, quantity: 5 }]), lockVersion: saved.lockVersion });
  assert.deepEqual(await quotes.issueQuote(sellerA, q.id), { status: "ENVIADO", version: 2 });

  const versions = await prisma.quoteVersion.findMany({ where: { quoteId: q.id }, orderBy: { versionNumber: "asc" } });
  const [s1, s2] = versions.map((v) => v.snapshot as unknown as QuoteSnapshot);
  assert.equal(s1!.items[0]!.quantity, 4);
  assert.equal(s1!.company.tradeName, "Empresa Teste");
  assert.equal(s2!.items[0]!.quantity, 5);
  assert.equal(s2!.company.tradeName, "Empresa Renomeada");
  // O artigo já estava no orçamento: mantém o preço com que foi adicionado.
  assert.equal(s2!.items[0]!.unitPriceCents, 1500);
  // O PDF da v1 continua igual ao original (hash guardado na emissão).
  const again = await quotes.getVersionPdf(sellerA, q.id, 1);
  assert.equal(createHash("sha256").update(again.pdf).digest("hex"), versions[0]!.pdfSha256);
  await prisma.companySettings.update({ where: { id: "default" }, data: { tradeName: "Empresa Teste" } });
});

test("D4: desconto acima do limite do vendedor fica a aguardar aprovação", async () => {
  const sofa = await article(10, 6000);
  const q = await quotes.createQuote(sellerA, input([{ articleId: sofa.id, quantity: 2, discountBp: 1500 }]));
  const result = await quotes.issueQuote(sellerA, q.id);
  assert.equal(result.status, "AGUARDANDO_APROVACAO");
  await assert.rejects(quotes.approveDiscountAndIssue(sellerA, q.id), ForbiddenError);
  assert.deepEqual(await quotes.approveDiscountAndIssue(admin, q.id), { status: "ENVIADO", version: 1 });
});

test("D5: vendedor não edita orçamentos de outro vendedor; administrador edita", async () => {
  const lamp = await article(10, 1200);
  const q = await quotes.createQuote(sellerA, input([{ articleId: lamp.id, quantity: 1 }]));
  await assert.rejects(quotes.updateQuote(sellerB, q.id, input([{ articleId: lamp.id, quantity: 2 }])), ForbiddenError);
  await quotes.updateQuote(admin, q.id, input([{ articleId: lamp.id, quantity: 2 }]));
});

test("bloqueio otimista: gravar sobre uma versão desatualizada é recusado", async () => {
  const x = await article(10, 1000);
  const q = await quotes.createQuote(sellerA, input([{ articleId: x.id, quantity: 1 }]));
  await quotes.updateQuote(sellerA, q.id, { ...input([{ articleId: x.id, quantity: 2 }]), lockVersion: 0 });
  await assert.rejects(
    quotes.updateQuote(sellerA, q.id, { ...input([{ articleId: x.id, quantity: 3 }]), lockVersion: 0 }),
    (err: Error) => err instanceof ConflictError && /alterado por outra pessoa/.test(err.message),
  );
});

test("aprovar cria a reserva; sem stock a aprovação é recusada com mensagem clara", async () => {
  const bar = await article(5, 8000);
  const dates = input([{ articleId: bar.id, quantity: 4 }]);
  const first = await quotes.createQuote(sellerA, dates);
  const second = await quotes.createQuote(sellerA, { ...dates, items: [{ articleId: bar.id, quantity: 3, discountBp: 0 }] });
  await quotes.issueQuote(sellerA, first.id);
  await quotes.issueQuote(sellerA, second.id);

  const rental = await quotes.approveQuote(sellerA, first.id);
  assert.equal(rental.quoteId, first.id);
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: first.id } })).status, "APROVADO");

  // Só sobra 1 unidade: o segundo orçamento (3) não pode ser aprovado.
  await assert.rejects(
    quotes.approveQuote(sellerA, second.id),
    (err: Error) => err instanceof ConflictError && /Faltam 2 un de "Artigo Q \d+"/.test(err.message),
  );
  assert.equal((await prisma.quote.findUniqueOrThrow({ where: { id: second.id } })).status, "ENVIADO");
});

test("aprovações simultâneas do mesmo orçamento criam uma só reserva", async () => {
  const x = await article(50, 500);
  const q = await quotes.createQuote(sellerA, input([{ articleId: x.id, quantity: 10 }]));
  await quotes.issueQuote(sellerA, q.id);
  const results = await Promise.allSettled([quotes.approveQuote(sellerA, q.id), quotes.approveQuote(admin, q.id)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await prisma.rental.count({ where: { quoteId: q.id } }), 1);
});

test("validade expirada impede a emissão", async () => {
  const x = await article(10, 500);
  const q = await quotes.createQuote(sellerA, input([{ articleId: x.id, quantity: 1 }], { validUntil: addDaysISO(todayISO(), -1) }));
  await assert.rejects(quotes.issueQuote(sellerA, q.id), (err: Error) => /validade/.test(err.message));
});

test("duplicar cria um rascunho novo com os preços atuais", async () => {
  const x = await article(10, 700);
  const q = await quotes.createQuote(sellerA, input([{ articleId: x.id, quantity: 2 }]));
  await prisma.article.update({ where: { id: x.id }, data: { priceCents: 800 } });
  const copy = await quotes.duplicateQuote(sellerB, q.id);
  assert.notEqual(copy.number, q.number);
  assert.equal(copy.createdById, sellerB.id);
  const item = await prisma.quoteItem.findFirstOrThrow({ where: { quoteId: copy.id } });
  assert.equal(item.unitPriceCents, 800);
});
