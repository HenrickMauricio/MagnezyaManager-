import "server-only";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/server/errors";

/** Converte NotFoundError dos serviços na página 404 do Next.js. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}
