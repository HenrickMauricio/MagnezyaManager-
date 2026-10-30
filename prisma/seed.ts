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
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type RoleKey } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Magnezya#2026";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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

/** Catálogo inspirado em magnezya.pt — preços por dia FICTÍCIOS. */
const CATALOG: { category: string; buffer?: number; items: [sku: string, name: string, priceCents: number, stock: number][] }[] = [
  {
    category: "Cadeiras",
    items: [
      ["CAD-CONG-PT", "Cadeira de congresso preta", 250, 600],
      ["CAD-DOBR-BR", "Cadeira dobrável branca", 200, 400],
      ["CAD-CHIA-DO", "Cadeira Chiavari dourada", 450, 200],
      ["CAD-TIFF-TR", "Cadeira Tiffany transparente", 550, 150],
      ["CAD-NORD-BR", "Cadeira nórdica branca", 400, 120],
      ["CAD-DSW-PT", "Cadeira DSW preta", 450, 100],
    ],
  },
  {
    category: "Mesas",
    items: [
      ["MES-BIST-PT", "Mesa bistro preta Ø60", 900, 60],
      ["MES-ALTA-BR", "Mesa alta branca Ø70", 1200, 80],
      ["MES-RED-180", "Mesa redonda Ø180 (10 pax)", 1500, 50],
      ["MES-RET-180", "Mesa retangular 180×80", 1200, 70],
      ["MES-CUBO-BR", "Mesa cubo branca", 1500, 30],
    ],
  },
  {
    category: "Sofás e poltronas",
    buffer: 1,
    items: [
      ["SOF-CHES-PT", "Sofá Chesterfield preto 3 lugares", 9500, 12],
      ["SOF-NAPA-BR", "Sofá napa branco 2 lugares", 6500, 16],
      ["POL-BARC-PT", "Poltrona Barcelona preta", 5500, 20],
      ["POL-TULI-BR", "Poltrona Tulipa branca", 4500, 18],
    ],
  },
  {
    category: "Bancos e banquetas",
    items: [
      ["BAN-ALTO-BR", "Banco alto branco", 650, 120],
      ["BAN-ACRI-TR", "Banco alto acrílico", 900, 60],
      ["BAN-LED-CUB", "Banco cubo LED", 1800, 40],
    ],
  },
  {
    category: "Balcões e bares",
    buffer: 1,
    items: [
      ["BAL-CURV-LED", "Balcão curvo iluminado LED", 9500, 8],
      ["BAL-RETO-LED", "Balcão reto iluminado LED", 8000, 10],
      ["BAL-LYCR-BR", "Balcão em lycra branco", 4500, 12],
    ],
  },
  {
    category: "Iluminação e decoração",
    items: [
      ["DEC-ESF-LED", "Esfera LED Ø60", 2500, 20],
      ["DEC-CIL-LED", "Cilindro LED", 2200, 16],
      ["DEC-CAND-PE", "Candeeiro de pé", 1800, 24],
      ["DEC-ESP-GR", "Espelho decorativo grande", 3500, 6],
    ],
  },
  {
    category: "Palcos e estruturas",
    buffer: 1,
    items: [
      ["EST-ESTR-2X1", "Estrado modular 2×1 m", 3000, 40],
      ["EST-PULP-AC", "Púlpito acrílico", 7500, 4],
      ["EST-BARR-SG", "Barreira de segurança", 800, 100],
      ["EST-BIOM-BR", "Biombo branco", 1500, 30],
    ],
  },
  {
    category: "Exterior e diversos",
    items: [
      ["DIV-TEND-3X3", "Tenda pop-up 3×3 m", 9000, 10],
      ["DIV-AQUE-EX", "Aquecedor de exterior", 4500, 15],
      ["DIV-PUFF-BR", "Puff branco", 800, 40],
      ["DIV-FLIP-CH", "Flip chart", 1500, 12],
    ],
  },
];

async function seedCatalog(taxRateId: string) {
  let order = 0;
  for (const block of CATALOG) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(block.category) },
      update: { name: block.category, sortOrder: order, prepBufferDays: block.buffer ?? 0 },
      create: {
        name: block.category,
        slug: slugify(block.category),
        sortOrder: order,
        prepBufferDays: block.buffer ?? 0,
      },
    });
    order += 1;

    for (const [sku, name, priceCents, stock] of block.items) {
      await prisma.article.upsert({
        where: { sku },
        update: {},
        create: {
          sku,
          name,
          categoryId: category.id,
          priceCents,
          priceUnit: "POR_DIA",
          taxRateId,
          stockBase: stock,
          unit: "un",
        },
      });
    }
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
