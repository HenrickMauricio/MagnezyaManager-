import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  canEditQuote,
  homePathFor,
  isInternalRole,
  resolvePermissions,
} from "../../src/lib/permissions";

test("administrador tem todas as permissões internas e nenhuma do portal", () => {
  const admin = new Set(ROLE_DEFAULT_PERMISSIONS.ADMIN);
  for (const p of ALL_PERMISSIONS) {
    assert.equal(admin.has(p), !p.startsWith("portal:"), p);
  }
});

test("vendedor não gere utilizadores, definições nem artigos", () => {
  const v = new Set(ROLE_DEFAULT_PERMISSIONS.VENDEDOR);
  assert.ok(!v.has("user:manage"));
  assert.ok(!v.has("settings:manage"));
  assert.ok(!v.has("article:write"));
  assert.ok(!v.has("quote:edit_any"));
  assert.ok(v.has("quote:create"));
  assert.ok(v.has("client:create"));
  assert.ok(v.has("availability:view"));
});

test("cliente só tem permissões do portal", () => {
  for (const p of ROLE_DEFAULT_PERMISSIONS.CLIENTE) assert.ok(p.startsWith("portal:"), p);
});

test("concessões e revogações individuais são aplicadas", () => {
  const perms = resolvePermissions(ROLE_DEFAULT_PERMISSIONS.VENDEDOR, [
    { key: "report:view", granted: true },
    { key: "quote:send", granted: false },
  ]);
  assert.ok(perms.has("report:view"));
  assert.ok(!perms.has("quote:send"));
  assert.ok(perms.has("quote:create"));
});

test("chaves desconhecidas são ignoradas", () => {
  const perms = resolvePermissions(["quote:view", "legacy:thing"], [{ key: "x:y", granted: true }]);
  assert.deepEqual([...perms], ["quote:view"]);
});

test("D5: vendedor edita só os seus orçamentos; admin edita todos", () => {
  const vendedor = { id: "v1", permissions: resolvePermissions(ROLE_DEFAULT_PERMISSIONS.VENDEDOR) };
  const admin = { id: "a1", permissions: resolvePermissions(ROLE_DEFAULT_PERMISSIONS.ADMIN) };
  assert.ok(canEditQuote(vendedor, { createdById: "v1" }));
  assert.ok(!canEditQuote(vendedor, { createdById: "v2" }));
  assert.ok(canEditQuote(admin, { createdById: "v2" }));
});

test("papel define a área inicial", () => {
  assert.equal(homePathFor("CLIENTE"), "/portal");
  assert.equal(homePathFor("VENDEDOR"), "/painel");
  assert.ok(isInternalRole("ADMIN"));
  assert.ok(!isInternalRole("CLIENTE"));
});
