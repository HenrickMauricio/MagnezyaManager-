"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { removeLogoAction, uploadLogoAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { fileUrl } from "@/lib/files";

export function LogoCard({ logoKey, brandName }: { logoKey: string | null; brandName: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadLogoAction(fd);
      if (result.ok) toast.success(result.message ?? "Logótipo atualizado.");
      else toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Logótipo"
        description="Usado no PDF das propostas. PNG com fundo transparente dá melhor resultado."
        action={
          <div className="flex gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button size="sm" variant="secondary" loading={pending} onClick={() => input.current?.click()}>
              <ImagePlus className="size-4" /> {logoKey ? "Substituir" : "Carregar"}
            </Button>
            {logoKey && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                title="Remover logótipo?"
                description="As novas propostas passam a mostrar o nome da empresa em texto. PDFs já emitidos não mudam."
                confirmLabel="Remover"
                action={removeLogoAction}
              >
                Remover
              </ConfirmButton>
            )}
          </div>
        }
      />
      <div className="flex min-h-32 items-center justify-center p-6">
        {logoKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(logoKey)} alt={`Logótipo ${brandName}`} className="max-h-24 max-w-full object-contain" />
        ) : (
          <span className="font-display text-[22px] font-bold uppercase tracking-[0.22em] text-fg-subtle">{brandName}</span>
        )}
      </div>
    </Card>
  );
}
