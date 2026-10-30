import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBasisPoints, formatCents, formatDate, parseEurosToCents } from "../../src/lib/format";

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

test("moeda em euros no formato pt-PT", () => {
  assert.equal(nbsp(formatCents(123456)), "1234,56 €");
  assert.equal(nbsp(formatCents(12345678)), "123 456,78 €");
  assert.equal(nbsp(formatCents(0)), "0,00 €");
});

test("percentagem a partir de pontos-base", () => {
  const compact = (s: string) => nbsp(s).replace(/ /g, "");
  assert.equal(compact(formatBasisPoints(2300)), "23%");
  assert.equal(compact(formatBasisPoints(1250)), "12,5%");
});

test("datas em dd/mm/aaaa no fuso de Lisboa", () => {
  assert.equal(formatDate(new Date("2026-11-13T12:00:00Z")), "13/11/2026");
  // 23:30 UTC de 31/12 já é 31/12 em Lisboa (UTC+0 no inverno)
  assert.equal(formatDate(new Date("2026-12-31T23:30:00Z")), "31/12/2026");
});

test("conversão de texto em euros para cêntimos", () => {
  assert.equal(parseEurosToCents("1.234,56"), 123456);
  assert.equal(parseEurosToCents("1234.5"), 123450);
  assert.equal(parseEurosToCents("12,5 €"), 1250);
  assert.equal(parseEurosToCents("0,1"), 10);
  assert.equal(parseEurosToCents("abc"), null);
  assert.equal(parseEurosToCents(""), null);
});
