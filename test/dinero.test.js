// ============================================================================
//  Pruebas de las reglas del dinero, del reparto por peso y del canje.
//
//  Esta lógica vive en el <script> de public/index.html, así que se carga ese
//  archivo en un contexto aislado y se ejercita tal cual. Si alguien cambia
//  una fórmula sin querer, estas pruebas lo pillan.
//
//  Las reglas (documentadas en CASA-traspaso-desarrollo.md §2.2):
//    ratio >= 0.75  -> cobra la paga fija
//    ratio == 1.00  -> además desbloquea el dinero de las adicionales
//    ratio <  0.75  -> pierde la paga fija
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { cargarCliente } = require("./_cliente");

const { ejec, ponerEstado, leerEstado } = cargarCliente();

const IRENE = "irene-uuid", LEO = "leo-uuid", MIA = "mia-uuid";

// dias marcados por cada una de las 3 tareas diarias; semanal aparte.
function estado({ anaDias = 0, semanalAna = "pending", extras = [], rewards = [], redemptions = [] } = {}) {
  const marcar = (n) => {
    const d = [false, false, false, false, false, false, false];
    for (let i = 0; i < n; i++) d[i] = true;
    return d;
  };
  return {
    currentMonth: "2026-08", currentWeek: "2026-W33",
    rate: 0.05, fixedPay: 8,
    members: [
      { id: IRENE, name: "Irene", role: "child", color: "#e0588f", load: "normal" },
      { id: LEO, name: "Leo", role: "child", color: "#2f9fd0", load: "reducida" },
      { id: MIA, name: "Mía", role: "child", color: "#2fae73", load: "minima" },
    ],
    fixedTasks: [
      { id: "f1", name: "Cama", icon: "🛏️", freq: "daily" },
      { id: "f2", name: "Plato", icon: "🍽️", freq: "daily" },
      { id: "f3", name: "Mochila", icon: "🎒", freq: "daily" },
      { id: "f4", name: "Lavadora", icon: "🧺", freq: "weekly" },
    ],
    extraTasks: [
      { id: "e1", name: "Baño", points: 40, icon: "🛁" },
      { id: "e2", name: "Aspirar", points: 25, icon: "🧹" },
      { id: "e3", name: "Lavadora", points: 20, icon: "🧺" },
      { id: "e4", name: "Basura", points: 10, icon: "🗑️" },
      { id: "e5", name: "Perro", points: 15, icon: "🐕" },
    ],
    fixedState: {
      [IRENE]: { f1: { days: marcar(anaDias) }, f2: { days: marcar(anaDias) }, f3: { days: marcar(anaDias) }, f4: { status: semanalAna } },
      [LEO]: { f1: { days: marcar(0) }, f2: { days: marcar(0) }, f3: { days: marcar(0) }, f4: { status: "pending" } },
      [MIA]: { f1: { days: marcar(0) }, f2: { days: marcar(0) }, f3: { days: marcar(0) }, f4: { status: "pending" } },
    },
    extras, generated: true, monthPoints: {}, streak: {}, streakCarry: {}, history: {},
    dishes: [], menu: {}, rewards, redemptions,
    listings: [], offers: [], marketLog: [],
  };
}

// ---------------------------------------------------------------------------
//  Regla del dinero: 3 diarias x 7 + 1 semanal = 22 unidades
// ---------------------------------------------------------------------------
test("por debajo del 75% se pierde la paga fija", () => {
  ponerEstado(estado({ anaDias: 5 }));            // 15/22 = 68%
  const m = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.ok(m.ratio < 0.75);
  assert.equal(m.fixedEarned, 0, "no cobra la fija");
  assert.equal(m.canExtra, false);
  assert.equal(m.total, 0);
});

test("a partir del 75% se cobra la paga fija", () => {
  ponerEstado(estado({ anaDias: 6, semanalAna: "pending" })); // 18/22 = 82%
  const m = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.ok(m.ratio >= 0.75 && m.ratio < 1);
  assert.equal(m.fixedEarned, 8, "cobra la fija entera");
  assert.equal(m.canExtra, false, "pero las adicionales siguen bloqueadas");
});

test("justo en el 75% ya cobra (el límite es inclusivo)", () => {
  // 17/22 = 77%; con 16/22 = 72% no llegaría
  ponerEstado(estado({ anaDias: 6 }));
  const m18 = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.equal(m18.fixedEarned, 8);
  ponerEstado(estado({ anaDias: 5, semanalAna: "approved" }));  // 16/22 = 72%
  const m16 = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.ok(m16.ratio < 0.75);
  assert.equal(m16.fixedEarned, 0);
});

test("al 100% se desbloquea el dinero de las adicionales", () => {
  ponerEstado(estado({
    anaDias: 7, semanalAna: "approved",                       // 22/22
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false }],
  }));
  const m = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.equal(m.ratio, 1);
  assert.equal(m.canExtra, true);
  assert.equal(m.extraEarned, 2, "40 puntos x 0,05 EUR = 2 EUR");
  assert.equal(m.total, 10, "8 de fija + 2 de extra");
});

test("sin el 100% las adicionales aprobadas no pagan", () => {
  ponerEstado(estado({
    anaDias: 6, semanalAna: "approved",                       // 19/22 = 86%
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false }],
  }));
  const m = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.equal(m.canExtra, false);
  assert.equal(m.extraEarned, 0, "el esfuerzo cuenta para puntos, no para dinero");
  assert.equal(m.total, 8);
});

test("solo pagan las adicionales APROBADAS, no las enviadas", () => {
  ponerEstado(estado({
    anaDias: 7, semanalAna: "approved",
    extras: [
      { id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false },
      { id: "x2", taskId: "e2", memberId: IRENE, status: "submitted", listed: false },
    ],
  }));
  const m = JSON.parse(ejec(`JSON.stringify(money("${IRENE}"))`));
  assert.equal(m.extraEarned, 2, "solo cuentan los 40 puntos aprobados");
});

// ---------------------------------------------------------------------------
//  Puntos y nivel
// ---------------------------------------------------------------------------
test("los puntos del mes suman fijas x2 mas adicionales aprobadas", () => {
  ponerEstado(estado({
    anaDias: 7, semanalAna: "approved",                       // 22 unidades x2 = 44
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false }], // +40
  }));
  assert.equal(ejec(`monthPoints("${IRENE}")`), 84);
});

test("las primas del mercado mueven puntos entre hermanos", () => {
  ponerEstado(estado({
    anaDias: 0,
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false,
               bounty: { points: 10, from: LEO, to: IRENE } }],
  }));
  assert.equal(ejec(`monthPoints("${IRENE}")`), 50, "40 de la tarea + 10 de prima");
  assert.equal(ejec(`monthPoints("${LEO}")`), 0, "no baja de cero");
});

test("la prima no cuenta si la tarea no está aprobada", () => {
  ponerEstado(estado({
    anaDias: 0,
    extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "submitted", listed: false,
               bounty: { points: 10, from: LEO, to: IRENE } }],
  }));
  assert.equal(ejec(`monthPoints("${IRENE}")`), 0, "sin trabajo hecho no hay prima");
});

test("el nivel sube cada 100 puntos", () => {
  ponerEstado(estado({ anaDias: 0 }));
  assert.equal(JSON.parse(ejec(`JSON.stringify(levelOf("${IRENE}"))`)).level, 1);
  ponerEstado(estado({
    anaDias: 7, semanalAna: "approved",
    extras: [
      { id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false },
      { id: "x2", taskId: "e2", memberId: IRENE, status: "approved", listed: false },
    ],
  })); // 44 + 40 + 25 = 109
  const lv = JSON.parse(ejec(`JSON.stringify(levelOf("${IRENE}"))`));
  assert.equal(lv.points, 109);
  assert.equal(lv.level, 2);
  assert.equal(lv.into, 9);
});

// ---------------------------------------------------------------------------
//  Reparto por peso (LPT)
// ---------------------------------------------------------------------------
test("el reparto asigna todas las tareas y reparte el peso, no el número", () => {
  ponerEstado(estado({}));
  ejec("generateMonth()");
  const S = leerEstado();

  assert.equal(S.extras.length, 5, "se reparten las 5 del catálogo");
  const puntosDe = (id) => S.extras.filter((x) => x.memberId === id)
    .reduce((s, x) => s + S.extraTasks.find((t) => t.id === x.taskId).points, 0);
  const total = puntosDe(IRENE) + puntosDe(LEO) + puntosDe(MIA);
  assert.equal(total, 110, "40+25+20+10+15");

  // Disponibilidad: normal=1, reducida=0.6, minima=0.3 -> Irene debe cargar más
  assert.ok(puntosDe(IRENE) >= puntosDe(LEO), "Irene (normal) carga al menos como Leo (reducida)");
  assert.ok(puntosDe(LEO) >= puntosDe(MIA), "Leo (reducida) al menos como Mía (mínima)");
});

test("el reparto deja todas las asignaciones pendientes y sin dueño repetido", () => {
  ponerEstado(estado({}));
  ejec("generateMonth()");
  const S = leerEstado();
  assert.ok(S.extras.every((x) => x.status === "pending"));
  const ids = S.extras.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "no hay ids repetidos");
  const tareas = S.extras.map((x) => x.taskId);
  assert.equal(new Set(tareas).size, tareas.length, "cada tarea se asigna una vez");
});

// ---------------------------------------------------------------------------
//  Canje de premios
// ---------------------------------------------------------------------------
const PREMIOS = [
  { id: "r1", title: "Peli", cost: 40, type: "Privilegio", stock: 1, active: true },
  { id: "r2", title: "Pantalla", cost: 60, type: "Tiempo", stock: null, active: true },
  { id: "r3", title: "Retirado", cost: 10, type: "Otro", stock: null, active: false },
];
// Irene con 84 puntos
const estadoConPuntos = (redemptions) => estado({
  anaDias: 7, semanalAna: "approved",
  extras: [{ id: "x1", taskId: "e1", memberId: IRENE, status: "approved", listed: false }],
  rewards: PREMIOS, redemptions,
});

test("una solicitud pendiente reserva los puntos", () => {
  ponerEstado(estadoConPuntos([
    { id: "c1", rewardId: "r1", childId: IRENE, cost: 40, status: "pending", at: 1, resolvedAt: 0 },
  ]));
  assert.equal(ejec(`monthPoints("${IRENE}")`), 84);
  assert.equal(ejec(`pointsCommitted("${IRENE}")`), 40);
  assert.equal(ejec(`pointsAvailable("${IRENE}")`), 44, "no puede gastar lo ya pedido");
});

test("una solicitud denegada devuelve los puntos", () => {
  ponerEstado(estadoConPuntos([
    { id: "c1", rewardId: "r1", childId: IRENE, cost: 40, status: "denied", at: 1, resolvedAt: 2 },
  ]));
  assert.equal(ejec(`pointsAvailable("${IRENE}")`), 84);
});

test("una solicitud concedida mantiene el gasto", () => {
  ponerEstado(estadoConPuntos([
    { id: "c1", rewardId: "r1", childId: IRENE, cost: 40, status: "approved", at: 1, resolvedAt: 2 },
  ]));
  assert.equal(ejec(`pointsAvailable("${IRENE}")`), 44, "el punto gastado no vuelve");
});

test("no se pueden gastar los mismos puntos dos veces", () => {
  ponerEstado(estadoConPuntos([]));                    // 84 libres
  ejec(`S.profile="${IRENE}"; doRedeem("r2")`);          // premio de 60
  assert.equal(ejec(`pointsAvailable("${IRENE}")`), 24);
  ejec(`doRedeem("r2")`);                              // no le llegan: 24 < 60
  assert.equal(leerEstado().redemptions.length, 1, "la segunda no se crea");
});

test("el stock se agota al conceder", () => {
  ponerEstado(estadoConPuntos([
    { id: "c1", rewardId: "r1", childId: IRENE, cost: 40, status: "pending", at: 1, resolvedAt: 0 },
  ]));
  assert.equal(ejec(`rewardStockLeft(rewardById("r1"))`), 1);
  ejec(`resolveRedeem("c1","approved")`);
  assert.equal(ejec(`rewardStockLeft(rewardById("r1"))`), 0);
  assert.equal(ejec(`rewardAvailable(rewardById("r1"))`), false, "ya no se puede pedir");
});

test("un premio desactivado no aparece como disponible", () => {
  ponerEstado(estadoConPuntos([]));
  assert.equal(ejec(`rewardAvailable(rewardById("r3"))`), false);
  assert.equal(ejec(`rewardAvailable(rewardById("r2"))`), true);
});

test("un premio sin stock definido es ilimitado", () => {
  ponerEstado(estadoConPuntos([]));
  assert.equal(ejec(`rewardStockLeft(rewardById("r2"))`), Infinity);
});

test("rewardById no revienta con un premio borrado", () => {
  ponerEstado(estadoConPuntos([]));
  assert.equal(ejec(`rewardById("no-existe").title`), "(premio eliminado)");
});
