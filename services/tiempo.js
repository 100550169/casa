// ============================================================================
//  Fechas en el huso de la casa.
//
//  Todo lo que depende del día (cambio de semana y de mes, la racha, el
//  recordatorio de "hoy te toca", la copia diaria) lo decide el SERVIDOR con
//  este reloj. Antes lo disparaba el reloj de cada dispositivo: bastaba con que
//  un móvil tuviera la fecha mal puesta para reiniciar el mes de toda la casa.
// ============================================================================
const TZ = process.env.TZ_FAMILIA || "Europe/Madrid";

// La fecha de hoy en la casa, como medianoche UTC de ese día. Así las cuentas
// de días no dependen del huso del servidor (Render corre en UTC).
function fechaLocal(d = new Date()) {
  const [y, m, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dia));
}

function claveMes(d = fechaLocal()) {
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

// "YYYY-MM-DD"
function claveDia(d = fechaLocal()) {
  return d.toISOString().slice(0, 10);
}

// Semana ISO-8601 "YYYY-Www" (empieza en lunes)
function claveSemana(d = fechaLocal()) {
  const t = new Date(d.getTime());
  const dia = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dia + 3);
  const primerJue = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const sem = 1 + Math.round(((t - primerJue) / 86400000 - 3 + ((primerJue.getUTCDay() + 6) % 7)) / 7);
  return t.getUTCFullYear() + "-W" + String(sem).padStart(2, "0");
}

// Día de la semana en el huso de la casa. 0 = lunes … 6 = domingo.
const hoyIdx = (d = fechaLocal()) => (d.getUTCDay() + 6) % 7;

// Minutos desde medianoche, en la hora de la casa (con su cambio de horario).
function minutosLocales(d = new Date()) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(d).split(":").map(Number);
  return h * 60 + m;
}

module.exports = { TZ, fechaLocal, claveMes, claveDia, claveSemana, hoyIdx, minutosLocales };
