// ============================================================================
//  Pruebas de las rachas.
//  Antes eran números escritos a mano; ahora se calculan y hay que demostrar
//  que suben, que se cortan y que sobreviven al cambio de semana.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { diaCompleto, rachaDe, calcularRachas, cerrarSemanaRachas } =
  require("../services/rachas");

const IRENE = "irene-uuid";
const LUN = 0, MAR = 1, MIE = 2, JUE = 3, VIE = 4, SAB = 5, DOM = 6;

// dias: array de índices marcados, por tarea
function estado({ f1 = [], f2 = [], carry = null, conSemanal = true } = {}) {
  const marcar = (idxs) => {
    const d = [false, false, false, false, false, false, false];
    idxs.forEach((i) => { d[i] = true; });
    return d;
  };
  const tareas = [
    { id: "f1", name: "Cama", icon: "🛏️", freq: "daily" },
    { id: "f2", name: "Plato", icon: "🍽️", freq: "daily" },
  ];
  if (conSemanal) tareas.push({ id: "f3", name: "Lavadora", icon: "🧺", freq: "weekly" });
  const s = {
    members: [{ id: IRENE, name: "Irene", role: "child", color: "#e0588f", load: "normal" }],
    fixedTasks: tareas,
    fixedState: { [IRENE]: { f1: { days: marcar(f1) }, f2: { days: marcar(f2) } } },
    streak: {},
  };
  if (conSemanal) s.fixedState[IRENE].f3 = { status: "pending" };
  if (carry) s.streakCarry = carry;
  return s;
}

test("un día solo cuenta si están TODAS las tareas diarias", () => {
  const s = estado({ f1: [LUN], f2: [] });
  assert.equal(diaCompleto(s, IRENE, LUN), false, "falta f2");

  const s2 = estado({ f1: [LUN], f2: [LUN] });
  assert.equal(diaCompleto(s2, IRENE, LUN), true);
});

test("la tarea SEMANAL no cuenta para la racha", () => {
  // f3 está pendiente y aun así el lunes cuenta: las semanales no son diarias
  const s = estado({ f1: [LUN], f2: [LUN] });
  assert.equal(diaCompleto(s, IRENE, LUN), true);
});

test("cuenta los días seguidos hasta hoy", () => {
  const s = estado({ f1: [LUN, MAR, MIE], f2: [LUN, MAR, MIE] });
  assert.equal(rachaDe(s, IRENE, MIE), 3);
});

test("un hueco corta la racha", () => {
  // lunes sí, martes no, miércoles sí → desde el miércoles solo cuenta 1
  const s = estado({ f1: [LUN, MIE], f2: [LUN, MIE] });
  assert.equal(rachaDe(s, IRENE, MIE), 1);
});

test("si hoy aún no está hecho, la racha no se rompe (cuenta hasta ayer)", () => {
  // Lun y Mar completos; hoy es miércoles y todavía no ha marcado nada.
  const s = estado({ f1: [LUN, MAR], f2: [LUN, MAR] });
  assert.equal(rachaDe(s, IRENE, MIE), 2, "sigue viva hasta que acabe el día");
});

test("si ayer tampoco estaba hecho, la racha es 0", () => {
  const s = estado({ f1: [LUN], f2: [LUN] });
  assert.equal(rachaDe(s, IRENE, MIE), 0, "lunes sí, martes no, hoy miércoles");
});

test("sin tareas diarias no hay racha", () => {
  const s = estado({ f1: [LUN], f2: [LUN] });
  s.fixedTasks = [{ id: "f3", name: "Lavadora", icon: "🧺", freq: "weekly" }];
  assert.equal(rachaDe(s, IRENE, LUN), 0);
});

test("la racha arrastrada se suma si la cadena llega al lunes", () => {
  const s = estado({ f1: [LUN, MAR], f2: [LUN, MAR], carry: { [IRENE]: 5 } });
  // 5 arrastrados + lunes y martes de esta semana
  assert.equal(rachaDe(s, IRENE, MAR), 7);
});

test("la racha arrastrada NO se suma si la cadena no llega al lunes", () => {
  // El lunes falló: lo de la semana pasada ya no enlaza
  const s = estado({ f1: [MAR, MIE], f2: [MAR, MIE], carry: { [IRENE]: 5 } });
  assert.equal(rachaDe(s, IRENE, MIE), 2);
});

test("al cerrar la semana se arrastra si el domingo estaba completo", () => {
  const todos = [LUN, MAR, MIE, JUE, VIE, SAB, DOM];
  const s = estado({ f1: todos, f2: todos });
  cerrarSemanaRachas(s);
  assert.equal(s.streakCarry[IRENE], 7, "semana perfecta: arrastra 7");
});

test("al cerrar la semana NO se arrastra si el domingo falló", () => {
  const s = estado({ f1: [LUN, MAR, MIE, JUE, VIE, SAB], f2: [LUN, MAR, MIE, JUE, VIE, SAB] });
  cerrarSemanaRachas(s);
  assert.equal(s.streakCarry[IRENE], 0, "se rompió el domingo");
});

test("el arrastre encadena entre semanas", () => {
  const todos = [LUN, MAR, MIE, JUE, VIE, SAB, DOM];
  const s = estado({ f1: todos, f2: todos, carry: { [IRENE]: 7 } });
  cerrarSemanaRachas(s);
  assert.equal(s.streakCarry[IRENE], 14, "7 anteriores + 7 de esta semana");
});

test("calcularRachas rellena S.streak e informa si cambió", () => {
  const s = estado({ f1: [LUN, MAR], f2: [LUN, MAR] });
  assert.equal(calcularRachas(s, MAR), true, "la primera vez cambia");
  assert.equal(s.streak[IRENE], 2);
  assert.equal(calcularRachas(s, MAR), false, "la segunda ya no (no repinta en bucle)");
});

test("la racha que venía escrita a mano se sustituye por la real", () => {
  const s = estado({ f1: [LUN], f2: [LUN] });
  s.streak = { [IRENE]: 999 };          // valor inventado, como el de la semilla vieja
  calcularRachas(s, LUN);
  assert.equal(s.streak[IRENE], 1, "manda lo que dicen las casillas");
});
