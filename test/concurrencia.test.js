// ============================================================================
//  Pruebas de la fusión ante conflictos de escritura.
//
//  Antes cada guardado mandaba el estado entero y ganaba el último: si un hijo
//  marcaba una tarea justo cuando su padre cambiaba la paga, uno de los dos
//  cambios desaparecía sin que nadie se enterara.
//
//  Ahora el servidor rechaza (409) si alguien escribió en medio, y el cliente
//  vuelve a aplicar SUS campos sobre el estado fresco.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { cargarCliente } = require("./_cliente");

const { ejec } = cargarCliente();

// fusionarCambios(fresco, mio, base) vive en el cliente; se invoca dentro del
// contexto para probar el código real.
function fusionar(fresco, mio, base) {
  return JSON.parse(ejec(
    `JSON.stringify(fusionarCambios(${JSON.stringify(fresco)},${JSON.stringify(mio)},${JSON.stringify(base)}))`
  ));
}

const base = () => ({
  fixedPay: 8, rate: 0.05, generated: true,
  fixedState: { irene: { f1: { days: [false, false, false, false, false, false, false] } } },
  extras: [{ id: "x1", taskId: "e1", memberId: "irene", status: "pending" }],
  rewards: [{ id: "r1", title: "Peli", cost: 40, type: "T", stock: null, active: true }],
  _version: 5,
});

test("mi cambio se conserva sobre el estado fresco del otro", () => {
  const b = base();
  // El padre (otro dispositivo) subió la paga
  const fresco = { ...b, fixedPay: 12, _version: 6 };
  // Yo (el hijo) marqué una tarea
  const mio = JSON.parse(JSON.stringify(b));
  mio.fixedState.irene.f1.days[0] = true;

  const r = fusionar(fresco, mio, b);

  assert.equal(r.fixedPay, 12, "se respeta el cambio del otro");
  assert.equal(r.fixedState.irene.f1.days[0], true, "y también el mío");
  assert.equal(r._version, 6, "se adopta la versión fresca para reintentar");
});

test("lo que yo no toqué se queda como lo dejó el otro", () => {
  const b = base();
  const fresco = { ...b, rate: 0.10, generated: false, _version: 7 };
  const mio = JSON.parse(JSON.stringify(b));
  mio.fixedPay = 20;                              // solo cambio esto

  const r = fusionar(fresco, mio, b);

  assert.equal(r.fixedPay, 20, "mi cambio");
  assert.equal(r.rate, 0.10, "lo suyo se mantiene");
  assert.equal(r.generated, false, "y esto también");
});

test("si los dos tocamos el mismo campo, gana el mío (y se avisa en la app)", () => {
  const b = base();
  const fresco = { ...b, fixedPay: 12, _version: 6 };
  const mio = { ...JSON.parse(JSON.stringify(b)), fixedPay: 20 };

  const r = fusionar(fresco, mio, b);

  // Es una fusión gruesa: no puede saber cuál de los dos importa más.
  assert.equal(r.fixedPay, 20);
});

test("los campos de este dispositivo no se propagan", () => {
  const b = base();
  const fresco = { ...b, _version: 6 };
  const mio = { ...JSON.parse(JSON.stringify(b)), deskTab: "econ", view: "desk", profile: "irene", mobTab: "home" };

  const r = fusionar(fresco, mio, b);

  assert.equal(r.deskTab, undefined, "la pestaña abierta es de cada dispositivo");
  assert.equal(r.view, undefined);
  assert.equal(r.profile, undefined);
});

test("sin punto de partida se manda lo mío entero (peor caso, pero no se pierde)", () => {
  const fresco = { ...base(), fixedPay: 99, _version: 9 };
  const mio = { ...base(), fixedPay: 20 };

  const r = fusionar(fresco, mio, null);

  assert.equal(r.fixedPay, 20);
  assert.equal(r._version, 9, "pero con la versión buena, para que el reintento cuele");
});

test("añadir un elemento a una lista sobrevive a la fusión", () => {
  const b = base();
  // El otro aprobó una tarea
  const fresco = JSON.parse(JSON.stringify(b));
  fresco.extras[0].status = "approved";
  fresco._version = 6;
  // Yo pedí un premio
  const mio = JSON.parse(JSON.stringify(b));
  mio.redemptions = [{ id: "c1", rewardId: "r1", childId: "irene", cost: 40, status: "pending", at: 1 }];

  const r = fusionar(fresco, mio, b);

  assert.equal(r.extras[0].status, "approved", "su aprobación se mantiene");
  assert.equal(r.redemptions.length, 1, "y mi solicitud también");
});
