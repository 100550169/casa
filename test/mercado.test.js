// ============================================================================
//  Pruebas del mercado entre hermanos.
//
//  El cambio importante: "me la quedo" ya no cierra el trato de golpe. Antes
//  un hermano podía quedarse la tarea de otro sin que este se enterara hasta
//  después; ahora crea una solicitud que el vendedor acepta o rechaza.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { cargarCliente } = require("./_cliente");
const { sanitizeState } = require("../services/stateGuard");

const { ejec, ponerEstado, leerEstado } = cargarCliente();

const IRENE = "irene-uuid", LEO = "leo-uuid";

// Leo publica su tarea e1; Irene tiene la e2 libre para ofrecer a cambio.
function estadoMercado({ pointsOffered = 8, acceptsTrade = true, offers = [] } = {}) {
  return {
    currentMonth: "2026-08", currentWeek: "2026-W33", rate: 0.05, fixedPay: 8,
    members: [
      { id: IRENE, name: "Irene", role: "child", color: "#e0588f", load: "normal" },
      { id: LEO, name: "Leo", role: "child", color: "#2f9fd0", load: "normal" },
    ],
    fixedTasks: [{ id: "f1", name: "Cama", icon: "🛏️", freq: "daily" }],
    extraTasks: [
      { id: "e1", name: "Baño", points: 40, icon: "🛁" },
      { id: "e2", name: "Basura", points: 10, icon: "🗑️" },
    ],
    fixedState: {
      [IRENE]: { f1: { days: [false, false, false, false, false, false, false] } },
      [LEO]: { f1: { days: [false, false, false, false, false, false, false] } },
    },
    extras: [
      { id: "xLeo", taskId: "e1", memberId: LEO, status: "pending", listed: true },
      { id: "xAna", taskId: "e2", memberId: IRENE, status: "pending", listed: false },
    ],
    generated: true, monthPoints: {}, streak: {}, streakCarry: {}, history: {},
    dishes: [], menu: {}, rewards: [], redemptions: [],
    listings: [{
      id: "l1", sellerId: LEO, assignmentId: "xLeo", taskId: "e1",
      pointsOffered, acceptsTrade, note: "", status: "open", createdAt: 1,
    }],
    offers, marketLog: [],
  };
}

test('"me la quedo" ya NO cambia la tarea de dueño al momento', () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${IRENE}"; takeListing("l1","${IRENE}")`);
  const S = leerEstado();

  assert.equal(S.extras.find((x) => x.id === "xLeo").memberId, LEO, "sigue siendo de Leo");
  assert.equal(S.listings[0].status, "open", "el anuncio sigue abierto");
  assert.equal(S.offers.length, 1, "se ha creado una solicitud");
  assert.equal(S.offers[0].kind, "take");
  assert.equal(S.offers[0].status, "pending");
});

test("no se puede pedir dos veces la misma tarea", () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${IRENE}"; takeListing("l1","${IRENE}"); takeListing("l1","${IRENE}")`);
  assert.equal(leerEstado().offers.length, 1);
});

test("el vendedor no puede pedirse su propia tarea", () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${LEO}"; takeListing("l1","${LEO}")`);
  assert.equal(leerEstado().offers.length, 0);
});

test("al aceptar un take, la tarea cambia de dueño y se paga la prima", () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${IRENE}"; takeListing("l1","${IRENE}")`);
  const idOferta = leerEstado().offers[0].id;
  ejec(`S.profile="${LEO}"; acceptOffer("${idOferta}")`);
  const S = leerEstado();

  const tarea = S.extras.find((x) => x.id === "xLeo");
  assert.equal(tarea.memberId, IRENE, "ahora es de Irene");
  assert.equal(tarea.listed, false, "ya no está en venta");
  assert.deepEqual(tarea.bounty, { points: 8, from: LEO, to: IRENE }, "Leo le paga los 8 pts");
  assert.equal(S.listings[0].status, "closed");
  assert.equal(S.offers[0].status, "accepted");
  assert.equal(S.marketLog.length, 1);
  assert.equal(S.marketLog[0].kind, "take");
});

test("al rechazar un take no cambia nada", () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${IRENE}"; takeListing("l1","${IRENE}")`);
  const idOferta = leerEstado().offers[0].id;
  ejec(`S.profile="${LEO}"; rejectOffer("${idOferta}")`);
  const S = leerEstado();

  assert.equal(S.extras.find((x) => x.id === "xLeo").memberId, LEO, "sigue siendo de Leo");
  assert.equal(S.listings[0].status, "open", "puede seguir vendiéndola");
  assert.equal(S.offers[0].status, "rejected");
  assert.equal(S.marketLog.length, 0);
});

test("sin puntos ofrecidos, el take no crea prima", () => {
  ponerEstado(estadoMercado({ pointsOffered: 0 }));
  ejec(`S.profile="${IRENE}"; takeListing("l1","${IRENE}")`);
  const idOferta = leerEstado().offers[0].id;
  ejec(`S.profile="${LEO}"; acceptOffer("${idOferta}")`);
  const tarea = leerEstado().extras.find((x) => x.id === "xLeo");
  assert.equal(tarea.memberId, IRENE);
  assert.equal(tarea.bounty, undefined, "sin puntos no hay prima");
});

test("aceptar una solicitud tumba las demás del mismo anuncio", () => {
  const otra = {
    id: "o-otra", listingId: "l1", bidderId: IRENE, kind: "take",
    offeredAssignmentId: "", offeredTaskId: "", pointsAsked: 0,
    status: "pending", createdAt: 1,
  };
  ponerEstado(estadoMercado({ offers: [otra] }));
  // Un trueque de Irene sobre el mismo anuncio
  ejec(`S.profile="${IRENE}"; S.offers.push({id:"o-trade",listingId:"l1",bidderId:"${IRENE}",kind:"trade",
    offeredAssignmentId:"xAna",offeredTaskId:"e2",pointsAsked:0,status:"pending",createdAt:2})`);
  ejec(`S.profile="${LEO}"; acceptOffer("o-otra")`);
  const S = leerEstado();

  assert.equal(S.offers.find((o) => o.id === "o-otra").status, "accepted");
  assert.equal(S.offers.find((o) => o.id === "o-trade").status, "rejected", "la otra se cae");
});

test("el trueque sigue funcionando igual", () => {
  ponerEstado(estadoMercado());
  ejec(`S.profile="${IRENE}"; S.offers.push({id:"o1",listingId:"l1",bidderId:"${IRENE}",kind:"trade",
    offeredAssignmentId:"xAna",offeredTaskId:"e2",pointsAsked:5,status:"pending",createdAt:1})`);
  ejec(`S.profile="${LEO}"; acceptOffer("o1")`);
  const S = leerEstado();

  assert.equal(S.extras.find((x) => x.id === "xLeo").memberId, IRENE, "la de Leo pasa a Irene");
  assert.equal(S.extras.find((x) => x.id === "xAna").memberId, LEO, "y la de Irene a Leo");
  assert.deepEqual(S.extras.find((x) => x.id === "xLeo").bounty, { points: 5, from: LEO, to: IRENE });
  assert.equal(S.marketLog[0].kind, "trade");
});

test("el saneado del servidor conserva las solicitudes take", () => {
  // Antes exigía tarea ofrecida a TODAS las solicitudes: las take se perdían.
  const s = estadoMercado({
    offers: [{
      id: "o1", listingId: "l1", bidderId: IRENE, kind: "take",
      offeredAssignmentId: "", offeredTaskId: "", pointsAsked: 0,
      status: "pending", createdAt: 1,
    }],
  });
  const out = sanitizeState(s);
  assert.equal(out.offers.length, 1, "la solicitud sobrevive al saneado");
  assert.equal(out.offers[0].kind, "take");
});

test("el saneado deduce el tipo si viene de una versión antigua", () => {
  const s = estadoMercado({
    offers: [{
      id: "o1", listingId: "l1", bidderId: IRENE,
      offeredAssignmentId: "xAna", offeredTaskId: "e2", pointsAsked: 0,
      status: "pending", createdAt: 1,
    }],
  });
  const out = sanitizeState(s);
  assert.equal(out.offers[0].kind, "trade", "si ofrecía tarea, era un trueque");
});
