/** Erros de domínio com mensagens seguras para mostrar ao utilizador. */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("Sessão expirada. Inicie sessão novamente.", "UNAUTHENTICATED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Não tem permissão para realizar esta operação.") {
    super(message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registo não encontrado.") {
    super(message, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

/** Resultado normalizado das Server Actions (para formulários). */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const INVALID_FIELDS = "Verifique os campos assinalados.";

export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Ocorreu um erro inesperado. Tente novamente." };
}
