"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import * as articles from "@/server/services/articles";
import * as categories from "@/server/services/categories";
import { MAX_IMAGE_BYTES } from "@/server/services/images";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { categorySchema, createArticleSchema, updateArticleSchema } from "@/lib/validation/catalog";

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategoryAction(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = categorySchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    if (id) await categories.updateCategory(user, id, parsed.data);
    else await categories.createCategory(user, parsed.data);
    revalidatePath("/categorias");
    return { ok: true, message: id ? "Categoria atualizada." : "Categoria criada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await categories.moveCategory(await requireUser(), id, direction);
    revalidatePath("/categorias");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveCategoryAction(id: string): Promise<ActionResult> {
  try {
    await categories.archiveCategory(await requireUser(), id);
    revalidatePath("/categorias");
    return { ok: true, message: "Categoria arquivada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function restoreCategoryAction(id: string): Promise<ActionResult> {
  try {
    await categories.restoreCategory(await requireUser(), id);
    revalidatePath("/categorias");
    return { ok: true, message: "Categoria restaurada." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------------

export async function createArticleAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = createArticleSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    const article = await articles.createArticle(user, parsed.data);
    revalidatePath("/artigos");
    return { ok: true, message: `Artigo criado (${article.sku}).`, redirectTo: `/artigos/${article.id}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateArticleAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateArticleSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await articles.updateArticle(user, id, parsed.data);
    revalidatePath("/artigos");
    return { ok: true, message: "Alterações guardadas.", redirectTo: `/artigos/${id}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveArticleAction(id: string): Promise<ActionResult> {
  try {
    await articles.archiveArticle(await requireUser(), id);
    revalidatePath("/artigos");
    return { ok: true, message: "Artigo arquivado." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function restoreArticleAction(id: string): Promise<ActionResult> {
  try {
    await articles.restoreArticle(await requireUser(), id);
    revalidatePath("/artigos");
    return { ok: true, message: "Artigo restaurado." };
  } catch (err) {
    return toActionError(err);
  }
}

// ---------------------------------------------------------------------------
// Fotografias
// ---------------------------------------------------------------------------

/** Uma fotografia por pedido (o browser envia-as em sequência). */
export async function uploadArticleImageAction(articleId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma fotografia." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `"${file.name}" excede 8 MB.` };
    await articles.addArticleImage(user, articleId, Buffer.from(await file.arrayBuffer()));
    revalidatePath(`/artigos/${articleId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setPrimaryImageAction(articleId: string, imageId: string): Promise<ActionResult> {
  try {
    await articles.setPrimaryImage(await requireUser(), articleId, imageId);
    revalidatePath(`/artigos/${articleId}`);
    return { ok: true, message: "Fotografia principal definida." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function moveImageAction(
  articleId: string,
  imageId: string,
  direction: "left" | "right",
): Promise<ActionResult> {
  try {
    await articles.moveImage(await requireUser(), articleId, imageId, direction);
    revalidatePath(`/artigos/${articleId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteImageAction(articleId: string, imageId: string): Promise<ActionResult> {
  try {
    await articles.deleteImage(await requireUser(), articleId, imageId);
    revalidatePath(`/artigos/${articleId}`);
    return { ok: true, message: "Fotografia eliminada." };
  } catch (err) {
    return toActionError(err);
  }
}
