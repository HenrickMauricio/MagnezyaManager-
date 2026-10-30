import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlausibleForeignTaxId, isValidPortugueseNif, normalizeTaxId } from "../../src/lib/nif";

test("NIF português com dígito de controlo válido", () => {
  for (const nif of ["500000000", "501000003", "502000007", "200000004", "123456789"]) {
    assert.ok(isValidPortugueseNif(nif), nif);
  }
});

test("NIF português inválido é rejeitado", () => {
  for (const nif of ["500000001", "12345678", "1234567890", "abcdefghi", "", "700000000"]) {
    assert.equal(isValidPortugueseNif(nif), false, nif);
  }
  assert.ok(isValidPortugueseNif("700000003"));
  assert.ok(!isValidPortugueseNif("400000000"), "4 só é válido como 45");
});

test("NIF aceita espaços, pontos e prefixo PT", () => {
  assert.equal(normalizeTaxId(" pt 501.000-003 "), "PT501000003");
  assert.ok(isValidPortugueseNif("PT 501 000 003"));
});

test("identificador fiscal estrangeiro", () => {
  assert.ok(isPlausibleForeignTaxId("ESB12345678"));
  assert.ok(isPlausibleForeignTaxId("DE 123 456 789"));
  assert.ok(!isPlausibleForeignTaxId("12"));
  assert.ok(!isPlausibleForeignTaxId("ES/123?"));
});
