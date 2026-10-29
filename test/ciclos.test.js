// ============================================================================
//  Pruebas de los ciclos de semana/mes y del relleno de casillas.
//  Se ejecutan con el runner incorporado de Node: npm test
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { ensureFixedShape, estadoVacio } = require("../services/estadoService");

// La casa arranca ya con los cuatro perfiles: Mateo, Pablo, Sara y los papás.
const casaDePrueba = () => estadoVacio();

test("ensureFixedShape rellena las casillas que faltan", () => {
  const s = casaDePrueba();
  assert.equal(Object.keys(s.fixedState).length, 0, "parte vacío");

  const cambio = ensureFixedShape(s);

  assert.equal(cambio, true, "informa de que ha cambiado algo");
  assert.deepEqual(Object.keys(s.fixedState).sort(), ["mateo", "pablo", "sara"],
    "solo los hijos: los papás no tienen tareas");
  // 3 diarias + 1 semanal en la semilla
  assert.equal(Object.keys(s.fixedState.mateo).length, 4);
  assert.ok(Array.isArray(s.fixedState.mateo.f1.days), "las diarias llevan 7 días");
  assert.equal(s.fixedState.mateo.f1.days.length, 7);
  assert.equal(s.fixedState.mateo.f4.status, "pending", "las semanales llevan estado");
});

test("ensureFixedShape es idempotente (clave para no repintar en bucle)", () => {
  const s = casaDePrueba();
  ensureFixedShape(s);
  // La segunda pasada no debe cambiar nada. Si devolviera true, el cliente
  // guardaría en cada render y la pantalla se repintaría sin parar.
  assert.equal(ensureFixedShape(s), false);
  assert.equal(ensureFixedShape(s), false);
});

test("ensureFixedShape conserva el progreso ya marcado", () => {
  const s = casaDePrueba();
  ensureFixedShape(s);
  s.fixedState.mateo.f1.days = [true, true, true, false, false, false, false];
  s.fixedState.mateo.f4.status = "approved";

  ensureFixedShape(s);

  assert.deepEqual(s.fixedState.mateo.f1.days, [true, true, true, false, false, false, false]);
  assert.equal(s.fixedState.mateo.f4.status, "approved");
});

test("ensureFixedShape limpia casillas de quien no es hijo de esta casa", () => {
  const s = casaDePrueba();
  ensureFixedShape(s);
  // Restos de la época de las cuentas: un id que ya no corresponde a nadie,
  // y una tarea borrada del catálogo.
  s.fixedState["11111111-1111-4111-8111-111111111111"] = { f1: { days: [] } };
  s.fixedState.mateo.tarea_borrada = { status: "pending" };

  const cambio = ensureFixedShape(s);

  assert.equal(cambio, true);
  assert.equal(s.fixedState["11111111-1111-4111-8111-111111111111"], undefined,
    "el id que ya no es de nadie se va");
  assert.equal(s.fixedState.mateo.tarea_borrada, undefined, "la tarea inexistente se va");
});

test("ensureFixedShape rehace la casilla si cambia la frecuencia", () => {
  const s = casaDePrueba();
  ensureFixedShape(s);
  // f1 pasa de diaria a semanal
  s.fixedTasks.find((t) => t.id === "f1").freq = "weekly";

  assert.equal(ensureFixedShape(s), true);
  assert.equal(s.fixedState.mateo.f1.days, undefined);
  assert.equal(s.fixedState.mateo.f1.status, "pending");
});
