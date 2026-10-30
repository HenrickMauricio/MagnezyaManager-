import { test } from "node:test";
import assert from "node:assert/strict";
import { findShortage, formatSku, maintenanceAt, signedQuantity, totalAt } from "../../src/lib/inventory";
import { addDaysISO, formatISODate, todayISO } from "../../src/lib/format";
import { slugify } from "../../src/lib/slug";

test("stock total num dia = inicial + movimentos até esse dia", () => {
  const movements = [
    { date: "2026-11-01", quantity: 20 },
    { date: "2026-11-10", quantity: -5 },
  ];
  assert.equal(totalAt(100, movements, "2026-10-31"), 100);
  assert.equal(totalAt(100, movements, "2026-11-01"), 120);
  assert.equal(totalAt(100, movements, "2026-11-10"), 115);
});

test("manutenção ocupa do início ao fim (inclusive); sem fim ocupa sempre", () => {
  const periods = [
    { start: "2026-11-05", end: "2026-11-07", quantity: 3 },
    { start: "2026-11-06", end: null, quantity: 2 },
  ];
  assert.equal(maintenanceAt(periods, "2026-11-04"), 0);
  assert.equal(maintenanceAt(periods, "2026-11-06"), 5);
  assert.equal(maintenanceAt(periods, "2026-11-08"), 2);
  assert.equal(maintenanceAt(periods, "2027-06-01"), 2);
});

test("abate que deixaria o stock negativo é detetado", () => {
  const shortage = findShortage(10, [{ date: "2026-11-02", quantity: -12 }], []);
  assert.deepEqual(shortage, { date: "2026-11-02", total: -2, inMaintenance: 0 });
});

test("abate é recusado se não sobrarem unidades para as que estão em manutenção", () => {
  const periods = [{ start: "2026-11-01", end: null, quantity: 8 }];
  assert.equal(findShortage(10, [{ date: "2026-11-05", quantity: -2 }], periods), null);
  assert.deepEqual(findShortage(10, [{ date: "2026-11-05", quantity: -3 }], periods), {
    date: "2026-11-05",
    total: 7,
    inMaintenance: 8,
  });
});

test("abate futuro conta para manutenções que começam depois", () => {
  // 10 un; abate de 5 a 20/11; manutenção de 6 un a partir de 25/11 → falta a 25/11.
  const shortage = findShortage(10, [{ date: "2026-11-20", quantity: -5 }], [{ start: "2026-11-25", end: null, quantity: 6 }]);
  assert.equal(shortage?.date, "2026-11-25");
});

test("entrada posterior não salva um dia anterior com stock negativo", () => {
  const movements = [
    { date: "2026-11-01", quantity: -15 },
    { date: "2026-11-03", quantity: 10 },
  ];
  assert.equal(findShortage(10, movements, [])?.date, "2026-11-01");
});

test("manutenção fechada a D deixa de ocupar em D (abate no mesmo dia não conta a dobrar)", () => {
  // 10 un, 4 em manutenção de 01/11 até 09/11 (fechada a 10/11), 4 abatidas a 10/11.
  const periods = [{ start: "2026-11-01", end: addDaysISO("2026-11-10", -1), quantity: 4 }];
  assert.equal(findShortage(10, [{ date: "2026-11-10", quantity: -4 }], periods), null);
  assert.equal(totalAt(10, [{ date: "2026-11-10", quantity: -4 }], "2026-11-10") - maintenanceAt(periods, "2026-11-10"), 6);
});

test("sinal da quantidade conforme o tipo de movimento", () => {
  assert.equal(signedQuantity("ENTRADA", 5), 5);
  assert.equal(signedQuantity("ABATE", 5), -5);
  assert.equal(signedQuantity("AJUSTE", -3), -3);
  assert.equal(signedQuantity("AJUSTE", 3), 3);
});

test("SKU automático com 4 dígitos", () => {
  assert.equal(formatSku("CAD", 1), "CAD-0001");
  assert.equal(formatSku("MES", 123), "MES-0123");
  assert.equal(formatSku("DIV", 12345), "DIV-12345");
});

test("datas de calendário: hoje em Lisboa, somar dias e formatar", () => {
  // 23:30 UTC a 31/12 → em Lisboa (UTC+0 no inverno) ainda é 31/12.
  assert.equal(todayISO(new Date("2026-12-31T23:30:00Z")), "2026-12-31");
  // 23:30 UTC a 30/06 → em Lisboa (UTC+1 no verão) já é 01/07.
  assert.equal(todayISO(new Date("2026-06-30T23:30:00Z")), "2026-07-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2028-03-01", -1), "2028-02-29");
  assert.equal(formatISODate("2026-11-05"), "05/11/2026");
});

test("slug sem acentos", () => {
  assert.equal(slugify("Sofás e poltronas"), "sofas-e-poltronas");
  assert.equal(slugify("  Iluminação & Decoração "), "iluminacao-decoracao");
});
