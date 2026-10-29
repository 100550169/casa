// ============================================================================
//  Pruebas del cierre de mes: vencimientos automáticos y archivo del historial.
//
//  Antes se archivaba state.monthPoints, un campo que nadie escribía nunca:
//  el historial guardaba ceros y la comparación "mes anterior" del hijo salía
//  siempre a 0. Ahora se calculan de verdad en el servidor.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { puntosDelMes, unidadesFijas, resumenDelMes } = require("../services/puntos");

const IRENE = "irene-uuid", LEO = "leo-uuid";

function estado({ diasAna = 0, semanalAna = "pending", extras = [] } = {}) {
  const marcar = (n) => {
    const d = [false, false, false, false, false, false, false];
    for (let i = 0; i < n; i++) d[i] = true;
    return d;
  };
  return {
    members: [
      { id: IRENE, name: "Irene", role: "child", color: "#e0588f", load: "normal" },
      { id: LEO, name: "Leo", role: "child", color: "#2f9fd0", load: "normal" },
    ],
    fixedTasks: [
      { id: "f1", name: "Cama", icon: "🛏️", freq: "daily" },
      { id: "f2", name: "Lavadora", icon: "🧺", freq: "weekly" },
    ],
    extraTasks: [
      { id: "e1", name: "Baño", points: 40, icon: "🛁" },
      { id: "e2", name: "Basura", points: 10, icon: "🗑️" },
    ],
    fixedState: {
      [IRENE]: { f1: { days: marcar(diasAna) }, f2: { status: semanalAna } },
      [LEO]: { f1: { days: marcar(0) }, f2: { status: "pending" } },
    },
    extras,
    monthPoints: {}, streak: {}, history: {},
  };
}

test("las unidades de fijas cuentan días marcados y semanales aprobadas", () => {
  const s = estado({ diasAna: 5, semanalAna: "approved" });
  assert.equal(unidadesFijas(s, IRENE), 6, "5 días + 1 semanal");
});

test("una semanal sin aprobar no suma", () => {
  const s = estado({ diasAna: 5, semanalAna: "submitted" });
  assert.equal(unidadesFijas(s, IRENE), 5);
});

test("los puntos del mes salen de fijas x2 mas adicionales aprobadas", () => {
  const s = estado({
    diasAna: 7, semanalAna: "approved",                     // 8 unidades -> 16
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved" }],  // +40
  });
  assert.equal(puntosDelMes(s, IRENE), 56);
});

test("solo cuentan las adicionales aprobadas", () => {
  const s = estado({
    extras: [
      { id: "x1", taskId: "e1", memberId: IRENE, status: "submitted" },
      { id: "x2", taskId: "e2", memberId: IRENE, status: "late" },
    ],
  });
  assert.equal(puntosDelMes(s, IRENE), 0);
});

test("las primas del mercado se restan a quien las paga", () => {
  const s = estado({
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved",
               bounty: { points: 10, from: LEO, to: IRENE } }],
  });
  assert.equal(puntosDelMes(s, IRENE), 50, "40 de la tarea + 10 de prima");
  assert.equal(puntosDelMes(s, LEO), 0, "no baja de cero");
});

test("el resumen del mes ya NO archiva ceros", () => {
  const s = estado({
    diasAna: 7, semanalAna: "approved",
    extras: [
      { id: "x1", taskId: "e1", memberId: IRENE, status: "approved" },
      { id: "x2", taskId: "e2", memberId: IRENE, status: "late" },
    ],
  });
  const r = resumenDelMes(s);

  assert.equal(r.points[IRENE], 56, "guarda los puntos de verdad");
  assert.equal(r.hechas[IRENE], 1);
  assert.equal(r.vencidas[IRENE], 1);
  assert.equal(r.points[LEO], 0, "Leo no hizo nada");
});

test("el resumen incluye a todos los hijos y solo a los hijos", () => {
  const s = estado({});
  s.members.push({ id: "papa", name: "Andrés", role: "parent", color: "#8b6fd6", load: "normal" });
  const r = resumenDelMes(s);
  assert.deepEqual(Object.keys(r.points).sort(), [IRENE, LEO].sort());
});
