import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { RentalCalendar } from "@/components/features/rentals/rental-calendar";
import { PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarPage() {
  const user = await requirePagePermission("calendar:view");
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Calendário" description="Reservas da entrega à recolha. Clique numa reserva para abrir a ficha." />
      <RentalCalendar canOpen={user.permissions.has("rental:view")} />
    </div>
  );
}
