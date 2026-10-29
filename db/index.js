// ============================================================================
//  Acceso a base de datos (PostgreSQL).
//  Exporta un pool y helpers para queries parametrizadas.
//  Requiere process.env.DATABASE_URL.
// ============================================================================
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Modo legacy: el módulo se carga aunque no haya BD para no romper imports,
  // pero cualquier query fallará con error claro. server.js gestiona el aviso.
  console.warn("[db] DATABASE_URL no definida. La app no podrá leer ni guardar el estado de la casa.");
}

let pool = null;
function getPool() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL no configurada: la app necesita PostgreSQL para guardar la casa.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

function hasDatabase() {
  return !!DATABASE_URL;
}

module.exports = { getPool, query, tx, hasDatabase };
