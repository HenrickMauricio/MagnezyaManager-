import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailyAvailability,
  eachDay,
  rentalOccupancy,
  summarize,
  type Occupancy,
  type RentalLine,
} from "../../src/lib/availability";

const line = (over: Partial<RentalLine>): RentalLine => ({
  rentalId: "r1",
  status: "RESERVADO",
  quantity: 10,
  prepBufferDays: 0,
  deliveryDate: "2026-11-10",
  returnDate: "2026-11-15",
  returns: [],
  ...over,
});

const at = (days: ReturnType<typeof dailyAvailability>, date: string) => days.find((d) => d.date === date)!;

test("exemplo do enunciado: 100 cadeiras, 30 de 10 a 15/11 e 40 de 12 a 18/11", () => {
  const occupancies = [
    ...rentalOccupancy(line({ rentalId: "a", quantity: 30, deliveryDate: "2026-11-10", returnDate: "2026-11-15" }), "2026-11-01"),
    ...rentalOccupancy(line({ rentalId: "b", quantity: 40, deliveryDate: "2026-11-12", returnDate: "2026-11-18" }), "2026-11-01"),
  ];
  const days = dailyAvailability(100, [], occupancies, "2026-11-09", "2026-11-19");
  assert.equal(at(days, "2026-11-13").available, 30);
  assert.equal(at(days, "2026-11-16").available, 60);
  assert.equal(at(days, "2026-11-09").available, 100);
  assert.equal(at(days, "2026-11-19").available, 100);

  // Disponível no período 13–16/11 = mínimo dos dias = 30 (a 13/11).
  const period = summarize(dailyAvailability(100, [], occupancies, "2026-11-13", "2026-11-16"));
  assert.deepEqual([period.minAvailable, period.minDate, period.maxReserved], [30, "2026-11-13", 70]);
});

test("dias de preparação prolongam a ocupação depois da recolha", () => {
  const occ = rentalOccupancy(line({ prepBufferDays: 2 }), "2026-11-01");
  const days = dailyAvailability(10, [], occ, "2026-11-15", "2026-11-18");
  assert.deepEqual(days.map((d) => d.available), [0, 0, 0, 10]);
});

test("reserva cancelada não ocupa stock", () => {
  assert.deepEqual(rentalOccupancy(line({ status: "CANCELADO" }), "2026-11-01"), []);
});

test("devolução parcial: só as unidades por devolver continuam ocupadas", () => {
  const occ = rentalOccupancy(
    line({ status: "EM_DEVOLUCAO", quantity: 10, prepBufferDays: 1, returns: [{ date: "2026-11-12", returned: 6, damaged: 0 }] }),
    "2026-11-12",
  );
  const days = dailyAvailability(10, [], occ, "2026-11-12", "2026-11-17");
  // 6 devolvidas a 12/11 ficam ocupadas até 13/11 (1 dia de preparação); as 4 restantes até 16/11.
  assert.deepEqual(days.map((d) => d.available), [0, 0, 6, 6, 6, 10]);
});

test("unidades devolvidas danificadas passam para a manutenção sem contar a dobrar", () => {
  const occ: Occupancy[] = [
    ...rentalOccupancy(
      line({ status: "DEVOLVIDO", quantity: 10, returns: [{ date: "2026-11-15", returned: 10, damaged: 2 }] }),
      "2026-11-15",
    ),
    { start: "2026-11-15", end: null, quantity: 2, kind: "maintenance" },
  ];
  const d = at(dailyAvailability(10, [], occ, "2026-11-14", "2026-11-16"), "2026-11-15");
  assert.equal(d.reserved, 8);
  assert.equal(d.maintenance, 2);
  assert.equal(d.available, 0);
  assert.equal(at(dailyAvailability(10, [], occ, "2026-11-14", "2026-11-16"), "2026-11-16").available, 8);
});

test("atraso: material entregue e não devolvido ocupa até hoje + projeção", () => {
  const delivered = line({ status: "ENTREGUE", returnDate: "2026-11-15", prepBufferDays: 1 });
  const occ = rentalOccupancy(delivered, "2026-11-20");
  // Hoje 20/11 + 1 dia de projeção + 1 de preparação = 22/11.
  assert.equal(occ[0]!.end, "2026-11-22");
  // Sem atraso, termina na recolha + preparação.
  assert.equal(rentalOccupancy(delivered, "2026-11-14")[0]!.end, "2026-11-16");
  // Reserva não entregue não se prolonga (não está com o cliente).
  assert.equal(rentalOccupancy(line({ returnDate: "2026-11-15" }), "2026-11-20")[0]!.end, "2026-11-15");
});

test("disponibilidade conta movimentos e manutenção", () => {
  const days = dailyAvailability(
    20,
    [{ date: "2026-11-12", quantity: 5 }],
    [{ start: "2026-11-11", end: "2026-11-12", quantity: 3, kind: "maintenance" }],
    "2026-11-10",
    "2026-11-13",
  );
  assert.deepEqual(days.map((d) => d.available), [20, 17, 22, 25]);
});

test("sobre-reserva aparece como disponível negativo (conflito)", () => {
  const occ = rentalOccupancy(line({ quantity: 12, status: "CONFLITO_STOCK" }), "2026-11-01");
  assert.equal(summarize(dailyAvailability(10, [], occ, "2026-11-10", "2026-11-15")).minAvailable, -2);
});

test("período de dias inclusivo, atravessando meses", () => {
  assert.deepEqual(eachDay("2026-11-29", "2026-12-02"), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  assert.deepEqual(eachDay("2026-11-02", "2026-11-01"), []);
});
