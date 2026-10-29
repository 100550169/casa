// ============================================================================
//  Pruebas de las copias automáticas.
//
//  No hay PostgreSQL en las pruebas: se inyecta una base de datos falsa que
//  apunta las consultas. No prueba PostgreSQL (eso se comprueba contra uno de
//  verdad); prueba que PEDIMOS lo correcto, una vez y en el momento correcto.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");

function cargarConDbFalsa() {
  const rutaDb = require.resolve("../db");
  const rutaCopias = require.resolve("../services/copias");
  const emitidas = [];
  const query = async (sql, params) => {
    emitidas.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    return { rows: [{ id: 1 }], rowCount: 1 };
  };
  require.cache[rutaDb] = {
    id: rutaDb, filename: rutaDb, loaded: true,
    exports: { query, tx: async (fn) => fn({ query }), hasDatabase: () => true },
  };
  delete require.cache[rutaCopias];
  return { copias: require("../services/copias"), emitidas };
}

const inserciones = (e) => e.filter((q) => q.sql.startsWith("INSERT INTO casa_copias"));

test("la copia diaria se guarda una vez, no en cada sondeo", async () => {
  const { copias, emitidas } = cargarConDbFalsa();
  for (let i = 0; i < 50; i++) await copias.asegurarCopiaDiaria({ a: 1 }, 7);
  assert.equal(inserciones(emitidas).length, 1, "50 lecturas, una copia");
  assert.equal(inserciones(emitidas)[0].params[1], "diaria");
});

test("la copia es la del momento, aunque luego se toque el estado", async () => {
  const { copias, emitidas } = cargarConDbFalsa();
  const estado = { valor: "antes" };
  const pendiente = copias.guardarCopia("antes_de_reiniciar", estado, 3);
  estado.valor = "después";                        // quien llama sigue trabajando
  await pendiente;
  assert.deepEqual(JSON.parse(inserciones(emitidas)[0].params[2]), { valor: "antes" });
});

test("tras guardar se podan las viejas (30 diarias, 10 del resto)", async () => {
  const { copias, emitidas } = cargarConDbFalsa();
  await copias.guardarCopia("antes_de_restaurar", {}, 1);
  const podas = emitidas.filter((q) => q.sql.startsWith("DELETE FROM casa_copias"));
  assert.equal(podas.length, 2);
  assert.deepEqual(podas.map((q) => q.params[0]).sort((a, b) => a - b), [10, 30]);
});

test("un motivo inventado no se guarda", async () => {
  const { copias, emitidas } = cargarConDbFalsa();
  await assert.rejects(copias.guardarCopia("porque_si", {}, 1));
  assert.equal(inserciones(emitidas).length, 0);
});

test("restaurar una copia antigua la sella con la semana actual", () => {
  const { prepararRestauracion, estadoVacio } = require("../services/estadoService");
  const { claveSemana, claveMes } = require("../services/tiempo");
  const vieja = estadoVacio();
  vieja.currentMonth = "2025-01"; vieja.currentWeek = "2025-W02";
  const r = prepararRestauracion(vieja);
  assert.equal(r.currentMonth, claveMes());
  assert.equal(r.currentWeek, claveSemana(), "si no, el siguiente GET la reiniciaría");
  assert.deepEqual(Object.keys(r.horarios).sort(), ["mateo", "pablo", "sara"]);
});
