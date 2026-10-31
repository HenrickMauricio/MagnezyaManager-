"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { INVALID_FIELDS, toActionError, type ActionResult } from "@/server/errors";
import { lineAvailability } from "@/server/services/availability";
import * as rentals from "@/server/services/rentals";
import { fieldErrorsOf, formToObject } from "@/lib/validation/common";
import { dateOnlyToISO, todayISO } from "@/lib/format";
import {
  RENTAL_STATUSES,
  deliverySchema,
  rentalSchema,
  returnSchema,
  type RentalStatus,
} from "@/lib/validation/rentals";

function revalidateRentals(id?: string) {
  revalidatePath("/reservas");
  if (id) revalidatePath(`/reservas/${id}`);
  revalidatePath("/disponibilidade");
  revalidatePath("/calendario");
  revalidatePath("/painel");
}

export async function createRentalAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = rentalSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    const rental = await rentals.createRental(user, parsed.data);
    revalidateRentals();
    return { ok: true, message: `Reserva ${rental.number} criada.`, redirectTo: `/reservas/${rental.id}` };
  } catch (err) {
    return toActionError(err);
  }
}

const checkSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(z.object({ articleId: z.string().min(1), quantity: z.number().int().min(1).max(100_000) })).max(200),
});

export type LineCheck = { articleId: string; available: number; date: string };

/**
 * Disponibilidade em tempo real para o formulário de reserva: para cada artigo,
 * o mínimo disponível no período em que a linha ocupa stock.
 */
export async function checkAvailabilityAction(input: z.input<typeof checkSchema>): Promise<LineCheck[] | null> {
  await requirePermission("availability:view");
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success || parsed.data.returnDate < parsed.data.deliveryDate) return null;
  const { deliveryDate, returnDate, lines } = parsed.data;
  const result = await lineAvailability(prisma, lines.map((l) => l.articleId), deliveryDate, returnDate);
  return result.map((a) => ({ articleId: a.articleId, available: a.minAvailable, date: a.minDate }));
}

export async function startPreparationAction(id: string): Promise<ActionResult> {
  try {
    await rentals.startPreparation(await requireUser(), id);
    revalidateRentals(id);
    return { ok: true, message: "Reserva em preparação." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function markDeliveredAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = deliverySchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await rentals.markDelivered(user, id, parsed.data.date);
    revalidateRentals(id);
    return { ok: true, message: "Entrega registada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function registerReturnAction(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = returnSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, error: INVALID_FIELDS, fieldErrors: fieldErrorsOf(parsed.error) };
    await rentals.registerReturn(user, id, parsed.data);
    revalidateRentals(id);
    revalidatePath("/inventario");
    return { ok: true, message: "Devolução registada." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelRentalAction(id: string): Promise<ActionResult> {
  try {
    await rentals.cancelRental(await requireUser(), id);
    revalidateRentals(id);
    return { ok: true, message: "Reserva cancelada; o stock foi libertado." };
  } catch (err) {
    return toActionError(err);
  }
}

const calendarSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statuses: z.array(z.enum(Object.keys(RENTAL_STATUSES) as [RentalStatus, ...RentalStatus[]])).max(10),
});

export type CalendarRental = {
  id: string;
  number: string;
  status: RentalStatus;
  deliveryDate: string;
  returnDate: string;
  /** Material ainda com o cliente depois da recolha prevista. */
  overdue: boolean;
  /** Último dia a mostrar: a recolha prevista, ou hoje se estiver em atraso. */
  displayEnd: string;
  client: string;
  event: string;
  city: string | null;
};

/** Reservas que tocam o intervalo visível do calendário. */
export async function calendarRentalsAction(input: z.input<typeof calendarSchema>): Promise<CalendarRental[]> {
  const user = await requirePermission("calendar:view");
  const { from, to, statuses } = calendarSchema.parse(input);
  const rows = await rentals.listCalendarRentals(user, from, to, statuses);
  const today = todayISO();
  return rows.map((r) => {
    const returnDate = dateOnlyToISO(r.returnDate);
    const overdue = (r.status === "ENTREGUE" || r.status === "EM_DEVOLUCAO") && returnDate < today;
    return {
      id: r.id,
      number: r.number,
      status: r.status as RentalStatus,
      deliveryDate: dateOnlyToISO(r.deliveryDate),
      returnDate,
      overdue,
      displayEnd: overdue ? today : returnDate,
      client: r.client.name,
      event: r.event.name,
      city: r.event.city,
    };
  });
}

export async function confirmConflictAction(id: string): Promise<ActionResult> {
  try {
    await rentals.confirmConflict(await requireUser(), id);
    revalidateRentals(id);
    return { ok: true, message: "Stock confirmado: a reserva passou a Reservado." };
  } catch (err) {
    return toActionError(err);
  }
}
