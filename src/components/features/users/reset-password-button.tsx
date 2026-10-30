"use client";

import { useState } from "react";
import { KeyRound, Wand2 } from "lucide-react";
import { resetUserPasswordAction } from "@/server/actions/users";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { generateTemporaryPassword } from "@/lib/user-rules";
import { PASSWORD_MIN } from "@/lib/validation/users";

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setPassword(generateTemporaryPassword());
          setOpen(true);
        }}
      >
        <KeyRound className="size-4" /> Repor palavra-passe
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Repor palavra-passe"
        description={`${userName} terá de a alterar no próximo login. As sessões abertas desta conta serão terminadas.`}
      >
        <ActionForm action={resetUserPasswordAction.bind(null, userId)} onSuccess={() => setOpen(false)} className="space-y-5">
          {({ errors: e, pending }) => (
            <>
              <Field
                label="Palavra-passe temporária"
                htmlFor="reset-password"
                errors={e.password}
                hint={`Pelo menos ${PASSWORD_MIN} caracteres. Copie-a antes de confirmar.`}
              >
                <div className="flex gap-2">
                  <Input
                    id="reset-password"
                    name="password"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    invalid={!!e.password}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                  <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={() => setPassword(generateTemporaryPassword())}>
                    <Wand2 className="size-4" /> Gerar
                  </Button>
                </div>
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" loading={pending}>
                  Repor palavra-passe
                </Button>
              </div>
            </>
          )}
        </ActionForm>
      </Dialog>
    </>
  );
}
