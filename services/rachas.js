// ============================================================================
//  Rachas (🔥 días seguidos).
//
//  Antes los números que veían los hijos eran valores escritos a mano en la
//  semilla: no se calculaban nunca. Ahora los calcula el servidor a partir de
//  las casillas de tareas diarias, y para el cliente son de solo lectura.
//
//  Un día cuenta si ESE día están marcadas TODAS las tareas diarias.
//
//  Como fixedState solo guarda la semana en curso, al cerrar la semana se
//  arrastra en `streakCarry` lo que llevaba encadenado, para que la racha no
//  se corte artificialmente cada lunes.
// ============================================================================

const tareasDiarias = (state) => (state.fixedTasks || []).filter((t) => t.freq !== "weekly");
const hijos = (state) => (state.members || []).filter((m) => m.role === "child");

// ¿Están marcadas todas las diarias de ese hijo en el día `idx` (0 = lunes)?
function diaCompleto(state, childId, idx) {
  const diarias = tareasDiarias(state);
  if (!diarias.length) return false;              // sin tareas no hay racha
  const casillas = (state.fixedState || {})[childId] || {};
  return diarias.every((t) => {
    const c = casillas[t.id];
    return !!(c && Array.isArray(c.days) && c.days[idx] === true);
  });
}

// Días encadenados dentro de la semana en curso, contando hacia atrás.
// Se empieza por hoy si hoy está completo; si no, por ayer: así la racha no se
// rompe por la mañana solo porque el día aún no ha terminado.
// Devuelve { dias, llegaAlLunes } — lo segundo indica si la cadena enlaza con
// la semana anterior y hay que sumar lo arrastrado.
function rachaSemana(state, childId, hoyIdx) {
  let i = diaCompleto(state, childId, hoyIdx) ? hoyIdx : hoyIdx - 1;
  let dias = 0;
  while (i >= 0 && diaCompleto(state, childId, i)) { dias++; i--; }
  return { dias, llegaAlLunes: dias > 0 && i < 0 };
}

// Racha total de un hijo: lo arrastrado de semanas anteriores (solo si la
// cadena sigue viva desde el lunes) más lo encadenado esta semana.
function rachaDe(state, childId, hoyIdx) {
  const { dias, llegaAlLunes } = rachaSemana(state, childId, hoyIdx);
  const arrastre = Math.max(0, Number((state.streakCarry || {})[childId]) || 0);
  return llegaAlLunes ? arrastre + dias : dias;
}

// ¿Son iguales dos mapas de "hijo -> número"?
//
// Se comparan clave a clave y NO con JSON.stringify, porque PostgreSQL
// devuelve el JSONB con las claves reordenadas alfabéticamente. Con stringify,
// {mateo:0, pablo:0, sara:0} y {sara:0, mateo:0, pablo:0} parecían
// distintos: la racha se daba por "cambiada" en cada lectura, el servidor
// guardaba, subía la versión, y había una escritura por cada GET.
function mismosNumeros(a, b) {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Number(a[k]) === Number(b[k]));
}

// Recalcula S.streak para todos los hijos. Devuelve true si algo cambió.
function calcularRachas(state, hoyIdx) {
  const previo = state.streak || {};
  const nuevo = {};
  hijos(state).forEach((c) => { nuevo[c.id] = rachaDe(state, c.id, hoyIdx); });
  state.streak = nuevo;
  return !mismosNumeros(previo, nuevo);
}

// Se llama JUSTO ANTES de vaciar fixedState al cambiar de semana.
// Guarda lo que cada hijo llevaba encadenado al terminar el domingo; si el
// domingo no estaba completo, la racha se ha roto y el arrastre vuelve a 0.
function cerrarSemanaRachas(state) {
  const arrastre = {};
  hijos(state).forEach((c) => {
    arrastre[c.id] = diaCompleto(state, c.id, 6) ? rachaDe(state, c.id, 6) : 0;
  });
  state.streakCarry = arrastre;
}

module.exports = { diaCompleto, rachaSemana, rachaDe, calcularRachas, cerrarSemanaRachas };
