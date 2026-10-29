// ============================================================================
//  Avisos en el móvil (Web Push).
//
//  Funciona en iPhone desde iOS 16.4, SOLO si la app está añadida a la
//  pantalla de inicio (así es como la usa la familia), y en Android/escritorio
//  con cualquier navegador moderno. No hace falta ninguna app de terceros.
//
//  Cómo encaja:
//   1. El móvil pide permiso, se suscribe con la clave pública de la casa y
//      manda aquí su suscripción + el perfil de quien lo usa.
//   2. Cuando pasa algo (services/avisos.js decide qué), el servidor firma y
//      cifra el aviso y se lo entrega al servicio del fabricante (Apple,
//      Google, Mozilla), que lo hace llegar aunque la app esté cerrada.
//
//  Las claves VAPID se generan solas la primera vez y se guardan en la base
//  de datos (casa_meta): no hay que configurar nada. Si se definen
//  VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en el entorno, mandan esas.
// ============================================================================
const webpush = require("web-push");
const { query } = require("../db");
const { agrupar } = require("./avisos");
// El mismo catálogo de traducciones que usa el navegador.
const { normalizarIdioma, traducirAviso } = require("../public/i18n.js");

// Solo se aceptan suscripciones de los servicios de avisos reales. El servidor
// hace un POST a la dirección que le dan: sin esta lista, cualquiera con el
// código de casa podría usarlo para llamar a direcciones arbitrarias.
const SERVICIOS_PUSH = [
  "fcm.googleapis.com", "android.googleapis.com",      // Chrome, Android, Edge viejo
  "push.services.mozilla.com",                         // Firefox
  "web.push.apple.com",                                // Safari, iPhone, iPad, Mac
  "notify.windows.com",                                // Edge en Windows
];

function endpointValido(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return SERVICIOS_PUSH.some((s) => h === s || h.endsWith("." + s));
}

// Lo que manda el navegador: { endpoint, keys: { p256dh, auth } }
function validarSuscripcion(sub) {
  const s = sub && typeof sub === "object" ? sub : {};
  const k = s.keys && typeof s.keys === "object" ? s.keys : {};
  const b64 = (v) => typeof v === "string" && /^[A-Za-z0-9_\-=]{8,200}$/.test(v);
  if (!endpointValido(s.endpoint) || String(s.endpoint).length > 1000) return null;
  if (!b64(k.p256dh) || !b64(k.auth)) return null;
  return { endpoint: String(s.endpoint), p256dh: k.p256dh, auth: k.auth };
}

// Apple rechaza los avisos si el "sujeto" no es una URL https real o un
// mailto:. Render publica la dirección del servicio en RENDER_EXTERNAL_URL.
const sujeto = () => process.env.VAPID_SUBJECT || process.env.RENDER_EXTERNAL_URL || "mailto:avisos@example.com";

let claves = null;
async function clavesVapid() {
  if (claves) return claves;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    claves = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const leer = () => query("SELECT valor FROM casa_meta WHERE clave = 'vapid'");
    let r = await leer();
    if (!r.rows[0]) {
      // ON CONFLICT DO NOTHING + volver a leer: si dos peticiones llegan a la
      // vez, gana una y las dos usan las mismas claves.
      await query("INSERT INTO casa_meta (clave, valor) VALUES ('vapid', $1) ON CONFLICT (clave) DO NOTHING",
        [JSON.stringify(webpush.generateVAPIDKeys())]);
      r = await leer();
    }
    claves = JSON.parse(r.rows[0].valor);
  }
  webpush.setVapidDetails(sujeto(), claves.publicKey, claves.privateKey);
  return claves;
}

async function clavePublica() {
  return (await clavesVapid()).publicKey;
}

async function suscribir(perfil, sub, idioma) {
  const s = validarSuscripcion(sub);
  if (!s) return false;
  // El mismo móvil puede cambiar de perfil o de idioma: se actualiza, no se duplica.
  await query(
    `INSERT INTO push_suscripciones (endpoint, perfil, p256dh, auth, idioma)
          VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
          SET perfil = EXCLUDED.perfil, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
              idioma = EXCLUDED.idioma`,
    [s.endpoint, perfil, s.p256dh, s.auth, normalizarIdioma(idioma)]
  );
  return true;
}

async function darDeBaja(endpoint) {
  await query("DELETE FROM push_suscripciones WHERE endpoint = $1", [String(endpoint || "")]);
}

async function cuantas() {
  const r = await query("SELECT perfil, COUNT(*)::int AS n FROM push_suscripciones GROUP BY perfil");
  const out = {};
  r.rows.forEach((f) => { out[f.perfil] = f.n; });
  return out;
}

// Entrega un aviso a todas las suscripciones de un perfil (o a una sola, si se
// pasa `soloEndpoint`). Devuelve cuántas lo recibieron.
async function enviar(aviso, { soloEndpoint = null, ttl = 12 * 3600 } = {}) {
  await clavesVapid();
  const r = soloEndpoint
    ? await query("SELECT * FROM push_suscripciones WHERE endpoint = $1", [soloEndpoint])
    : await query("SELECT * FROM push_suscripciones WHERE perfil = $1", [aviso.para]);
  // Un mismo aviso puede salir en varios idiomas: se traduce una vez por idioma.
  const cargas = {};
  const cargaEn = (idioma) => {
    const id = normalizarIdioma(idioma);
    if (!cargas[id]) {
      const a = traducirAviso(aviso, id);
      cargas[id] = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, etiqueta: aviso.etiqueta || "casa" });
    }
    return cargas[id];
  };
  let entregados = 0;
  await Promise.all(r.rows.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        cargaEn(s.idioma), { TTL: ttl, urgency: "normal" });
      entregados++;
      await query("UPDATE push_suscripciones SET usada = now() WHERE endpoint = $1", [s.endpoint]);
    } catch (e) {
      // 404/410: el móvil ya no existe o retiró el permiso. Se olvida.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await darDeBaja(s.endpoint);
      } else {
        console.warn("[push] no se pudo entregar a", s.perfil, e.statusCode || "", e.body || e.message);
      }
    }
  }));
  return entregados;
}

// Para llamar sin esperar después de guardar: nunca lanza. Un aviso que no
// sale no debe estropear el guardado que ya se hizo.
async function enviarAvisos(avisos, opciones) {
  let total = 0;
  try {
    for (const a of agrupar(avisos || [])) total += await enviar(a, opciones);
  } catch (e) {
    console.warn("[push] fallo al enviar avisos:", e.message);
  }
  return total;
}

module.exports = {
  endpointValido, validarSuscripcion, clavePublica, suscribir, darDeBaja,
  cuantas, enviar, enviarAvisos,
};
