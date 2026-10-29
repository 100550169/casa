// ============================================================================
//  Cálculo de puntos del mes, en el servidor.
//
//  El cliente calcula los puntos en vivo para pintarlos, pero al cerrar el mes
//  hay que dejarlos escritos en `history`. Antes se archivaba `monthPoints`,
//  un campo que NADIE escribía nunca: el historial guardaba ceros y la
//  comparación "mes anterior" que ve cada hijo siempre salía a 0.
//
//  La fórmula es la misma que la del cliente (monthPoints en index.html):
//     unidades de fijas aprobadas x2 + puntos de adicionales aprobadas
//     + neto de primas del mercado (solo de tareas aprobadas)
// ============================================================================

const hijos = (s) => (s.members || []).filter((m) => m.role === "child");
const tareaExtra = (s, id) => (s.extraTasks || []).find((t) => t.id === id);

// Unidades de tareas fijas conseguidas: cada día marcado de una diaria cuenta
// 1, y una semanal aprobada cuenta 1.
function unidadesFijas(state, childId) {
  let n = 0;
  (state.fixedTasks || []).forEach((t) => {
    const c = ((state.fixedState || {})[childId] || {})[t.id];
    if (!c) return;
    if (t.freq !== "weekly") n += (c.days || []).filter(Boolean).length;
    else if (c.status === "approved") n += 1;
  });
  return n;
}

function puntosExtrasAprobadas(state, childId) {
  return (state.extras || [])
    .filter((x) => x.memberId === childId && x.status === "approved")
    .reduce((s, x) => s + ((tareaExtra(state, x.taskId) || {}).points || 0), 0);
}

// Primas pactadas en el mercado. Solo cuentan si la tarea acabó aprobada: no
// se cobra por trabajo que no se hizo.
function netoPrimas(state, childId) {
  let neto = 0;
  (state.extras || []).filter((x) => x.status === "approved" && x.bounty).forEach((x) => {
    if (x.bounty.to === childId) neto += x.bounty.points || 0;
    if (x.bounty.from === childId) neto -= x.bounty.points || 0;
  });
  return neto;
}

function puntosDelMes(state, childId) {
  return Math.max(0,
    unidadesFijas(state, childId) * 2
    + puntosExtrasAprobadas(state, childId)
    + netoPrimas(state, childId));
}

// Resumen que se archiva al cerrar el mes: puntos y cuántas tareas acabaron
// hechas o sin hacer. Sirve para que el hijo vea su mes anterior con datos
// reales y para que el padre tenga un registro.
function resumenDelMes(state) {
  const puntos = {}, hechas = {}, vencidas = {};
  hijos(state).forEach((c) => {
    puntos[c.id] = puntosDelMes(state, c.id);
    const extras = (state.extras || []).filter((x) => x.memberId === c.id);
    hechas[c.id] = extras.filter((x) => x.status === "approved").length;
    vencidas[c.id] = extras.filter((x) => x.status === "late").length;
  });
  return { points: puntos, hechas, vencidas };
}

module.exports = { unidadesFijas, puntosExtrasAprobadas, netoPrimas, puntosDelMes, resumenDelMes };
