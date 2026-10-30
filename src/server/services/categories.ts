import "server-only";
import { prisma } from "@/server/db";
import { assertPermission, type CurrentUser } from "@/server/auth/session";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logAudit } from "@/server/services/audit";
import { slugify } from "@/lib/slug";
import type { CategoryInput } from "@/lib/validation/catalog";

/** Todas as categorias (ativas primeiro, pela ordem definida), com nº de artigos. */
export async function listCategories(user: CurrentUser) {
  assertPermission(user, "category:manage");
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { articles: { where: { archivedAt: null } } } } },
  });
  return {
    active: categories.filter((c) => !c.archivedAt),
    archived: categories.filter((c) => c.archivedAt),
  };
}

/** Categorias ativas para listas de escolha e filtros. */
export async function listCategoryOptions(user: CurrentUser) {
  assertPermission(user, "article:view");
  return prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, skuPrefix: true },
  });
}

async function assertUnique(input: CategoryInput, exceptId?: string) {
  const slug = slugify(input.name);
  const clash = await prisma.category.findFirst({
    where: {
      OR: [{ slug }, { name: { equals: input.name, mode: "insensitive" } }, { skuPrefix: input.skuPrefix }],
      NOT: exceptId ? { id: exceptId } : undefined,
    },
    select: { name: true, skuPrefix: true },
  });
  if (clash) {
    throw new ConflictError(
      clash.skuPrefix === input.skuPrefix
        ? `O prefixo ${input.skuPrefix} já é usado pela categoria "${clash.name}".`
        : `Já existe uma categoria chamada "${clash.name}".`,
    );
  }
  return slug;
}

export async function createCategory(user: CurrentUser, input: CategoryInput) {
  assertPermission(user, "category:manage");
  const slug = await assertUnique(input);
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { ...input, slug, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await logAudit(
      { actorId: user.id, action: "category.create", entity: "Category", entityId: category.id, after: input },
      tx,
    );
    return category;
  });
}

async function getCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw new NotFoundError("Categoria não encontrada.");
  return category;
}

export async function updateCategory(user: CurrentUser, id: string, input: CategoryInput) {
  assertPermission(user, "category:manage");
  const before = await getCategory(id);
  if (before.archivedAt) throw new ConflictError("A categoria está arquivada. Restaure-a antes de a alterar.");
  const slug = await assertUnique(input, id);

  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { ...input, slug } });
    await logAudit(
      {
        actorId: user.id,
        action: "category.update",
        entity: "Category",
        entityId: id,
        before: {
          name: before.name,
          skuPrefix: before.skuPrefix,
          description: before.description,
          prepBufferDays: before.prepBufferDays,
        },
        after: input,
      },
      tx,
    );
  });
}

/** Troca a posição com a categoria ativa vizinha (para cima ou para baixo). */
export async function moveCategory(user: CurrentUser, id: string, direction: "up" | "down") {
  assertPermission(user, "category:manage");
  const list = await prisma.category.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  const index = list.findIndex((c) => c.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= list.length) return;

  const reordered = [...list];
  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
  await prisma.$transaction(
    reordered.map((c, i) => prisma.category.update({ where: { id: c.id }, data: { sortOrder: i } })),
  );
}

/** Só se arquiva uma categoria sem artigos ativos (evita artigos "órfãos" nas listas). */
export async function archiveCategory(user: CurrentUser, id: string) {
  assertPermission(user, "category:manage");
  const category = await getCategory(id);
  const articles = await prisma.article.count({ where: { categoryId: id, archivedAt: null } });
  if (articles > 0) {
    throw new ConflictError(
      `A categoria tem ${articles} ${articles === 1 ? "artigo" : "artigos"}. Mova-os para outra categoria ou arquive-os primeiro.`,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { archivedAt: new Date() } });
    await logAudit(
      { actorId: user.id, action: "category.archive", entity: "Category", entityId: id, after: { name: category.name } },
      tx,
    );
  });
}

export async function restoreCategory(user: CurrentUser, id: string) {
  assertPermission(user, "category:manage");
  const category = await getCategory(id);
  const last = await prisma.category.aggregate({ where: { archivedAt: null }, _max: { sortOrder: true } });
  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: { archivedAt: null, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await logAudit(
      { actorId: user.id, action: "category.restore", entity: "Category", entityId: id, after: { name: category.name } },
      tx,
    );
  });
}
