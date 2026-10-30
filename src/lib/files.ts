/** Chave da miniatura a partir da chave da imagem grande. */
export function thumbKey(storageKey: string): string {
  return storageKey.replace(/\.webp$/, "-thumb.webp");
}

/** URL de um ficheiro guardado (servido por /api/ficheiros, com verificação de sessão). */
export function fileUrl(storageKey: string, variant: "full" | "thumb" = "full"): string {
  return `/api/ficheiros/${variant === "thumb" ? thumbKey(storageKey) : storageKey}`;
}

/** Chave nova para uma fotografia de artigo (nome aleatório: o conteúdo nunca muda). */
export function newArticleImageKey(articleId: string): string {
  return `articles/${articleId.toLowerCase()}/${crypto.randomUUID()}.webp`;
}
