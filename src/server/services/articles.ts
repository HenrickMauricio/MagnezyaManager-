import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { getStockFigures } from "@/server/services/inventory";
import { processArticleImage } from "@/server/services/images";
import { deleteObject, putObject } from "@/server/services/storage";
import type { Prisma } from "@/generated/prisma/client";
import { newArticleImageKey, thumbKey } from "@/lib/files";
import { formatSku } from "@/lib/inventory";
import type { ArticleListParams, CreateArticleInput, UpdateArticleInput } from "@/lib/validation/catalog";

export const ARTICLE_PAGE_SIZE = 25;
export const MAX_IMAGES_PER_ARTICLE = 12;

const STATUS_FILTER = { ativos: "ATIVO", inativos: "INATIVO", descontinuados: "DESCONTINUADO" } as const;

export async function listArticles(user: CurrentUser, params: ArticleListParams) {
  assertPermission(user, "article:view");

  const where: Prisma.ArticleWhereInput = {};
  if (params.estado === "arquivados") where.archivedAt = { not: null };
  else {
    where.archivedAt = null;
    if (params.estado !== "todos") where.status = STATUS_FILTER[params.estado];
  }
  if (params.categoria) where.category = { slug: params.categoria };
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    where.OR = [{ name: contains }, { sku: contains }, { description: contains }];
  }

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    params.ordem === "sku"
      ? [{ sku: "asc" }]
      : params.ordem === "preco"
        ? [{ priceCents: "desc" }, { name: "asc" }]
        : params.ordem === "recentes"
          ? [{ createdAt: "desc" }]
          : [{ name: "asc" }];

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy,
      skip: (params.pagina - 1) * ARTICLE_PAGE_SIZE,
      take: ARTICLE_PAGE_SIZE,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        priceCents: true,
        priceUnit: true,
        status: true,
        archivedAt: true,
        category: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { storageKey: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  const stock = await getStockFigures(items.map((a) => a.id));
  return {
    items: items.map((a) => ({ ...a, stock: stock.get(a.id) ?? { total: 0, inMaintenance: 0 } })),
    total,
    page: params.pagina,
    pageSize: ARTICLE_PAGE_SIZE,
  };
}

export async function getArticle(user: CurrentUser, id: string) {
  assertPermission(user, "article:view");
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true, prepBufferDays: true } },
      taxRate: { select: { id: true, name: true, rateBp: true, region: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!article) throw new NotFoundError("Artigo não encontrado.");
  const stock = (await getStockFigures([id])).get(id) ?? { total: article.stockBase, inMaintenance: 0 };
  return { ...article, stock };
}

/** Taxas de IVA ativas para o formulário (Continente primeiro). */
export async function listTaxRateOptions(user: CurrentUser) {
  assertPermission(user, "article:view");
  return prisma.taxRate.findMany({
    where: { active: true },
    orderBy: [{ region: "asc" }, { rateBp: "desc" }],
    select: { id: true, name: true, rateBp: true, region: true, isDefault: true },
  });
}

async function assertReferences(categoryId: string, taxRateId: string) {
  const [category, taxRate] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId }, select: { archivedAt: true, skuPrefix: true } }),
    prisma.taxRate.findUnique({ where: { id: taxRateId }, select: { active: true } }),
  ]);
  if (!category || category.archivedAt) throw new ConflictError("Escolha uma categoria ativa.");
  if (!taxRate || !taxRate.active) throw new ConflictError("Escolha uma taxa de IVA ativa.");
  return category;
}

async function assertSkuAvailable(sku: string, exceptId?: string) {
  const existing = await prisma.article.findUnique({ where: { sku }, select: { id: true, name: true } });
  if (existing && existing.id !== exceptId) throw new ConflictError(`O SKU ${sku} já é usado por "${existing.name}".`);
}

/** Gera o próximo SKU livre da categoria (CAD-0001, CAD-0002, …). */
async function nextSku(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const seq = await tx.documentSequence.upsert({
      where: { key: `SKU-${prefix}` },
      create: { key: `SKU-${prefix}`, last: 1 },
      update: { last: { increment: 1 } },
    });
    const sku = formatSku(prefix, seq.last);
    if (!(await tx.article.findUnique({ where: { sku }, select: { id: true } }))) return sku;
  }
  throw new ConflictError("Não foi possível gerar um SKU livre. Indique-o manualmente.");
}

export async function createArticle(user: CurrentUser, input: CreateArticleInput) {
  assertPermission(user, "article:write");
  const category = await assertReferences(input.categoryId, input.taxRateId);
  if (input.sku) await assertSkuAvailable(input.sku);

  return prisma.$transaction(async (tx) => {
    const sku = input.sku ?? (await nextSku(tx, category.skuPrefix));
    const article = await tx.article.create({ data: { ...input, sku } });
    await logAudit(
      { actorId: user.id, action: "article.create", entity: "Article", entityId: article.id, after: { ...input, sku } },
      tx,
    );
    return article;
  });
}

async function getEditableArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw new NotFoundError("Artigo não encontrado.");
  if (article.archivedAt) throw new ConflictError("O artigo está arquivado. Restaure-o antes de o alterar.");
  return article;
}

/** Edição dos dados do artigo. O stock não muda aqui — só por movimentos. */
export async function updateArticle(user: CurrentUser, id: string, input: UpdateArticleInput) {
  assertPermission(user, "article:write");
  const before = await getEditableArticle(id);
  await assertReferences(input.categoryId, input.taxRateId);
  const sku = input.sku ?? before.sku;
  if (sku !== before.sku) await assertSkuAvailable(sku, id);

  await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { ...input, sku } });
    await logAudit(
      {
        actorId: user.id,
        action: "article.update",
        entity: "Article",
        entityId: id,
        before: {
          name: before.name,
          sku: before.sku,
          categoryId: before.categoryId,
          description: before.description,
          unit: before.unit,
          priceCents: before.priceCents,
          priceUnit: before.priceUnit,
          taxRateId: before.taxRateId,
          status: before.status,
          internalNotes: before.internalNotes,
        },
        after: { ...input, sku },
      },
      tx,
    );
  });
}

export async function archiveArticle(user: CurrentUser, id: string) {
  assertPermission(user, "article:delete");
  const article = await getEditableArticle(id);
  const openMaintenance = await prisma.maintenance.count({
    where: { articleId: id, status: { in: ["ABERTA", "EM_CURSO"] } },
  });
  if (openMaintenance > 0) throw new ConflictError("Feche as manutenções em aberto antes de arquivar o artigo.");

  await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { archivedAt: new Date() } });
    await logAudit(
      { actorId: user.id, action: "article.archive", entity: "Article", entityId: id, after: { name: article.name } },
      tx,
    );
  });
}

export async function restoreArticle(user: CurrentUser, id: string) {
  assertPermission(user, "article:delete");
  const article = await prisma.article.findUnique({
    where: { id },
    include: { category: { select: { archivedAt: true, name: true } } },
  });
  if (!article) throw new NotFoundError("Artigo não encontrado.");
  if (article.category.archivedAt) {
    throw new ConflictError(`A categoria "${article.category.name}" está arquivada. Restaure-a primeiro.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { archivedAt: null } });
    await logAudit(
      { actorId: user.id, action: "article.restore", entity: "Article", entityId: id, after: { name: article.name } },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Fotografias
// ---------------------------------------------------------------------------

export async function addArticleImage(user: CurrentUser, articleId: string, file: Buffer) {
  assertPermission(user, "article:write");
  const article = await getEditableArticle(articleId);
  const count = await prisma.articleImage.count({ where: { articleId } });
  if (count >= MAX_IMAGES_PER_ARTICLE) {
    throw new ConflictError(`Máximo de ${MAX_IMAGES_PER_ARTICLE} fotografias por artigo.`);
  }

  const { full, thumb } = await processArticleImage(file);
  const key = newArticleImageKey(articleId);
  await putObject(key, full);
  await putObject(thumbKey(key), thumb);

  try {
    await prisma.$transaction(async (tx) => {
      const image = await tx.articleImage.create({
        data: { articleId, storageKey: key, alt: article.name, sortOrder: count, isPrimary: count === 0 },
      });
      await logAudit(
        { actorId: user.id, action: "article.image_add", entity: "Article", entityId: articleId, after: { imageId: image.id } },
        tx,
      );
    });
  } catch (err) {
    // Não deixar ficheiros sem registo na BD.
    await Promise.all([deleteObject(key), deleteObject(thumbKey(key))]);
    throw err;
  }
}

async function getImage(articleId: string, imageId: string) {
  const image = await prisma.articleImage.findFirst({ where: { id: imageId, articleId } });
  if (!image) throw new NotFoundError("Fotografia não encontrada.");
  return image;
}

export async function setPrimaryImage(user: CurrentUser, articleId: string, imageId: string) {
  assertPermission(user, "article:write");
  await getEditableArticle(articleId);
  await getImage(articleId, imageId);
  await prisma.$transaction(async (tx) => {
    await tx.articleImage.updateMany({ where: { articleId }, data: { isPrimary: false } });
    await tx.articleImage.update({ where: { id: imageId }, data: { isPrimary: true } });
    await logAudit(
      { actorId: user.id, action: "article.image_primary", entity: "Article", entityId: articleId, after: { imageId } },
      tx,
    );
  });
}

export async function moveImage(user: CurrentUser, articleId: string, imageId: string, direction: "left" | "right") {
  assertPermission(user, "article:write");
  await getEditableArticle(articleId);
  const images = await prisma.articleImage.findMany({
    where: { articleId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = images.findIndex((i) => i.id === imageId);
  const target = direction === "left" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target]!, images[index]!];
  await prisma.$transaction(
    images.map((img, i) => prisma.articleImage.update({ where: { id: img.id }, data: { sortOrder: i } })),
  );
}

export async function deleteImage(user: CurrentUser, articleId: string, imageId: string) {
  assertPermission(user, "article:write");
  await getEditableArticle(articleId);
  const image = await getImage(articleId, imageId);

  await prisma.$transaction(async (tx) => {
    await tx.articleImage.delete({ where: { id: imageId } });
    // A primeira fotografia restante passa a principal.
    if (image.isPrimary) {
      const next = await tx.articleImage.findFirst({
        where: { articleId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (next) await tx.articleImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await logAudit(
      { actorId: user.id, action: "article.image_delete", entity: "Article", entityId: articleId, before: { imageId } },
      tx,
    );
  });
  await Promise.all([deleteObject(image.storageKey), deleteObject(thumbKey(image.storageKey))]);
}
