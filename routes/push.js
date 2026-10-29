// ============================================================================
//  Rutas de los avisos en el móvil.
//
//    GET  /api/push/clave          clave pública para suscribirse
//    POST /api/push/suscribir      este móvil quiere avisos (para su perfil, en su idioma)
//    POST /api/push/baja           este móvil ya no quiere avisos
//    POST /api/push/prueba         manda un aviso de prueba a ESTE móvil
//    GET  /api/push/estado         cuántos móviles reciben avisos (papás)
//    POST /api/push/recordatorios  el recordatorio de la tarde (papás)
//
//  Todo pasa antes por el código de casa (server.js).
// ============================================================================
const express = require("express");
const { query } = require("../db");
const { perfilDe, soloPapas } = require("../services/perfilPeticion");
const { leerEstadoAlDia } = require("../services/ciclos");
const { recordatoriosDelDia } = require("../services/avisos");
const { claveDia, hoyIdx, minutosLocales } = require("../services/tiempo");
const push = require("../services/push");

const router = express.Router();

// Ventana del recordatorio de la tarde, en minutos desde medianoche (hora de
// la casa): de 17:00 a 21:30.
const VENTANA = { desde: 17 * 60, hasta: 21 * 60 + 30 };
const dentroDeVentana = (min) => min >= VENTANA.desde && min < VENTANA.hasta;
const formatoHora = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
const VENTANA_TEXTO = formatoHora(VENTANA.desde) + "–" + formatoHora(VENTANA.hasta);

const envolver = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    console.error("[push]", e);
    res.status(500).json({ error: "error_servidor" });
  }
};

router.get("/clave", envolver(async (req, res) => {
  res.json({ clave: await push.clavePublica() });
}));

router.post("/suscribir", envolver(async (req, res) => {
  const ok = await push.suscribir(perfilDe(req), req.body && req.body.suscripcion, req.body && req.body.idioma);
  if (!ok) return res.status(400).json({ error: "suscripcion_invalida" });
  res.json({ ok: true, perfil: perfilDe(req) });
}));

router.post("/baja", envolver(async (req, res) => {
  await push.darDeBaja(req.body && req.body.endpoint);
  res.json({ ok: true });
}));

router.post("/prueba", envolver(async (req, res) => {
  const endpoint = String((req.body && req.body.endpoint) || "");
  const n = await push.enviar(
    { para: perfilDe(req), titulo: "🔔 Los avisos funcionan", cuerpo: "Así te llegará lo que pase en Casa.", etiqueta: "prueba" },
    { soloEndpoint: endpoint, ttl: 300 });
  if (!n) return res.status(404).json({ error: "no_suscrito" });
  res.json({ ok: true });
}));

router.get("/estado", soloPapas, envolver(async (req, res) => {
  res.json({ suscripciones: await push.cuantas() });
}));

// Lo llama cada tarde .github/workflows/evening-reminder.yml (o quien quiera, con
// el código de casa y perfil de papás). Como mucho UNA vez al día: si el
// programador de tareas lo repite, o alguien lo llama a mano, no se manda dos
// veces. Con ?simular=1 dice qué mandaría, sin mandar ni apuntar nada.
//
// Y solo dentro de la ventana de la tarde (hora de la casa). GitHub retrasa
// las tareas programadas cuando va cargado: en octubre de 2026 el de las 18:00
// llegó a las 22:10 y a las 22:31. Un aviso a esas horas no sirve (o despierta
// a alguien), así que se descarta; el workflow lo intenta varias veces por la
// tarde y vale el primero que llegue a tiempo. ?forzar=1 se salta la ventana
// (para probarlo a mano desde Actions).
router.post("/recordatorios", soloPapas, envolver(async (req, res) => {
  const ahora = minutosLocales();
  if (req.query.forzar !== "1" && !dentroDeVentana(ahora)) {
    return res.json({ ok: true, fueraDeHora: true, hora: formatoHora(ahora), ventana: VENTANA_TEXTO });
  }
  const { estado } = await leerEstadoAlDia();
  const avisos = recordatoriosDelDia(estado, hoyIdx());
  const dia = claveDia();

  if (req.query.simular === "1") return res.json({ simulado: true, dia, avisos });

  // Atómico: solo una petición por día consigue "apuntarse" el envío.
  const r = await query(
    `INSERT INTO casa_meta (clave, valor, updated_at) VALUES ('ultimo_recordatorio', $1, now())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
       WHERE casa_meta.valor <> EXCLUDED.valor
     RETURNING clave`,
    [dia]
  );
  if (!r.rowCount) return res.json({ ok: true, yaEnviado: true, dia });

  // Cada recordatorio por separado: no se agrupan (ya van uno por persona).
  let entregados = 0;
  for (const a of avisos) entregados += await push.enviar(a, { ttl: 4 * 3600 }).catch(() => 0);
  res.json({ ok: true, dia, avisos: avisos.length, entregados });
}));

module.exports = router;
module.exports.dentroDeVentana = dentroDeVentana;
module.exports.VENTANA = VENTANA;
