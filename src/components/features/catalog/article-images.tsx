"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageIcon, ImagePlus, Star, Trash2 } from "lucide-react";
import {
  deleteImageAction,
  moveImageAction,
  setPrimaryImageAction,
  uploadArticleImageAction,
} from "@/server/actions/catalog";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { fileUrl } from "@/lib/files";

export type ImageView = { id: string; storageKey: string; alt: string | null; isPrimary: boolean };

const MAX_BYTES = 8 * 1024 * 1024;

export function ArticleImages({
  articleId,
  images,
  canEdit,
  maxImages,
}: {
  articleId: string;
  images: ImageView[];
  canEdit: boolean;
  maxImages: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function upload(files: File[]) {
    const room = maxImages - images.length;
    if (files.length > room) {
      toast.error(room > 0 ? `Pode adicionar mais ${room} fotografias.` : `Máximo de ${maxImages} fotografias.`);
      files = files.slice(0, Math.max(0, room));
    }
    let added = 0;
    setProgress({ done: 0, total: files.length });
    // Uma de cada vez: mantém cada pedido abaixo do limite e mostra o progresso.
    for (const [i, file] of files.entries()) {
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" excede 8 MB.`);
      } else {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadArticleImageAction(articleId, fd);
        if (result.ok) added++;
        else toast.error(`${file.name}: ${result.error}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (added) toast.success(added === 1 ? "Fotografia adicionada." : `${added} fotografias adicionadas.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Fotografias"
        description={`Usadas no catálogo e nas propostas. JPEG, PNG, WebP ou HEIC até 8 MB (máx. ${maxImages}).`}
        action={
          canEdit && (
            <>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length) void upload(files);
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                loading={progress !== null}
                disabled={images.length >= maxImages}
                onClick={() => input.current?.click()}
              >
                {progress ? (
                  `A carregar ${progress.done + 1 > progress.total ? progress.total : progress.done + 1} de ${progress.total}…`
                ) : (
                  <>
                    <ImagePlus className="size-4" /> Adicionar
                  </>
                )}
              </Button>
            </>
          )
        }
      />
      {images.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-8" strokeWidth={1.5} />}
          title="Sem fotografias"
          description={canEdit ? "Adicione fotografias do artigo; a primeira passa a ser a principal." : undefined}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="group overflow-hidden rounded-md border border-border bg-surface-2">
              <a href={fileUrl(img.storageKey)} target="_blank" rel="noreferrer" className="relative block aspect-[4/3]">
                {/* Imagens servidas por rota autenticada e já otimizadas no upload. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(img.storageKey, "thumb")}
                  alt={img.alt ?? ""}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                {img.isPrimary && (
                  <Badge tone="solid" className="absolute left-2 top-2">
                    <Star className="size-3" fill="currentColor" /> Principal
                  </Badge>
                )}
              </a>
              {canEdit && (
                <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
                  <div className="flex">
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      disabled={i === 0}
                      aria-label="Mover para a esquerda"
                      action={moveImageAction.bind(null, articleId, img.id, "left")}
                    >
                      <ChevronLeft className="size-4" />
                    </ActionButton>
                    <ActionButton
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      disabled={i === images.length - 1}
                      aria-label="Mover para a direita"
                      action={moveImageAction.bind(null, articleId, img.id, "right")}
                    >
                      <ChevronRight className="size-4" />
                    </ActionButton>
                  </div>
                  <div className="flex">
                    {!img.isPrimary && (
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        aria-label="Tornar principal"
                        title="Tornar principal"
                        action={setPrimaryImageAction.bind(null, articleId, img.id)}
                      >
                        <Star className="size-4" />
                      </ActionButton>
                    )}
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label="Eliminar fotografia"
                      title="Eliminar fotografia?"
                      description="A fotografia é removida do artigo. Propostas já emitidas não são afetadas."
                      confirmLabel="Eliminar"
                      action={deleteImageAction.bind(null, articleId, img.id)}
                    >
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
