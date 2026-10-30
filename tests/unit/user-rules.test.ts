import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUserStateChange, generateTemporaryPassword, overridablePermissions } from "../../src/lib/user-rules";

const admin = { id: "a1", role: "ADMIN" as const, active: true };

test("ninguém se desativa a si próprio nem altera o próprio perfil", () => {
  assert.match(
    checkUserStateChange({ actorId: "a1", before: admin, after: { role: "ADMIN", active: false }, activeAdminCount: 3 })!,
    /própria conta/,
  );
  assert.match(
    checkUserStateChange({ actorId: "a1", before: admin, after: { role: "VENDEDOR", active: true }, activeAdminCount: 3 })!,
    /próprio perfil/,
  );
});

test("o último administrador ativo não pode ser desativado nem despromovido", () => {
  for (const after of [
    { role: "ADMIN" as const, active: false },
    { role: "VENDEDOR" as const, active: true },
  ]) {
    assert.match(
      checkUserStateChange({ actorId: "outro", before: admin, after, activeAdminCount: 1 })!,
      /pelo menos um administrador/,
    );
    assert.equal(checkUserStateChange({ actorId: "outro", before: admin, after, activeAdminCount: 2 }), null);
  }
});

test("alterações a vendedores e clientes não dependem do número de administradores", () => {
  const seller = { id: "v1", role: "VENDEDOR" as const, active: true };
  assert.equal(
    checkUserStateChange({ actorId: "a1", before: seller, after: { role: "VENDEDOR", active: false }, activeAdminCount: 1 }),
    null,
  );
});

test("permissões individuais: só internas e nunca do portal", () => {
  assert.deepEqual(overridablePermissions("CLIENTE"), []);
  const perms = overridablePermissions("VENDEDOR");
  assert.ok(perms.includes("user:manage"));
  assert.ok(!perms.some((p) => p.startsWith("portal:")));
});

test("palavra-passe temporária gerada é longa e sem caracteres ambíguos", () => {
  const a = generateTemporaryPassword();
  assert.equal(a.length, 14);
  assert.doesNotMatch(a, /[0O1lI]/);
  assert.notEqual(a, generateTemporaryPassword());
});
