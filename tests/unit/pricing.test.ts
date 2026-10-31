import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBp, billableDaysBetween, computeTotals, type PricedItem } from "../../src/lib/pricing";

const item = (over: Partial<PricedItem>): PricedItem => ({
  unitPriceCents: 450,
  quantity: 100,
  priceUnit: "POR_DIA",
  billableDays: 3,
  discountBp: 0,
  taxRateBp: 2300,
  ...over,
});

test("dias faturáveis: do início ao fim do evento, inclusive", () => {
  assert.equal(billableDaysBetween("2026-11-10", "2026-11-10"), 1);
  assert.equal(billableDaysBetween("2026-11-10", "2026-11-12"), 3);
  assert.equal(billableDaysBetween("2026-12-31", "2027-01-01"), 2);
  // Mudança de hora (25/10) não altera a contagem.
  assert.equal(billableDaysBetween("2026-10-24", "2026-10-26"), 3);
});

test("preço por dia multiplica pelos dias; por evento não", () => {
  const t = computeTotals([item({}), item({ priceUnit: "POR_EVENTO", unitPriceCents: 9500, quantity: 2 })], [], 0);
  assert.deepEqual(t.itemTotals, [135_000, 19_000]);
  assert.equal(t.subtotalCents, 154_000);
});

test("descontos de linha e global, IVA e total", () => {
  // 100 cadeiras × 4,50 € × 3 dias = 1350 €; −10 % na linha = 1215 €; −5 % global = 1154,25 €.
  // Transporte 95 € (sem desconto). Base 23 % = 1249,25 €; IVA = 287,33 €.
  const t = computeTotals([item({ discountBp: 1000 })], [{ unitPriceCents: 9500, quantity: 1, taxRateBp: 2300 }], 500);
  assert.equal(t.grossCents, 135_000);
  assert.equal(t.subtotalCents, 121_500);
  assert.equal(t.discountCents, 6_075);
  assert.equal(t.servicesCents, 9_500);
  assert.deepEqual(t.taxLines, [{ rateBp: 2300, baseCents: 124_925, taxCents: 28_733 }]);
  assert.equal(t.totalCents, 124_925 + 28_733);
  // Desconto efetivo = 1 − 1154,25 / 1350 = 14,5 %.
  assert.equal(t.effectiveDiscountBp, 1450);
});

test("IVA agrupado por taxa, da maior para a menor", () => {
  const t = computeTotals(
    [item({ quantity: 1, billableDays: 1, unitPriceCents: 10_000 }), item({ quantity: 1, billableDays: 1, unitPriceCents: 10_000, taxRateBp: 600 })],
    [{ unitPriceCents: 5_000, quantity: 1, taxRateBp: 600 }],
    0,
  );
  assert.deepEqual(t.taxLines, [
    { rateBp: 2300, baseCents: 10_000, taxCents: 2_300 },
    { rateBp: 600, baseCents: 15_000, taxCents: 900 },
  ]);
  assert.equal(t.totalCents, 25_000 + 3_200);
});

test("arredondamento ao cêntimo, half-up", () => {
  assert.equal(applyBp(1, 5000), 1); // 0,5 cêntimos → 1
  assert.equal(applyBp(333, 2300), 77); // 76,59 → 77
  // 3 × 3,33 € com 23 %: base 9,99 € → IVA 2,30 € (2,2977 arredondado)
  const t = computeTotals([item({ unitPriceCents: 333, quantity: 3, billableDays: 1 })], [], 0);
  assert.equal(t.taxCents, 230);
});

test("orçamento vazio e isenção de IVA", () => {
  const empty = computeTotals([], [], 1000);
  assert.equal(empty.totalCents, 0);
  assert.equal(empty.effectiveDiscountBp, 0);
  const exempt = computeTotals([item({ taxRateBp: 0, quantity: 1, billableDays: 1, unitPriceCents: 1000 })], [], 0);
  assert.deepEqual(exempt.taxLines, [{ rateBp: 0, baseCents: 1000, taxCents: 0 }]);
});
