// ============================================================================
//  Rutas del estado de la casa.
//
//  Quién puede ENTRAR lo decide el código de casa (services/codigoCasa.js),
//  antes de llegar aquí. Lo que se mira aquí es el PERFIL que declara cada
//  dispositivo en la cabecera `X-Perfil` ("¿quién usa este móvil?"), para las
//  reglas de producto:
//
//    - un hijo marca sus tareas, pero no se las aprueba ni toca las de sus
//      hermanos,
//    - los ajustes de la casa (economía, catálogos, copias) son de los papás.
//
//  Es una separación de roles, no una contraseña: se cambia de perfil en la
//  pantalla de inicio. Es intencionado; pedirle una contraseña a un niño de
//  diez años solo consigue que deje de usar la app.
// ============================================================================
const express = require("express");
const {
  estadoVacio, adoptarPerfiles, ensureFixedShape, normalizarMenus, normalizarCalendario,
  leerEstado, guardarEstado, guardarSiVersion, versionActual, prepararRestauracion,
} = require("../services/estadoService");
const { esHijo } = require("../public/perfiles.js");
const { sanitizeState, applyChildLimits } = require("../services/stateGuard");
const { calcularRachas } = require("../services/rachas");
const { claveMes, claveSemana, hoyIdx } = require("../services/tiempo");
const { perfilDe, soloPapas } = require("../services/perfilPeticion");
const { leerEstadoAlDia } = require("../services/ciclos");
const { guardarCopia } = require("../services/copias");
const { avisosDeCambio } = require("../services/avisos");
const { enviarAvisos } = require("../services/push");

const router = express.Router();

function isValidState(s) {
  return s && typeof s === "object"
    && Array.isArray(s.fixedTasks)
    && Array.isArray(s.extraTasks);
}

// GET /api/state — estado de la casa, al día (perfiles, semana, mes, forma)
router.get("/state", async (req, res) => {
  try {
    const { estado, version } = await leerEstadoAlDia();
    // La versión viaja con el estado: el cliente la devuelve al guardar y así
    // el servidor sabe si escribió alguien más mientras tanto.
    estado._version = version;
    res.json(estado);
  } catch (e) {
    console.error("[state/get]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// PUT /api/state — guarda el estado completo de la casa.
// Los hijos pueden escribir (lo necesitan para marcar sus tareas), pero no
// pueden aprobárselas ni tocar las de sus hermanos.
router.put("/state", async (req, res) => {
  try {
    if (!isValidState(req.body)) return res.status(400).json({ error: "estado_invalido" });

    // Versión desde la que dice venir el cliente (sanitizeState la descarta,
    // así que se lee del cuerpo original).
    const versionCliente = Number(req.body._version) || 0;
    const perfil = perfilDe(req);
    const { estado: prev, version: versionServidor } = await leerEstado();

    // 1. Lo primero, si este dispositivo viene de una versión vieja: 409.
    //
    //    El orden importa. Si esta comprobación fuera después de las reglas de
    //    perfil, un hijo que hubiera leído el estado antes de que sus papás
    //    cambiaran algo recibiría un 403 ("no puedes tocar eso") en lugar de un
    //    409 ("recarga y reintenta"). El 403 no se reintenta: su cambio se
    //    perdería y en pantalla solo vería un aviso de desconexión.
    if (versionCliente !== 0 && versionCliente !== versionServidor) {
      return res.status(409).json({ error: "version_desfasada", version: versionServidor });
    }

    // 2. Sanear siempre: tipos, longitudes, enumerados y referencias colgantes.
    let incoming = sanitizeState(req.body);

    // 3. Reglas de perfil. Un hijo necesita escribir para marcar sus tareas,
    //    pero no puede aprobárselas ni tocar las de sus hermanos.
    if (esHijo(perfil)) {
      const { estado, rechazos } = applyChildLimits(incoming, prev, perfil);
      if (rechazos.length) {
        console.warn("[state/put] cambios rechazados a", perfil, rechazos);
        return res.status(403).json({ error: "cambio_no_permitido", detalles: rechazos.slice(0, 10) });
      }
      incoming = estado;
    }

    // Los ciclos los marca el reloj del servidor, no el del dispositivo. Si el
    // cliente escribe con una semana o un mes que ya no son los actuales, se
    // rechaza: su sondeo traerá el estado bueno en unos segundos.
    if (incoming.currentMonth !== claveMes() || incoming.currentWeek !== claveSemana()) {
      return res.status(409).json({ error: "ciclo_desfasado" });
    }

    // Los miembros son siempre los cuatro perfiles: nadie los inventa desde el
    // cliente. Y la forma se deja completa aquí, para que el GET no tenga que
    // reescribirla (si no, sondeo en bucle).
    adoptarPerfiles(incoming);
    ensureFixedShape(incoming);
    normalizarMenus(incoming);
    normalizarCalendario(incoming);
    // La racha la calcula siempre el servidor a partir de las casillas: nadie
    // puede escribirla desde el cliente.
    calcularRachas(incoming, hoyIdx());

    // Escritura con comprobación de versión. Si entre que este dispositivo
    // leyó el estado y lo guarda ha escrito alguien más, no se actualiza nada
    // y se responde 409: el cliente recarga y reaplica su cambio sobre el
    // estado fresco. Antes ganaba el último y el otro cambio desaparecía sin
    // que nadie se enterara.
    const nueva = await guardarSiVersion(incoming, versionCliente);
    if (nueva === null) {
      return res.status(409).json({ error: "version_desfasada", version: await versionActual() });
    }
    res.json({ ok: true, version: nueva });

    // Avisos en el móvil de lo que le importa a OTRO (Sara entrega → papás;
    // los papás aprueban → Sara). Después de responder y sin esperar: que un
    // servicio de avisos lento no haga esperar a quien está marcando la tarea.
    enviarAvisos(avisosDeCambio(prev, incoming));
  } catch (e) {
    console.error("[state/put]", e);
    if (!res.headersSent) res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/reset — vuelve al estado de ejemplo (solo papás).
// Antes se guarda una copia: un clic equivocado se deshace desde el Dashboard.
router.post("/reset", soloPapas, async (req, res) => {
  try {
    const actual = await leerEstado();
    await guardarCopia("antes_de_reiniciar", actual.estado, actual.version);
    const fresco = estadoVacio();
    fresco.currentMonth = claveMes();
    fresco.currentWeek = claveSemana();
    ensureFixedShape(fresco);
    normalizarMenus(fresco);
    normalizarCalendario(fresco);
    await guardarEstado(fresco);
    res.json({ ok: true });
  } catch (e) {
    console.error("[state/reset]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// GET /api/backup — descarga el estado actual (solo papás). Es también lo que
// guarda cada noche la copia de GitHub (.github/workflows/nightly-backup.yml).
router.get("/backup", soloPapas, async (req, res) => {
  try {
    const { estado } = await leerEstadoAlDia();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="casa-copia-${stamp}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(estado, null, 2));
  } catch (e) {
    console.error("[state/backup]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

// POST /api/restore — restaura desde un archivo de copia (solo papás).
router.post("/restore", soloPapas, async (req, res) => {
  try {
    if (!isValidState(req.body)) return res.status(400).json({ error: "copia_invalida" });
    const actual = await leerEstado();
    await guardarCopia("antes_de_restaurar", actual.estado, actual.version);
    await guardarEstado(prepararRestauracion(req.body));
    res.json({ ok: true });
  } catch (e) {
    console.error("[state/restore]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = router;
