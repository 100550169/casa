// ============================================================================
//  Pruebas de los perfiles fijos y de la traducción de los ids antiguos.
//
//  Cuando la app tenía cuentas, cada persona era un UUID de la tabla `users` y
//  ese UUID estaba metido por todas partes: en las casillas de tareas, en las
//  asignaciones, en los canjes, en el mercado y en el historial.
//
//  Al quitar las cuentas hay que traducir todo eso a mateo / pablo / sara sin
//  perder nada. Es una operación que se ejecuta UNA vez sobre datos reales y
//  que no se puede deshacer, así que conviene tenerla bien sujeta.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { adoptarPerfiles, estadoVacio } = require("../services/estadoService");
const {
  PERFILES, HIJOS, PAPAS, esHijo, esPerfilValido, miembrosIniciales,
} = require("../public/perfiles.js");

const U_MATEO = "11111111-1111-4111-8111-111111111111";
const U_PABLO = "22222222-2222-4222-8222-222222222222";
const U_SARA = "33333333-3333-4333-8333-333333333333";
const U_PADRE = "44444444-4444-4444-8444-444444444444";
const U_PRIMO = "55555555-5555-4555-8555-555555555555";

// ---------------------------------------------------------------------------
//  El catálogo
// ---------------------------------------------------------------------------
test("los ids de los perfiles son exactamente los acordados", () => {
  assert.deepEqual(HIJOS.map((p) => p.id), ["mateo", "pablo", "sara"]);
  assert.deepEqual(HIJOS.map((p) => p.name), ["Mateo", "Pablo", "Sara"]);
  assert.ok(HIJOS.every((p) => p.role === "child"));
  assert.equal(PAPAS.id, "papas");
  assert.equal(PAPAS.name, "Dashboard de los Papás");
  assert.equal(PERFILES.length, 4);
});

test("esHijo distingue a los tres hijos del panel de los papás", () => {
  assert.equal(esHijo("mateo"), true);
  assert.equal(esHijo("sara"), true);
  assert.equal(esHijo("papas"), false, "los papás no tienen tareas asignadas");
  assert.equal(esHijo("cualquiera"), false);
  assert.equal(esPerfilValido("papas"), true);
  assert.equal(esPerfilValido("abuela"), false);
});

test("la casa nueva arranca ya con los cuatro perfiles", () => {
  const s = estadoVacio();
  assert.deepEqual(s.members.map((m) => m.id), ["mateo", "pablo", "sara", "papas"]);
  assert.equal(adoptarPerfiles(s), false, "no hay nada que traducir ni que arreglar");
});

test("miembrosIniciales respeta la disponibilidad ya configurada", () => {
  const m = miembrosIniciales([{ id: "pablo", load: "minima" }, { id: "mateo", load: "basura" }]);
  assert.equal(m.find((x) => x.id === "pablo").load, "minima");
  assert.equal(m.find((x) => x.id === "mateo").load, "normal", "un valor inventado cae a normal");
});

// ---------------------------------------------------------------------------
//  La traducción de los datos que ya existían
// ---------------------------------------------------------------------------
function estadoDeLaEpocaDeLasCuentas() {
  return {
    currentMonth: "2026-08", currentWeek: "2026-W33",
    rate: 0.05, fixedPay: 8,
    members: [
      { id: U_PADRE, name: "Andrés", role: "parent", color: "#8b6fd6", load: "normal" },
      { id: U_MATEO, name: "Mateo", role: "child", color: "#e0588f", load: "normal" },
      { id: U_PABLO, name: "pablo", role: "child", color: "#2f9fd0", load: "reducida" },
      { id: U_SARA, name: "Sara", role: "child", color: "#2fae73", load: "normal" },
    ],
    fixedTasks: [{ id: "f1", name: "Cama", icon: "🛏️", freq: "daily" }],
    extraTasks: [{ id: "e1", name: "Baño", points: 40, icon: "🛁" }],
    fixedState: {
      [U_MATEO]: { f1: { days: [true, true, false, false, false, false, false] } },
      [U_PABLO]: { f1: { days: [true, false, false, false, false, false, false] } },
      [U_SARA]: { f1: { days: [false, false, false, false, false, false, false] } },
    },
    extras: [
      { id: "x1", taskId: "e1", memberId: U_MATEO, status: "approved", listed: false },
      { id: "x2", taskId: "e1", memberId: U_SARA, status: "pending", listed: true,
        bounty: { points: 5, from: U_PABLO, to: U_SARA } },
    ],
    generated: true,
    monthPoints: { [U_MATEO]: 120 },
    streak: { [U_MATEO]: 4, [U_SARA]: 9 },
    streakCarry: { [U_SARA]: 7 },
    history: { "2026-07": { points: { [U_MATEO]: 210 }, hechas: { [U_MATEO]: 3 }, vencidas: {} } },
    dishes: [], menu: {},
    rewards: [{ id: "r1", title: "Peli", cost: 40, type: "T", stock: null, active: true }],
    redemptions: [{ id: "c1", rewardId: "r1", childId: U_SARA, cost: 40, status: "pending", at: 1 }],
    listings: [{ id: "l1", sellerId: U_PABLO, assignmentId: "x2", taskId: "e1",
      pointsOffered: 5, acceptsTrade: false, note: "", status: "open", createdAt: 1 }],
    offers: [{ id: "o1", listingId: "l1", bidderId: U_MATEO, kind: "take",
      offeredAssignmentId: "", offeredTaskId: "", pointsAsked: 0, status: "pending", createdAt: 1 }],
    marketLog: [{ kind: "take", taskId: "e1", giveTaskId: "", from: U_PABLO, to: U_SARA, points: 5, at: 1 }],
  };
}

test("los UUID antiguos se traducen por nombre", () => {
  const s = estadoDeLaEpocaDeLasCuentas();

  assert.equal(adoptarPerfiles(s), true, "informa de que ha cambiado algo");

  assert.deepEqual(s.members.map((m) => m.id), ["mateo", "pablo", "sara", "papas"]);
  assert.ok(Array.isArray(s.fixedState.mateo.f1.days), "las casillas siguen ahí");
  assert.deepEqual(s.fixedState.mateo.f1.days.slice(0, 2), [true, true],
    "y con el progreso que tenían");
  assert.equal(s.fixedState[U_MATEO], undefined, "el UUID viejo ya no aparece");
});

test("la traducción alcanza a TODO lo que apunta a una persona", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  adoptarPerfiles(s);

  assert.equal(s.extras[0].memberId, "mateo");
  assert.deepEqual(s.extras[1].bounty, { points: 5, from: "pablo", to: "sara" });
  assert.equal(s.listings[0].sellerId, "pablo");
  assert.equal(s.offers[0].bidderId, "mateo");
  assert.equal(s.marketLog[0].from, "pablo");
  assert.equal(s.marketLog[0].to, "sara");
  assert.equal(s.redemptions[0].childId, "sara");
  assert.equal(s.streak.mateo, 4);
  assert.equal(s.streakCarry.sara, 7);
  assert.equal(s.monthPoints.mateo, 120);
  assert.equal(s.history["2026-07"].points.mateo, 210);
  assert.equal(s.history["2026-07"].hechas.mateo, 3);
});

test("el nombre se compara sin mayúsculas ni tildes", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  s.members[2].name = "PÁBLO";
  adoptarPerfiles(s);
  assert.equal(s.extras[1].bounty.from, "pablo");
});

test("cualquier padre o madre pasa a ser el perfil de los papás", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  s.marketLog.push({ kind: "take", taskId: "e1", from: U_PADRE, to: U_MATEO, points: 0, at: 2 });
  adoptarPerfiles(s);
  assert.equal(s.marketLog[1].from, "papas", "no importa cómo se llamara");
});

test("quien no es de esta casa no se traduce: sus datos quedan colgando", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  s.members.push({ id: U_PRIMO, name: "Nacho", role: "child", color: "#2f9fd0", load: "normal" });
  s.fixedState[U_PRIMO] = { f1: { days: [true, true, true, true, true, true, true] } };

  adoptarPerfiles(s);

  assert.equal(s.fixedState[U_PRIMO] !== undefined, true,
    "adoptarPerfiles no borra: solo traduce lo que sabe traducir");
  assert.ok(!s.members.some((m) => m.id === U_PRIMO), "pero ya no es miembro de la casa");
  // Quien lo limpia de verdad es ensureFixedShape / el saneado, cada uno en su
  // momento. Repartir la responsabilidad evita borrados por sorpresa aquí.
});

test("la traducción es idempotente: repetirla no rompe nada", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  adoptarPerfiles(s);
  const foto = JSON.stringify(s);

  assert.equal(adoptarPerfiles(s), false, "la segunda vez ya no hay nada que hacer");
  assert.equal(JSON.stringify(s), foto, "y el estado no se mueve");
});

test("la disponibilidad configurada sobrevive a la traducción", () => {
  const s = estadoDeLaEpocaDeLasCuentas();
  adoptarPerfiles(s);
  assert.equal(s.members.find((m) => m.id === "pablo").load, "reducida");
});

test("un estado sin members se queda con los cuatro perfiles", () => {
  const s = { members: undefined, fixedState: {}, extras: [] };
  assert.equal(adoptarPerfiles(s), true);
  assert.deepEqual(s.members.map((m) => m.id), ["mateo", "pablo", "sara", "papas"]);
});
