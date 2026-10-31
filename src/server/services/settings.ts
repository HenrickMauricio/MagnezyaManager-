import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { processLogo } from "@/server/services/images";
import { deleteObject, putObject } from "@/server/services/storage";
import { BRAND } from "@/config/brand";
import type { CompanySettingsInput, ServiceInput } from "@/lib/validation/settings";

const ID = "default";

/**
 * Definições da empresa (linha única). Usadas nos orçamentos e no PDF;
 * se ainda não existirem, são criadas com o nome da marca da instalação.
 */
export async function getCompanySettings() {
  return prisma.companySettings.upsert({
    where: { id: ID },
    update: {},
    create: { id: ID, legalName: BRAND.name, tradeName: BRAND.name },
  });
}

export async function updateCompanySettings(user: CurrentUser, input: CompanySettingsInput) {
  assertPermission(user, "settings:manage");
  const before = await getCompanySettings();
  await prisma.$transaction(async (tx) => {
    await tx.companySettings.update({ where: { id: ID }, data: input });
    await logAudit(
      {
        actorId: user.id,
        action: "settings.update",
        entity: "CompanySettings",
        entityId: ID,
        before: {
          legalName: before.legalName,
          nif: before.nif,
          iban: before.iban,
          quotePrefix: before.quotePrefix,
          quoteValidityDays: before.quoteValidityDays,
        },
        after: input,
      },
      tx,
    );
  });
}

/** Substitui o logótipo (usado no PDF das propostas). */
export async function setLogo(user: CurrentUser, file: Buffer) {
  assertPermission(user, "settings:manage");
  const before = await getCompanySettings();
  const png = await processLogo(file);
  const key = `branding/logo-${crypto.randomUUID()}.png`;
  await putObject(key, png);
  await prisma.companySettings.update({ where: { id: ID }, data: { logoKey: key } });
  await logAudit({ actorId: user.id, action: "settings.logo", entity: "CompanySettings", entityId: ID });
  // O logótipo anterior pode estar em versões já emitidas: os PDFs guardados não
  // dependem dele (já o incluem), por isso pode ser removido.
  if (before.logoKey) await deleteObject(before.logoKey);
}

export async function removeLogo(user: CurrentUser) {
  assertPermission(user, "settings:manage");
  const before = await getCompanySettings();
  if (!before.logoKey) return;
  await prisma.companySettings.update({ where: { id: ID }, data: { logoKey: null } });
  await logAudit({ actorId: user.id, action: "settings.logo_remove", entity: "CompanySettings", entityId: ID });
  await deleteObject(before.logoKey);
}

// ---------------------------------------------------------------------------
// Serviços adicionais (transporte, montagem, …)
// ---------------------------------------------------------------------------

export async function listServices(user: CurrentUser, { onlyActive = false } = {}) {
  assertPermission(user, onlyActive ? "quote:view" : "settings:manage");
  return prisma.additionalService.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { taxRate: { select: { id: true, name: true, rateBp: true } } },
  });
}

async function assertActiveTaxRate(taxRateId: string) {
  const tax = await prisma.taxRate.findUnique({ where: { id: taxRateId }, select: { active: true } });
  if (!tax?.active) throw new ConflictError("Escolha uma taxa de IVA ativa.");
}

export async function saveService(user: CurrentUser, id: string | null, input: ServiceInput) {
  assertPermission(user, "settings:manage");
  await assertActiveTaxRate(input.taxRateId);
  if (id) {
    const before = await prisma.additionalService.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Serviço não encontrado.");
  }
  await prisma.$transaction(async (tx) => {
    const service = id
      ? await tx.additionalService.update({ where: { id }, data: input })
      : await tx.additionalService.create({ data: input });
    await logAudit(
      {
        actorId: user.id,
        action: id ? "service.update" : "service.create",
        entity: "AdditionalService",
        entityId: service.id,
        after: input,
      },
      tx,
    );
  });
}
