// ============================================================================
//  Pruebas de la migración de menús.
//
//  El servidor guarda los platos como objetos {id,name,type,tags} y el menú
//  con desayuno/comida/cena. Las familias antiguas los tenían como texto
//  suelto y un plato por día. Sin migración veían "[object Object]".
//
//  ensureShape() vive dentro del <script> de public/index.html. Aquí se carga
//  ese script en un contexto aislado y se prueba tal cual, sin copiar la
//  lógica: si alguien cambia el cliente y rompe la migración, esto lo pilla.
//
//  OJO con el arnés: el script declara `let S`, y las variables `let`/`const`
//  NO se convierten en propiedades del objeto de contexto. Por eso el estado
//  se lee y se escribe ejecutando código DENTRO del contexto, no tocando
//  ctx.S desde fuera (que crearía una variable distinta y las pruebas pasarían
//  en falso).
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { cargarCliente } = require("./_cliente");

const { ejec, ponerEstado, leerEstado } = cargarCliente();

// Comprobación del propio arnés: si esto falla, las demás pruebas mienten.
test("el arnés alcanza de verdad el estado del cliente", () => {
  ponerEstado({ marca: 123 });
  assert.equal(leerEstado().marca, 123);
  assert.equal(typeof ejec("typeof ensureShape"), "string");
  assert.equal(ejec("typeof ensureShape"), "function", "ensureShape debe existir");
});

function estadoMinimo(extra) {
  return Object.assign({
    members: [], fixedTasks: [], extraTasks: [], extras: [],
    fixedState: {}, listings: [], offers: [], marketLog: [],
  }, extra);
}

test("convierte los platos de texto suelto en objetos", () => {
  ponerEstado(estadoMinimo({ dishes: ["Lentejas", "Pizza casera"], menu: {} }));
  ejec("ensureShape()");
  const S = leerEstado();

  assert.equal(S.dishes.length, 2);
  assert.equal(typeof S.dishes[0], "object", "deja de ser texto");
  assert.equal(S.dishes[0].name, "Lentejas");
  assert.equal(S.dishes[0].type, "comida", "por defecto van a comida");
  assert.ok(S.dishes[0].id, "recibe un id");
});

test("convierte el menú de un plato por día en desayuno/comida/cena", () => {
  ponerEstado(estadoMinimo({
    dishes: ["Lentejas", "Pizza casera"],
    menu: { Lun: "Lentejas", Mar: "Pizza casera" },
  }));
  ejec("ensureShape()");
  const S = leerEstado();

  const idLentejas = S.dishes.find((p) => p.name === "Lentejas").id;
  assert.equal(typeof S.menu.Lun, "object");
  assert.equal(S.menu.Lun.comida, idLentejas, "el plato viejo pasa a comida");
  assert.equal(S.menu.Lun.desayuno, "");
  assert.equal(S.menu.Lun.cena, "");
  ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].forEach((d) => {
    assert.equal(typeof S.menu[d], "object", "falta el día " + d);
  });
});

test("no toca los menús que ya tienen la forma nueva", () => {
  ponerEstado(estadoMinimo({
    dishes: [{ id: "d1", name: "Tostadas", type: "desayuno", tags: [] }],
    menu: { Lun: { desayuno: "d1", comida: "", cena: "" } },
  }));
  ejec("ensureShape()");
  const S = leerEstado();

  assert.equal(S.dishes[0].id, "d1", "conserva el id");
  assert.equal(S.dishes[0].type, "desayuno", "conserva el tipo");
  assert.equal(S.menu.Lun.desayuno, "d1");
});

test("la migración es idempotente (no rompe al repetirse)", () => {
  ponerEstado(estadoMinimo({ dishes: ["Lentejas"], menu: { Lun: "Lentejas" } }));
  ejec("ensureShape()");
  const tras1 = JSON.stringify(leerEstado().dishes) + JSON.stringify(leerEstado().menu);
  ejec("ensureShape(); ensureShape();");
  const tras3 = JSON.stringify(leerEstado().dishes) + JSON.stringify(leerEstado().menu);
  assert.equal(tras3, tras1);
});

test("aguanta un estado sin platos ni menú", () => {
  ponerEstado(estadoMinimo({}));
  ejec("ensureShape()");
  const S = leerEstado();
  assert.deepEqual(S.dishes, []);
  assert.equal(S.menu.Lun.comida, "");
});

test("dishNameAt no revienta con un plato borrado", () => {
  ponerEstado(estadoMinimo({
    dishes: [],
    menu: { Lun: { desayuno: "", comida: "ya-no-existe", cena: "" } },
  }));
  ejec("ensureShape()");
  // Devuelve el marcador, no lanza ni imprime "[object Object]"
  assert.equal(ejec("dishNameAt('Lun','comida')"), "—");
});

test("ningún día del menú se pinta como [object Object]", () => {
  // Reproduce el bug: platos como objetos (semilla del servidor) con el
  // cliente antiguo, que los metía tal cual en el HTML.
  ponerEstado(estadoMinimo({
    dishes: [{ id: "d1", name: "Lentejas", type: "comida", tags: [] }],
    menu: { Lun: { desayuno: "", comida: "d1", cena: "" } },
  }));
  ejec("ensureShape()");
  const nombres = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    .map((d) => ejec(`dishNameAt('${d}','comida')`));
  nombres.forEach((n) => {
    assert.ok(!String(n).includes("[object"), "aparece [object Object]: " + n);
  });
  assert.equal(nombres[0], "Lentejas");
});
