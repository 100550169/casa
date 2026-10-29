// ============================================================================
//  Pruebas del saneado y de los límites por rol.
//  Es la capa que impide que un hijo se apruebe sus propias tareas o toque las
//  de sus hermanos usando las herramientas del navegador.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { sanitizeState, applyChildLimits } = require("../services/stateGuard");

const IRENE = "11111111-1111-4111-8111-111111111111";
const LEO = "22222222-2222-4222-8222-222222222222";
const PADRE = "33333333-3333-4333-8333-333333333333";

function estadoBase() {
  return {
    currentMonth: "2026-08", currentWeek: "2026-W33",
    rate: 0.05, fixedPay: 8,
    members: [
      { id: PADRE, name: "Andrés", role: "parent", color: "#8b6fd6", load: "normal" },
      { id: IRENE, name: "Irene", role: "child", color: "#e0588f", load: "normal" },
      { id: LEO, name: "Leo", role: "child", color: "#2f9fd0", load: "normal" },
    ],
    fixedTasks: [
      { id: "f1", name: "Hacer la cama", icon: "🛏️", freq: "daily" },
      { id: "f2", name: "Lavadora", icon: "🧺", freq: "weekly" },
    ],
    extraTasks: [{ id: "e1", name: "Baño", points: 40, icon: "🛁" }],
    fixedState: {
      [IRENE]: { f1: { days: [true, false, false, false, false, false, false] }, f2: { status: "pending" } },
      [LEO]: { f1: { days: [false, false, false, false, false, false, false] }, f2: { status: "pending" } },
    },
    extras: [
      { id: "x1", taskId: "e1", memberId: IRENE, status: "pending", listed: false },
      { id: "x2", taskId: "e1", memberId: LEO, status: "pending", listed: false },
    ],
    generated: true, monthPoints: {}, streak: {}, history: {},
    dishes: [{ id: "d1", name: "Lentejas", type: "comida", tags: [] }],
    menu: {}, rewards: [{ id: "r1", title: "Peli", cost: 40, type: "Tiempo", stock: null, active: true }],
    redemptions: [], listings: [], offers: [], marketLog: [],
  };
}
const copia = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
//  Saneado
// ---------------------------------------------------------------------------
test("el saneado recorta el HTML de los iconos y acota los textos", () => {
  const s = estadoBase();
  s.fixedTasks[0].icon = '<img src=x onerror="alert(1)">';
  s.fixedTasks[0].name = "N".repeat(500);
  const out = sanitizeState(s);

  assert.ok(!out.fixedTasks[0].icon.includes("<"), "el icono no lleva <");
  assert.ok(!out.fixedTasks[0].icon.includes('"'), "el icono no lleva comillas");
  assert.ok(out.fixedTasks[0].name.length <= 60, "el nombre queda acotado");
});

test("el saneado deja los colores en hexadecimal o los sustituye", () => {
  const s = estadoBase();
  s.members[1].color = '"><script>alert(1)</script>';
  const out = sanitizeState(s);
  assert.match(out.members[1].color, /^#[0-9a-fA-F]{6}$/);
});

test("el saneado admite UUID como id de miembro", () => {
  const out = sanitizeState(estadoBase());
  assert.equal(out.members[1].id, IRENE, "el UUID sobrevive intacto");
  assert.ok(out.fixedState[IRENE], "y sigue sirviendo de clave");
});

test("el saneado tira referencias colgantes", () => {
  const s = estadoBase();
  s.extras.push({ id: "x9", taskId: "NO_EXISTE", memberId: IRENE, status: "pending" });
  s.extras.push({ id: "x8", taskId: "e1", memberId: "FANTASMA", status: "pending" });
  s.fixedState[IRENE].tarea_borrada = { status: "pending" };
  s.fixedState["OTRO_FANTASMA"] = { f1: { days: [] } };

  const out = sanitizeState(s);

  assert.deepEqual(out.extras.map((x) => x.id).sort(), ["x1", "x2"]);
  assert.equal(out.fixedState[IRENE].tarea_borrada, undefined);
  assert.equal(out.fixedState["OTRO_FANTASMA"], undefined);
});

test("el saneado normaliza estados de tarea inventados", () => {
  const s = estadoBase();
  s.extras[0].status = "yo-me-lo-apruebo";
  const out = sanitizeState(s);
  assert.equal(out.extras[0].status, "pending");
});

test("el saneado limpia del menú los platos borrados", () => {
  const s = estadoBase();
  s.menu = { Lun: { desayuno: "", comida: "d1", cena: "no-existe" } };
  const out = sanitizeState(s);
  assert.equal(out.menu.Lun.comida, "d1", "el que existe se queda");
  assert.equal(out.menu.Lun.cena, "", "el borrado se limpia");
});

// ---------------------------------------------------------------------------
//  Límites por rol
// ---------------------------------------------------------------------------
test("un hijo NO puede aprobarse una tarea semanal", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedState[IRENE].f2.status = "approved";

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.ok(rechazos.length > 0, "se registra el intento");
  assert.equal(estado.fixedState[IRENE].f2.status, "pending", "se queda como estaba");
});

test("un hijo SÍ puede marcar su tarea semanal como hecha", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedState[IRENE].f2.status = "submitted";

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.deepEqual(rechazos, []);
  assert.equal(estado.fixedState[IRENE].f2.status, "submitted");
});

test("un hijo puede marcar y desmarcar sus días de tareas diarias", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedState[IRENE].f1.days = [true, true, true, false, false, false, false];

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.deepEqual(rechazos, []);
  assert.deepEqual(estado.fixedState[IRENE].f1.days,
    [true, true, true, false, false, false, false]);
});

test("un hijo NO puede tocar las tareas de su hermano", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedState[LEO].f1.days = [true, true, true, true, true, true, true];
  nuevo.fixedState[LEO].f2.status = "approved";

  const { estado } = applyChildLimits(nuevo, prev, IRENE);

  assert.deepEqual(estado.fixedState[LEO].f1.days,
    [false, false, false, false, false, false, false], "los días de Leo no cambian");
  assert.equal(estado.fixedState[LEO].f2.status, "pending");
});

test("un hijo NO puede aprobarse una tarea adicional", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.extras[0].status = "approved";

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.ok(rechazos.some((r) => r.includes("x1")));
  assert.equal(estado.extras[0].status, "pending");
});

test("un hijo NO puede cambiarse la paga ni el valor del punto", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedPay = 999;
  nuevo.rate = 10;

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.ok(rechazos.includes("fixedPay"));
  assert.ok(rechazos.includes("rate"));
  assert.equal(estado.fixedPay, 8);
  assert.equal(estado.rate, 0.05);
});

test("un hijo NO puede inflarse la racha ni los puntos", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.streak = { [IRENE]: 999 };
  nuevo.monthPoints = { [IRENE]: 99999 };

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.ok(rechazos.includes("streak"));
  assert.ok(rechazos.includes("monthPoints"));
  // Se restaura la racha guardada, no la inventada. El saneado la deja como un
  // número por hijo, así que "sin racha" es un 0 por cabeza y no un objeto
  // vacío: lo que importa es que el 999 no ha sobrevivido.
  assert.deepEqual(estado.streak, { [IRENE]: 0, [LEO]: 0 });
  assert.deepEqual(estado.monthPoints, { [IRENE]: 0, [LEO]: 0 });
});

// Regresión: durante un tiempo, un hijo recibía 403 al marcar CUALQUIER tarea.
// El motivo no era una regla de permisos, sino que se comparaba con
// JSON.stringify un estado que venía de PostgreSQL (claves reordenadas) contra
// otro reconstruido por el saneado. Dos objetos idénticos daban distinto.
test("el orden de las claves no cuenta como intento de manipulación", () => {
  const prev = estadoBase();
  // Mismo contenido, claves al revés: es lo que devuelve PostgreSQL.
  const reordenado = JSON.parse(JSON.stringify(prev));
  reordenado.streak = { [LEO]: 0, [IRENE]: 0 };
  reordenado.menu = { Dom: {}, Lun: {} };
  prev.streak = { [IRENE]: 0, [LEO]: 0 };
  prev.menu = { Lun: {}, Dom: {} };

  const { rechazos } = applyChildLimits(reordenado, prev, IRENE);

  assert.deepEqual(rechazos, [], "nada que rechazar: es el mismo estado");
});

test("un hijo NO puede añadirse premios ni tareas al catálogo", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.rewards.push({ id: "r9", title: "Un coche", cost: 0, type: "x", stock: null, active: true });
  nuevo.extraTasks.push({ id: "e9", name: "Nada", points: 9999, icon: "🎁" });

  const { estado, rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.ok(rechazos.includes("rewards"));
  assert.ok(rechazos.includes("extraTasks"));
  assert.equal(estado.rewards.length, 1);
  assert.equal(estado.extraTasks.length, 1);
});

test("un cambio legítimo de un hijo no genera ningún rechazo", () => {
  const prev = estadoBase();
  const nuevo = copia(prev);
  nuevo.fixedState[IRENE].f1.days[1] = true;
  nuevo.extras[0].status = "submitted";

  const { rechazos } = applyChildLimits(nuevo, prev, IRENE);

  assert.deepEqual(rechazos, [], "nada que rechazar: " + rechazos.join(", "));
});
