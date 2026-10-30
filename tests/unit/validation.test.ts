import { test } from "node:test";
import assert from "node:assert/strict";
import { clientSchema, contactSchema } from "../../src/lib/validation/clients";
import { changePasswordSchema, createUserSchema, updateUserSchema } from "../../src/lib/validation/users";

const baseClient = {
  type: "EMPRESA",
  name: "Eventos Lisboa, Lda.",
  nif: "501 000 003",
  email: "",
  phone: "",
  billingAddress: "",
  postalCode: "",
  city: "",
  country: "PT",
  notes: "",
};

test("cliente válido: NIF normalizado e campos vazios a null", () => {
  const r = clientSchema.parse({ ...baseClient, gdprConsent: "on" });
  assert.equal(r.nif, "501000003");
  assert.equal(r.email, null);
  assert.equal(r.gdprConsent, true);
});

test("NIF obrigatório para empresas e particulares", () => {
  for (const type of ["EMPRESA", "PARTICULAR"]) {
    const r = clientSchema.safeParse({ ...baseClient, type, nif: "" });
    assert.ok(!r.success, type);
  }
});

test("NIF português inválido e código postal mal formatado são rejeitados", () => {
  const r = clientSchema.safeParse({ ...baseClient, nif: "501000004", postalCode: "1000" });
  assert.ok(!r.success);
  const paths = r.error.issues.map((i) => i.path.join("."));
  assert.deepEqual(paths.sort(), ["nif", "postalCode"]);
});

test("cliente estrangeiro: NIF sem dígito de controlo português", () => {
  const r = clientSchema.parse({ ...baseClient, country: "ES", nif: "ESB12345678", postalCode: "28001" });
  assert.equal(r.nif, "ESB12345678");
});

test("prefixo PT é removido do NIF português", () => {
  assert.equal(clientSchema.parse({ ...baseClient, nif: "PT501000003" }).nif, "501000003");
});

test("contacto: nome obrigatório e email validado", () => {
  assert.ok(!contactSchema.safeParse({ name: "", jobTitle: "", email: "", phone: "" }).success);
  assert.ok(!contactSchema.safeParse({ name: "Ana", jobTitle: "", email: "ana@", phone: "" }).success);
  assert.ok(contactSchema.safeParse({ name: "Ana", jobTitle: "", email: "ana@x.pt", phone: "+351 912 345 678" }).success);
});

const baseUser = { name: "Rui", email: "Rui@Magnezya.PT", phone: "", role: "VENDEDOR", clientId: "", maxDiscountBp: "7,5" };

test("utilizador: email em minúsculas e desconto em pontos-base", () => {
  const r = createUserSchema.parse({ ...baseUser, password: "temporaria123" });
  assert.equal(r.email, "rui@magnezya.pt");
  assert.equal(r.maxDiscountBp, 750);
  assert.equal(r.clientId, null);
});

test("utilizador: palavra-passe temporária com pelo menos 10 caracteres", () => {
  assert.ok(!createUserSchema.safeParse({ ...baseUser, password: "curta" }).success);
});

test("conta do portal exige cliente", () => {
  const r = updateUserSchema.safeParse({ ...baseUser, role: "CLIENTE" });
  assert.ok(!r.success);
  assert.deepEqual(r.error.issues[0]?.path, ["clientId"]);
});

test("desconto fora de 0–100 % é rejeitado", () => {
  assert.ok(!updateUserSchema.safeParse({ ...baseUser, maxDiscountBp: "150" }).success);
  assert.ok(!updateUserSchema.safeParse({ ...baseUser, maxDiscountBp: "abc" }).success);
});

test("alterar palavra-passe: confirmação e diferente da atual", () => {
  const ok = { currentPassword: "antiga-123456", newPassword: "nova-palavra-1", confirmPassword: "nova-palavra-1" };
  assert.ok(changePasswordSchema.safeParse(ok).success);
  assert.ok(!changePasswordSchema.safeParse({ ...ok, confirmPassword: "outra-coisa-1" }).success);
  assert.ok(!changePasswordSchema.safeParse({ ...ok, newPassword: ok.currentPassword, confirmPassword: ok.currentPassword }).success);
});
