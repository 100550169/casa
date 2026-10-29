// ============================================================================
//  Copias de seguridad automáticas (dentro de la base de datos).
//
//  Antes la única copia era la que alguien descargara a mano con un botón, y
//  nadie lo hacía. Ahora:
//    - cada día, la primera vez que alguien abre la app, se guarda una foto
//      del estado (se conservan las últimas 30),
//    - y justo antes de cualquier operación que lo sobrescribe entero
//      (reiniciar o restaurar) se guarda otra (se conservan las últimas 10).
//  Desde el Dashboard se puede volver a cualquiera de ellas con un clic.
//
//  Viven en la misma base de datos, así que protegen de errores y borrados,
//  no de perder la base de datos. Para eso está la copia diaria en GitHub
//  (.github/workflows/nightly-backup.yml), que guarda una fuera.
// ============================================================================
const { query } = require("../db");
const { claveDia } = require("./tiempo");

const DIARIAS_A_GUARDAR = 30;
const OTRAS_A_GUARDAR = 10;
const MOTIVOS = ["diaria", "antes_de_reiniciar", "antes_de_restaurar"];

// Último día en que este proceso ya guardó (o comprobó) la copia diaria. Evita
// preguntar a la base de datos en cada sondeo de 4 s; si el servidor se
// reinicia, se comprueba una vez y listo (el índice único impide duplicados).
let ultimoDiaCopiado = null;

async function guardarCopia(motivo, estado, version) {
  if (!MOTIVOS.includes(motivo)) throw new Error("motivo_invalido");
  // Se serializa YA, antes de cualquier await: quien llama puede seguir
  // modificando el objeto y la copia tiene que ser la de este instante.
  const data = JSON.stringify(estado);
  const r = await query(
    `INSERT INTO casa_copias (dia, motivo, data, version)
          VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [claveDia(), motivo, data, Number(version) || 0]
  );
  await podar();
  return r.rowCount > 0;
}

async function asegurarCopiaDiaria(estado, version) {
  const hoy = claveDia();
  if (ultimoDiaCopiado === hoy) return false;
  const hecha = await guardarCopia("diaria", estado, version);
  ultimoDiaCopiado = hoy;
  return hecha;
}

async function podar() {
  await query(
    `DELETE FROM casa_copias WHERE motivo = 'diaria' AND id NOT IN (
       SELECT id FROM casa_copias WHERE motivo = 'diaria' ORDER BY dia DESC LIMIT $1)`,
    [DIARIAS_A_GUARDAR]
  );
  await query(
    `DELETE FROM casa_copias WHERE motivo <> 'diaria' AND id NOT IN (
       SELECT id FROM casa_copias WHERE motivo <> 'diaria' ORDER BY creada DESC LIMIT $1)`,
    [OTRAS_A_GUARDAR]
  );
}

async function listarCopias() {
  const r = await query(
    // El día se pide ya como texto: el driver convierte DATE a medianoche en el
    // huso del proceso, y con toISOString() saldría el día anterior en España.
    `SELECT id, to_char(dia, 'YYYY-MM-DD') AS dia, motivo, version, creada,
            octet_length(data::text) AS bytes
       FROM casa_copias ORDER BY creada DESC LIMIT 50`
  );
  return r.rows.map((c) => ({
    id: Number(c.id), dia: c.dia,
    motivo: c.motivo, version: Number(c.version),
    creada: c.creada, bytes: Number(c.bytes),
  }));
}

async function leerCopia(id) {
  const r = await query("SELECT data FROM casa_copias WHERE id = $1", [Number(id) || 0]);
  return r.rows[0] ? r.rows[0].data : null;
}

// Solo para las pruebas: olvidar qué día se copió.
function _olvidarCache() { ultimoDiaCopiado = null; }

module.exports = { guardarCopia, asegurarCopiaDiaria, listarCopias, leerCopia, _olvidarCache };
