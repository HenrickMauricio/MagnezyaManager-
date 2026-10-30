import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categorySchema,
  completeMaintenanceSchema,
  createArticleSchema,
  maintenanceSchema,
  movementSchema,
  updateArticleSchema,
} from "../../src/lib/validation/catalog";

const article = {
  name: "Cadeira Chiavari",
  sku: "",
  categoryId: "cat1",
  description: "",
  unit: "un",
  priceCents: "4,50",
  priceUnit: "POR_DIA",
  taxRateId: "tax1",
  status: "ATIVO",
  internalNotes: "",
  stockBase: "200",
};

test("artigo: preço em euros convertido para cêntimos; SKU vazio → automático", () => {
  const r = createArticleSchema.parse(article);
  assert.equal(r.priceCents, 450);
  assert.equal(r.sku, null);
  assert.equal(r.stockBase, 200);
});

test("artigo: preço obrigatório e válido", () => {
  assert.ok(!createArticleSchema.safeParse({ ...article, priceCents: "" }).success);
  assert.ok(!createArticleSchema.safeParse({ ...article, priceCents: "abc" }).success);
  assert.equal(createArticleSchema.parse({ ...article, priceCents: "1.234,5" }).priceCents, 123450);
});

test("artigo: SKU em maiúsculas e com caracteres seguros", () => {
  assert.equal(createArticleSchema.parse({ ...article, sku: "cad-chia-do" }).sku, "CAD-CHIA-DO");
  assert.ok(!createArticleSchema.safeParse({ ...article, sku: "CAD 01/2" }).success);
});

test("artigo: stock inicial inteiro não negativo", () => {
  assert.ok(!createArticleSchema.safeParse({ ...article, stockBase: "-1" }).success);
  assert.ok(!createArticleSchema.safeParse({ ...article, stockBase: "2,5" }).success);
});

test("edição de artigo ignora o stock (só muda por movimentos)", () => {
  const r = updateArticleSchema.parse({ ...article, stockBase: "999" });
  assert.ok(!("stockBase" in r));
});

test("categoria: prefixo de 2 a 6 letras, em maiúsculas", () => {
  const ok = categorySchema.parse({ name: "Cadeiras", skuPrefix: "cad", description: "", prepBufferDays: "1" });
  assert.equal(ok.skuPrefix, "CAD");
  assert.equal(ok.prepBufferDays, 1);
  assert.ok(!categorySchema.safeParse({ name: "X", skuPrefix: "C4D", description: "", prepBufferDays: "0" }).success);
  assert.ok(!categorySchema.safeParse({ name: "X", skuPrefix: "CAD", description: "", prepBufferDays: "31" }).success);
});

const movement = { type: "ENTRADA", quantity: "10", effectiveDate: "2026-11-05", reason: "Compra" };

test("movimento: quantidade diferente de zero; negativa só em ajustes", () => {
  assert.ok(movementSchema.safeParse(movement).success);
  assert.ok(!movementSchema.safeParse({ ...movement, quantity: "0" }).success);
  assert.ok(!movementSchema.safeParse({ ...movement, quantity: "-3" }).success);
  assert.ok(!movementSchema.safeParse({ ...movement, type: "ABATE", quantity: "-3" }).success);
  assert.ok(movementSchema.safeParse({ ...movement, type: "AJUSTE", quantity: "-3" }).success);
});

test("movimento: data e motivo obrigatórios", () => {
  assert.ok(!movementSchema.safeParse({ ...movement, effectiveDate: "05/11/2026" }).success);
  assert.ok(!movementSchema.safeParse({ ...movement, effectiveDate: "2026-02-30" }).success);
  assert.ok(movementSchema.safeParse({ ...movement, effectiveDate: "2028-02-29" }).success);
  assert.ok(!movementSchema.safeParse({ ...movement, reason: "  " }).success);
});

test("manutenção: fim previsto não anterior ao início; custo opcional", () => {
  const base = { quantity: "2", startDate: "2026-11-05", expectedEndDate: "", reason: "Estofo rasgado", costCents: "" };
  const r = maintenanceSchema.parse(base);
  assert.equal(r.expectedEndDate, null);
  assert.equal(r.costCents, null);
  assert.ok(!maintenanceSchema.safeParse({ ...base, expectedEndDate: "2026-11-01" }).success);
  assert.equal(maintenanceSchema.parse({ ...base, costCents: "35" }).costCents, 3500);
  assert.ok(!maintenanceSchema.safeParse({ ...base, quantity: "0" }).success);
});

test("conclusão de manutenção: unidades perdidas ≥ 0", () => {
  assert.equal(completeMaintenanceSchema.parse({ endDate: "2026-11-10", lostQuantity: "0", costCents: "" }).lostQuantity, 0);
  assert.ok(!completeMaintenanceSchema.safeParse({ endDate: "2026-11-10", lostQuantity: "-1", costCents: "" }).success);
});
