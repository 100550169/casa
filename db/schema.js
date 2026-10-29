// ============================================================================
//  Ejecutor de migraciones SQL idempotentes.
//  Lee db/migrations/*.sql en orden alfabético y los ejecuta.
//  Las migraciones usan IF NOT EXISTS para ser re-ejecutables sin riesgo.
// ============================================================================
const fs = require("fs");
const path = require("path");
const { query, hasDatabase } = require("./index");

async function runMigrations() {
  if (!hasDatabase()) {
    console.log("[migrate] DATABASE_URL no definida — saltando migraciones.");
    return;
  }

  // Tabla de control de migraciones aplicadas
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const { rows } = await query("SELECT 1 FROM schema_migrations WHERE filename=$1", [file]);
    if (rows.length) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`[migrate] aplicando ${file}`);
    await query(sql);
    await query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  }
  console.log("[migrate] migraciones al día.");
}

module.exports = { runMigrations };
