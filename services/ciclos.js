// ============================================================================
//  Ciclos de semana y mes, y la lectura "al día" del estado.
//
//  Los cambios de semana y de mes los decide el SERVIDOR, en el huso de la
//  casa (services/tiempo.js). Antes vivían en la ruta GET /api/state; se sacan
//  aquí porque ya no es lo único que lee el estado: los recordatorios de las
//  18:00 y la copia diaria también lo necesitan al día. Si el recordatorio del
//  lunes saliera antes de que nadie abriera la app, avisaría con las tareas de
//  la semana anterior.
// ============================================================================
const {
  adoptarPerfiles, ensureFixedShape, normalizarMenus, normalizarCalendario,
  leerEstado, guardarEstado,
} = require("./estadoService");
const { calcularRachas, cerrarSemanaRachas } = require("./rachas");
const { resumenDelMes } = require("./puntos");
const { claveMes, claveSemana, hoyIdx } = require("./tiempo");
const { asegurarCopiaDiaria } = require("./copias");

// ---------------------------------------------------------------------------
//  Vencimientos automáticos.
//
//  Antes el padre tenía que marcar "vencida" a mano, tarea por tarea, y en la
//  práctica nadie lo hacía: las tareas sin hacer se quedaban eternamente en
//  "pendiente" y el reparto del mes siguiente arrancaba sucio.
//
//  Al cerrar el mes, lo que quedó sin entregar se marca como vencido. Lo que
//  el hijo SÍ entregó y los papás no llegaron a mirar se respeta: no sería
//  justo penalizar por un descuido suyo.
// ---------------------------------------------------------------------------
function vencerPendientes(state) {
  let n = 0;
  Object.keys(state.fixedState || {}).forEach((hijo) => {
    Object.keys(state.fixedState[hijo] || {}).forEach((tid) => {
      const casilla = state.fixedState[hijo][tid];
      if (casilla && casilla.status === "pending") { casilla.status = "late"; n++; }
    });
  });
  (state.extras || []).forEach((x) => {
    if (x.status === "pending") { x.status = "late"; n++; }
  });
  return n;
}

function iniciarSemanaFijas(state) {
  state.fixedState = {};
  (state.members || []).filter((m) => m.role === "child").forEach((c) => {
    state.fixedState[c.id] = {};
    (state.fixedTasks || []).forEach((t) => {
      state.fixedState[c.id][t.id] = t.freq === "weekly"
        ? { status: "pending" }
        : { days: [false, false, false, false, false, false, false] };
    });
  });
}

// Aplica los reinicios que toquen. Devuelve true si ha cambiado algo.
function aplicarCiclos(state) {
  const mes = claveMes(), semana = claveSemana();
  let cambio = false;

  if (state.currentMonth !== mes) {
    state.history = state.history || {};
    // Orden importante: primero se vence lo que quedó sin entregar, luego se
    // calcula el resumen (así refleja la realidad) y solo después se vacía.
    vencerPendientes(state);
    state.history[state.currentMonth] = resumenDelMes(state);
    // La racha encadenada hay que guardarla antes de vaciar las casillas.
    cerrarSemanaRachas(state);
    state.currentMonth = mes;
    state.monthPoints = {};
    state.fixedState = {}; state.extras = []; state.generated = false;
    state.listings = []; state.offers = []; state.marketLog = [];
    state.currentWeek = semana;
    cambio = true;
  } else if (state.currentWeek !== semana) {
    cerrarSemanaRachas(state);
    // Aquí NO se vence nada a propósito: las casillas de fijas se reinician
    // acto seguido, así que marcarlas no dejaría rastro en ningún sitio. Y las
    // adicionales son mensuales, no semanales: vencerlas ahora sería injusto.
    state.currentWeek = semana;
    if (state.generated) iniciarSemanaFijas(state);
    cambio = true;
  }

  const formaCambio = ensureFixedShape(state);
  const menuCambio = normalizarMenus(state);
  // El calendario es una plantilla: el cambio de semana no lo vacía. Aquí solo
  // se le da forma (casas anteriores al calendario) y se limpian restos.
  const calendarioCambio = normalizarCalendario(state);
  const rachaCambio = calcularRachas(state, hoyIdx());
  return formaCambio || menuCambio || calendarioCambio || rachaCambio || cambio;
}

// ---------------------------------------------------------------------------
//  Lee el estado, lo pone al día y, si ha cambiado algo, lo guarda.
//
//  Es lo que usan el GET, las copias y los recordatorios. Persistir aquí es
//  imprescindible: si solo se arreglara en la respuesta, el sondeo de los
//  móviles vería diferencia en cada vuelta y la pantalla se repintaría sin
//  parar (ya pasó: ver docs/adr/0004-server-side-normalization.md).
// ---------------------------------------------------------------------------
async function leerEstadoAlDia() {
  const { estado, version } = await leerEstado();

  // La copia diaria se hace ANTES de tocar nada: si hoy toca cerrar el mes, la
  // copia conserva el mes que se cierra tal cual estaba. Un fallo al copiar no
  // debe dejar a la casa sin poder abrir la app.
  try { await asegurarCopiaDiaria(estado, version); }
  catch (e) { console.error("[copias] no se pudo guardar la copia diaria:", e.message); }

  // Los perfiles primero: si el estado viene de la época de las cuentas, aquí
  // es donde los UUID antiguos se traducen a mateo/pablo/sara.
  const perfilesCambio = adoptarPerfiles(estado);
  let v = version;
  if (aplicarCiclos(estado) || perfilesCambio) v = await guardarEstado(estado);
  return { estado, version: v };
}

module.exports = { aplicarCiclos, vencerPendientes, iniciarSemanaFijas, leerEstadoAlDia };
