// Tem de ser o primeiro import: aponta DATABASE_URL para a base de dados de teste.
import "./setup";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/server/db";
import * as rentals from "../../src/server/services/rentals";
import * as inventory from "../../src/server/services/inventory";
import { getArticleAvailability } from "../../src/server/services/availability";
import { ConflictError } from "../../src/server/errors";
import type { CurrentUser } from "../../src/server/auth/session";
import { ALL_PERMISSIONS, type Permission } from "../../src/lib/permissions";

const RUN = Date.now().toString(36);
/** Prefixo de SKU único (6 letras aleatórias). */
const uniquePrefix = () => Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
let user: CurrentUser;
let clientId: string;
let categoryId: string;
let taxRateId: string;

before(async () => {
  const role = await prisma.role.upsert({
    where: { key: "ADMIN" },
    update: {},
    create: { key: "ADMIN", name: "Administrador" },
  });
  const dbUser = await prisma.user.upsert({
    where: { email: "integracao@teste.local" },
    update: {},
    create: { email: "integracao@teste.local", name: "Teste Integração", roleId: role.id },
  });
  user = {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: "ADMIN",
    roleName: "Administrador",
    clientId: null,
    maxDiscountBp: 10000,
    mustChangePassword: false,
    permissions: new Set<Permission>(ALL_PERMISSIONS.filter((p) => !p.startsWith("portal:"))),
  };
  const tax = await prisma.taxRate.upsert({
    where: { name_region: { name: "Taxa normal", region: "CONTINENTE" } },
    update: {},
    create: { name: "Taxa normal", rateBp: 2300, region: "CONTINENTE", isDefault: true },
  });
  taxRateId = tax.id;
  const category = await prisma.category.create({
    data: { name: `Cat ${RUN}`, slug: `cat-${RUN}`, skuPrefix: uniquePrefix(), prepBufferDays: 0 },
  });
  categoryId = category.id;
  const client = await prisma.client.create({ data: { name: `Cliente ${RUN}`, nif: `9${RUN}`.slice(0, 12) } });
  clientId = client.id;
});

after(async () => {
  await prisma.$disconnect();
});

let counter = 0;
async function article(stock: number, buffer = 0) {
  counter++;
  const category =
    buffer === 0
      ? categoryId
      : (
          await prisma.category.create({
            data: { name: `Cat ${RUN}-${counter}`, slug: `cat-${RUN}-${counter}`, skuPrefix: uniquePrefix(), prepBufferDays: buffer },
          })
        ).id;
  return prisma.article.create({
    data: { sku: `T-${RUN}-${counter}`, name: `Artigo ${counter}`, categoryId: category, priceCents: 100, taxRateId, stockBase: stock },
  });
}

function rentalInput(articleId: string, quantity: number, deliveryDate: string, returnDate: string) {
  return {
    clientId,
    eventName: "Evento de teste",
    venue: null,
    city: null,
    deliveryDate,
    startDate: deliveryDate,
    endDate: returnDate,
    returnDate,
    notes: null,
    lines: [{ articleId, quantity }],
  };
}

test("enunciado com base de dados: 100 cadeiras, reservas de 30 e 40", async () => {
  const chairs = await article(100);
  await rentals.createRental(user, rentalInput(chairs.id, 30, "2027-11-10", "2027-11-15"));
  await rentals.createRental(user, rentalInput(chairs.id, 40, "2027-11-12", "2027-11-18"));
  const view = (await getArticleAvailability(user, chairs.id, "2027-11-09", "2027-11-19"))!;
  const day = (d: string) => view.days.find((x) => x.date === d)!.available;
  assert.equal(day("2027-11-13"), 30);
  assert.equal(day("2027-11-16"), 60);
  // A 13/11 só há 30: pedir 31 é recusado com mensagem clara.
  await assert.rejects(
    rentals.createRental(user, rentalInput(chairs.id, 31, "2027-11-13", "2027-11-13")),
    (err: Error) => err instanceof ConflictError && /Faltam 1 un .* a 13\/11\/2027/.test(err.message),
  );
});

test("concorrência: 12 reservas em paralelo nunca ultrapassam o stock", async () => {
  const sofas = await article(10);
  const attempts = await Promise.allSettled(
    Array.from({ length: 12 }, () => rentals.createRental(user, rentalInput(sofas.id, 3, "2027-12-01", "2027-12-03"))),
  );
  const ok = attempts.filter((a) => a.status === "fulfilled").length;
  const refused = attempts.filter((a) => a.status === "rejected");
  assert.equal(ok, 3, "só cabem 3 reservas de 3 unidades em 10");
  assert.ok(refused.every((r) => r.status === "rejected" && r.reason instanceof ConflictError));

  const reserved = await prisma.rentalItem.aggregate({ where: { articleId: sofas.id }, _sum: { quantity: true } });
  assert.equal(reserved._sum.quantity, 9);
});

test("concorrência entre artigos diferentes por ordem inversa não bloqueia (sem deadlock)", async () => {
  const a = await article(5);
  const b = await article(5);
  const both = (first: string, second: string) => ({
    ...rentalInput(first, 1, "2027-12-10", "2027-12-11"),
    lines: [
      { articleId: first, quantity: 1 },
      { articleId: second, quantity: 1 },
    ],
  });
  const results = await Promise.allSettled([
    ...Array.from({ length: 4 }, () => rentals.createRental(user, both(a.id, b.id))),
    ...Array.from({ length: 4 }, () => rentals.createRental(user, both(b.id, a.id))),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
});

test("dias de preparação da categoria contam na verificação", async () => {
  const bar = await article(1, 2);
  await rentals.createRental(user, rentalInput(bar.id, 1, "2028-01-10", "2028-01-12"));
  // Ocupado até 14/01 (recolha 12 + 2 dias de preparação).
  await assert.rejects(rentals.createRental(user, rentalInput(bar.id, 1, "2028-01-14", "2028-01-15")), ConflictError);
  await rentals.createRental(user, rentalInput(bar.id, 1, "2028-01-15", "2028-01-16"));
});

test("cancelar liberta o stock", async () => {
  const x = await article(2);
  const r = await rentals.createRental(user, rentalInput(x.id, 2, "2028-02-01", "2028-02-02"));
  await assert.rejects(rentals.createRental(user, rentalInput(x.id, 1, "2028-02-01", "2028-02-01")), ConflictError);
  await rentals.cancelRental(user, r.id);
  await rentals.createRental(user, rentalInput(x.id, 2, "2028-02-01", "2028-02-02"));
});

test("devolução parcial com danos: estado, manutenção e stock libertado", async () => {
  const tables = await article(10);
  const r = await rentals.createRental(user, rentalInput(tables.id, 10, "2026-01-05", "2026-01-08"));
  await rentals.markDelivered(user, r.id, "2026-01-05");
  const item = await prisma.rentalItem.findFirstOrThrow({ where: { rentalId: r.id } });

  await rentals.registerReturn(user, r.id, {
    date: "2026-01-08",
    notes: null,
    lines: [{ rentalItemId: item.id, returned: 6, damaged: 1 }],
  });
  let saved = await prisma.rental.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(saved.status, "EM_DEVOLUCAO");
  const maintenance = await prisma.maintenance.findFirstOrThrow({ where: { rentalId: r.id } });
  assert.equal(maintenance.quantity, 1);

  await assert.rejects(
    rentals.registerReturn(user, r.id, { date: "2026-01-09", notes: null, lines: [{ rentalItemId: item.id, returned: 5, damaged: 0 }] }),
    ConflictError,
  );
  await rentals.registerReturn(user, r.id, {
    date: "2026-01-09",
    notes: null,
    lines: [{ rentalItemId: item.id, returned: 4, damaged: 0 }],
  });
  saved = await prisma.rental.findUniqueOrThrow({ where: { id: r.id } });
  assert.equal(saved.status, "DEVOLVIDO");

  const view = (await getArticleAvailability(user, tables.id, "2026-01-10", "2026-01-10"))!;
  assert.equal(view.days[0]!.available, 9, "10 − 1 em manutenção");
});

test("inventário: abate que invade unidades reservadas é recusado", async () => {
  const lamps = await article(10);
  await rentals.createRental(user, rentalInput(lamps.id, 8, "2028-03-01", "2028-03-05"));
  await assert.rejects(
    inventory.createMovement(user, lamps.id, { type: "ABATE", quantity: 3, effectiveDate: "2028-02-20", reason: "teste" }),
    (err: Error) => err instanceof ConflictError && /ocupadas/.test(err.message),
  );
  await inventory.createMovement(user, lamps.id, { type: "ABATE", quantity: 2, effectiveDate: "2028-02-20", reason: "teste" });
});

test("numeração sequencial sem repetições", async () => {
  const x = await article(50);
  const created = await Promise.all(
    Array.from({ length: 5 }, () => rentals.createRental(user, rentalInput(x.id, 1, "2029-05-01", "2029-05-01"))),
  );
  const numbers = created.map((r) => r.number);
  assert.equal(new Set(numbers).size, 5);
  assert.ok(numbers.every((n) => /^RES-2029-\d{4}$/.test(n)));
});
