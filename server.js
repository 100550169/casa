// ============================================================================
//  Servidor "Casa" — app privada de una sola casa, sin cuentas.
//
//  No hay registro, ni contraseñas, ni email, ni sesiones. Los cuatro perfiles
//  (Mateo, Pablo, Sara y el Dashboard de los Papás) están fijados en
//  public/perfiles.js y el estado vive en una única fila de PostgreSQL.
//
//  Lo que sí hay es un CÓDIGO DE CASA (services/codigoCasa.js): sin él, la API
//  no responde. Cada móvil lo recibe una vez por enlace y lo guarda; nadie lo
//  teclea en el día a día. Ver docs/ARCHITECTURE.md y docs/adr/0010.
// ============================================================================
require("dotenv").config();

const express = require("express");
const path = require("path");

const { hasDatabase } = require("./db");
const { runMigrations } = require("./db/schema");
const { crearGuardia, normalizarCodigo } = require("./services/codigoCasa");

const stateRoutes = require("./routes/state");
const pushRoutes = require("./routes/push");
const copiasRoutes = require("./routes/copias");

const app = express();
const guardia = crearGuardia();

// Necesario detrás de proxies (Render, Heroku) para que la IP que ve el
// limitador de intentos del código de casa sea la real y no la del proxy.
app.set("trust proxy", 1);
// No anunciar qué servidor es.
app.disable("x-powered-by");

// Cabeceras de seguridad básicas, para todo lo que sirve el servidor.
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",                        // nadie la mete en un iframe
    "Referrer-Policy": "no-referrer",
    // Es la app de una casa: que ningún buscador la indexe.
    "X-Robots-Tag": "noindex, nofollow",
    "Strict-Transport-Security": "max-age=15552000",
  });
  next();
});

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Salud. Pública: la usan Render para saber si el servicio vive y el
// Dashboard para avisar si la casa está sin proteger.
app.get("/api/health", (req, res) => res.json({ ok: true, db: hasDatabase(), protegida: guardia.activo }));

// Todo lo demás de /api pide el código de casa.
app.use("/api", guardia.middleware);

// ---------------------------------------------------------------------------
//  Demo pública (/demo)
//  Sirve la misma aplicación, pero el cliente carga demo.js, que sustituye la
//  capa de red por datos de ejemplo en memoria. Sirve para enseñar la app sin
//  tocar los datos de casa: en modo demo el navegador no llama a la API.
// ---------------------------------------------------------------------------
// Con `root`, y no con la ruta absoluta: Express 5 rechaza (404) cualquier
// ruta que pase por una carpeta que empiece por punto, y el proyecto puede
// vivir dentro de una (p. ej. ~/.claude/…). Con root solo mira "index.html".
app.get("/demo", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// ---------------------------------------------------------------------------
//  Verificación de dominio para la app de Android (TWA).
//  Es lo que permite que la app instalada abra a pantalla completa en vez de
//  con la barra del navegador. La huella SHA-256 la da Google Play DESPUÉS de
//  subir la app por primera vez; se pone en la variable de entorno
//  ANDROID_FINGERPRINT para no tener que tocar el código.
// ---------------------------------------------------------------------------
app.get("/.well-known/assetlinks.json", (req, res) => {
  const huella = (process.env.ANDROID_FINGERPRINT || "").trim();
  const paquete = process.env.ANDROID_PACKAGE || "com.casa.tareas";
  res.type("application/json");
  if (!huella) {
    return res.status(503).json({
      error: "Falta ANDROID_FINGERPRINT",
      comoArreglarlo:
        "Play Console -> Integridad de la app -> copia el SHA-256 de la clave de firma " +
        "y pegalo en la variable de entorno ANDROID_FINGERPRINT del servidor.",
    });
  }
  res.json([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: paquete,
      sha256_cert_fingerprints: huella.split(",").map((h) => h.trim()).filter(Boolean),
    },
  }]);
});

// API
app.use("/api/push", pushRoutes);      // avisos en el móvil
app.use("/api/copias", copiasRoutes);  // copias automáticas
app.use("/api", stateRoutes);          // /api/state, /api/reset, /api/backup, /api/restore

// 404 para rutas /api desconocidas
app.use("/api", (req, res) => res.status(404).json({ error: "no_encontrado" }));

// Manejador final. Los errores de quien llama (JSON mal formado, cuerpo
// demasiado grande…) llegan con su código 4xx y se devuelven tal cual: no son
// fallos del servidor ni merecen una traza en el registro.
app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.type === "entity.parse.failed" ? "json_invalido" : "peticion_invalida" });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "error_servidor" });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    if (!hasDatabase()) {
      console.warn("\n⚠️  DATABASE_URL no configurada.");
      console.warn("    La app no podrá guardar nada.");
      console.warn("    Configura PostgreSQL (Neon recomendado) en .env\n");
    } else {
      await runMigrations();
    }
    if (!guardia.activo) {
      // Opcional: es una app de casa. Se deja dicho en el registro, sin más.
      console.log("[casa] Sin CODIGO_CASA: se entra solo con la dirección. Para pedir código: `npm run codigo` y ponerlo en el entorno.");
    } else if (normalizarCodigo(process.env.CODIGO_CASA).length < 10) {
      console.warn("\n⚠️  CODIGO_CASA es muy corto. Usa uno de `npm run codigo`.\n");
    }
    app.listen(PORT, () => console.log(`Casa escuchando en :${PORT}`));
  } catch (e) {
    console.error("Error al arrancar:", e);
    process.exit(1);
  }
})();
