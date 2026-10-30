/**
 * Seed de desenvolvimento e testes.
 *
 * - Sincroniza o catálogo de permissões e os papéis (idempotente).
 * - Cria taxas de IVA, categorias, artigos e serviços com base no catálogo
 *   público da Magnezya (preços FICTÍCIOS, apenas para testes).
 * - Cria utilizadores e clientes de demonstração claramente identificados.
 *
 * Pode ser executado várias vezes: usa upsert em tudo.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type RoleKey } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from "../src/lib/permissions";
import { slugify } from "../src/lib/slug";
import { CATALOG_CATEGORIES, type CatalogData } from "./data/catalog-types";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Magnezya#2026";

async function seedPermissionsAndRoles() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }

  const roleNames: Record<RoleKey, { name: string; description: string }> = {
    ADMIN: { name: "Administrador", description: "Acesso total à plataforma." },
    VENDEDOR: { name: "Vendedor", description: "Acesso operacional: clientes, inventário e orçamentos." },
    CLIENTE: { name: "Cliente", description: "Acesso ao portal do cliente." },
  };

  const permissions = await prisma.permission.findMany();
  const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const key of Object.keys(roleNames) as RoleKey[]) {
    const role = await prisma.role.upsert({
      where: { key },
      update: roleNames[key],
      create: { key, ...roleNames[key] },
    });
    // Repõe as permissões por omissão do papel.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: ROLE_DEFAULT_PERMISSIONS[key].map((p) => ({ roleId: role.id, permissionId: idByKey.get(p)! })),
    });
  }
}

async function seedTaxRates() {
  // Taxas de IVA em vigor (a confirmar pelo contabilista da Magnezya).
  const rates = [
    { name: "Taxa normal", rateBp: 2300, region: "CONTINENTE", isDefault: true },
    { name: "Taxa intermédia", rateBp: 1300, region: "CONTINENTE" },
    { name: "Taxa reduzida", rateBp: 600, region: "CONTINENTE" },
    { name: "Taxa normal", rateBp: 1600, region: "ACORES" },
    { name: "Taxa intermédia", rateBp: 900, region: "ACORES" },
    { name: "Taxa reduzida", rateBp: 400, region: "ACORES" },
    { name: "Taxa normal", rateBp: 2200, region: "MADEIRA" },
    { name: "Taxa intermédia", rateBp: 1200, region: "MADEIRA" },
    { name: "Taxa reduzida", rateBp: 500, region: "MADEIRA" },
  ] as const;

  for (const r of rates) {
    await prisma.taxRate.upsert({
      where: { name_region: { name: r.name, region: r.region } },
      update: { rateBp: r.rateBp },
      create: { name: r.name, rateBp: r.rateBp, region: r.region, isDefault: "isDefault" in r && r.isDefault },
    });
  }
  return prisma.taxRate.findFirstOrThrow({ where: { isDefault: true } });
}

async function seedCompany(defaultTaxRateId: string) {
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      legalName: "Magnezya – Event Support",
      tradeName: "Magnezya",
      website: "https://magnezya.pt",
      country: "Portugal",
      quoteValidityDays: 15,
      defaultTaxRateId,
      defaultTerms: [
        "Preços em euros, acrescidos de IVA à taxa legal em vigor.",
        "Proposta válida pelo prazo indicado e sujeita à disponibilidade dos artigos à data da adjudicação.",
        "A reserva dos artigos só é garantida após a aprovação da proposta.",
        "Danos ou extravios dos artigos alugados serão faturados ao valor de reposição.",
      ].join("\n"),
    },
  });
}

/**
 * Catálogo real da Magnezya (magnezya.pt, uso autorizado), gerado por
 * scripts/catalogo-magnezya.ts. Stock e preços são FICTÍCIOS mas estáveis:
 * derivados do id do produto, dentro de intervalos realistas por categoria.
 */
const catalog = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "data", "catalogo-magnezya.json"), "utf8"),
) as CatalogData;

/** SKUs do catálogo fictício inicial (substituído pelo catálogo real). */
const LEGACY_SKUS = [
  "CAD-CONG-PT", "CAD-DOBR-BR", "CAD-CHIA-DO", "CAD-TIFF-TR", "CAD-NORD-BR", "CAD-DSW-PT",
  "MES-BIST-PT", "MES-ALTA-BR", "MES-RED-180", "MES-RET-180", "MES-CUBO-BR",
  "SOF-CHES-PT", "SOF-NAPA-BR", "POL-BARC-PT", "POL-TULI-BR",
  "BAN-ALTO-BR", "BAN-ACRI-TR", "BAN-LED-CUB",
  "BAL-CURV-LED", "BAL-RETO-LED", "BAL-LYCR-BR",
  "DEC-ESF-LED", "DEC-CIL-LED", "DEC-CAND-PE", "DEC-ESP-GR",
  "EST-ESTR-2X1", "EST-PULP-AC", "EST-BARR-SG", "EST-BIOM-BR",
  "DIV-TEND-3X3", "DIV-AQUE-EX", "DIV-PUFF-BR", "DIV-FLIP-CH",
];

/** Número pseudoaleatório estável em [0, 1) a partir de um inteiro (mulberry32). */
function stableRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function fictitiousStock(id: number, [min, max]: readonly [number, number]): number {
  const raw = min + stableRandom(id) * (max - min);
  const step = max > 100 ? 10 : max > 30 ? 5 : 1;
  return Math.max(min, Math.round(raw / step) * step);
}

function fictitiousPriceCents(id: number, [min, max]: readonly [number, number]): number {
  const euros = min + stableRandom(id * 7919) * (max - min);
  return Math.round(euros * 2) * 50; // múltiplos de 0,50 €
}

async function seedCatalog(taxRateId: string) {
  const categoryIds = new Map<string, string>();
  for (const [order, c] of CATALOG_CATEGORIES.entries()) {
    const data = { name: c.name, slug: slugify(c.name), sortOrder: order, prepBufferDays: c.buffer, archivedAt: null };
    const category = await prisma.category.upsert({
      where: { skuPrefix: c.prefix },
      update: data,
      create: { ...data, skuPrefix: c.prefix },
    });
    categoryIds.set(c.prefix, category.id);
  }

  for (const item of catalog.items) {
    const category = CATALOG_CATEGORIES.find((c) => c.prefix === item.category)!;
    const content = { name: item.name, description: item.description, categoryId: categoryIds.get(item.category)! };
    await prisma.article.upsert({
      where: { sku: item.sku },
      // Reimportar atualiza textos e categoria, mas nunca o stock (só muda por movimentos).
      update: content,
      create: {
        ...content,
        sku: item.sku,
        priceCents: fictitiousPriceCents(item.sourceId, category.price),
        priceUnit: "POR_DIA",
        taxRateId,
        stockBase: fictitiousStock(item.sourceId, category.stock),
        unit: "un",
      },
    });
  }

  // Remove os artigos do catálogo fictício inicial; os que já têm histórico ficam arquivados.
  for (const sku of LEGACY_SKUS) {
    const legacy = await prisma.article.findUnique({
      where: { sku },
      include: { _count: { select: { movements: true, maintenances: true, images: true, quoteItems: true, rentalItems: true } } },
    });
    if (!legacy) continue;
    const used = Object.values(legacy._count).some((n) => n > 0);
    if (used) await prisma.article.update({ where: { id: legacy.id }, data: { archivedAt: legacy.archivedAt ?? new Date() } });
    else await prisma.article.delete({ where: { id: legacy.id } });
  }

  const services = [
    { name: "Transporte (Grande Lisboa)", defaultPriceCents: 9500, unit: "viagem" },
    { name: "Montagem", defaultPriceCents: 3500, unit: "hora" },
    { name: "Desmontagem", defaultPriceCents: 3500, unit: "hora" },
    { name: "Limpeza especial", defaultPriceCents: 6000, unit: "serviço" },
  ];
  for (const s of services) {
    const existing = await prisma.additionalService.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.additionalService.create({ data: { ...s, taxRateId } });
  }
}

async function upsertUser(params: {
  email: string;
  name: string;
  role: RoleKey;
  clientId?: string;
  maxDiscountBp?: number;
}) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: params.role } });
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: { roleId: role.id, clientId: params.clientId ?? null },
    create: {
      email: params.email,
      name: params.name,
      emailVerified: true,
      roleId: role.id,
      clientId: params.clientId ?? null,
      maxDiscountBp: params.maxDiscountBp ?? 0,
    },
  });
  const hasCredential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!hasCredential) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: await hashPassword(DEFAULT_PASSWORD),
      },
    });
  }
  return user;
}

async function seedPeople() {
  const admin = await upsertUser({ email: "admin@magnezya.test", name: "Administrador Demo", role: "ADMIN", maxDiscountBp: 10000 });
  await upsertUser({ email: "vendedor@magnezya.test", name: "Vendedor Demo", role: "VENDEDOR", maxDiscountBp: 1000 });
  await upsertUser({ email: "vendedor2@magnezya.test", name: "Vendedora Demo 2", role: "VENDEDOR", maxDiscountBp: 500 });

  const clients = [
    { name: "Cliente Demo Alfa, Lda.", nif: "500000000", city: "Lisboa", email: "eventos@alfa.example" },
    // NIFs fictícios mas com dígito de controlo válido.
    { name: "Cliente Demo Beta – Congressos, S.A.", nif: "501000003", city: "Porto", email: "geral@beta.example" },
    { name: "Cliente Demo Gama Feiras", nif: "502000007", city: "Braga", email: "info@gama.example" },
  ];
  const created = [];
  for (const c of clients) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    created.push(
      existing
        ? await prisma.client.update({ where: { id: existing.id }, data: { nif: c.nif } })
        : await prisma.client.create({
          data: {
            ...c,
            type: "EMPRESA",
            country: "PT",
            createdById: admin.id,
            contacts: { create: { name: "Contacto Demo", email: c.email, isPrimary: true } },
          },
        }),
    );
  }

  await upsertUser({ email: "cliente@alfa.example", name: "Contacto Alfa", role: "CLIENTE", clientId: created[0]!.id });
  await upsertUser({ email: "cliente@beta.example", name: "Contacto Beta", role: "CLIENTE", clientId: created[1]!.id });
}

async function main() {
  console.log("A sincronizar permissões e papéis…");
  await seedPermissionsAndRoles();
  console.log("A criar taxas de IVA e definições da empresa…");
  const defaultTax = await seedTaxRates();
  await seedCompany(defaultTax.id);
  console.log("A criar categorias, artigos e serviços…");
  await seedCatalog(defaultTax.id);
  console.log("A criar utilizadores e clientes de demonstração…");
  await seedPeople();

  const counts = {
    artigos: await prisma.article.count(),
    categorias: await prisma.category.count(),
    clientes: await prisma.client.count(),
    utilizadores: await prisma.user.count(),
  };
  console.log("Seed concluído:", counts);
  console.log(`Palavra-passe dos utilizadores de demonstração: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
