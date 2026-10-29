// ============================================================================
//  Pruebas del calendario: horarios de cada hijo y plantilla semanal de tareas.
//
//  Dos frentes:
//   - SERVIDOR: lo que se guarda tiene que estar limpio, ser de los papás, y
//     no provocar una escritura por cada lectura (la trampa de siempre).
//   - CLIENTE: el botón "Organizar semana" tiene que hacer lo que promete —
//     no poner nada encima del colegio, repartir, y respetar lo que los papás
//     ya movieron a mano.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { cargarCliente } = require("./_cliente");
const { sanitizeState, applyChildLimits } = require("../services/stateGuard");
const { estadoVacio, normalizarCalendario } = require("../services/estadoService");

const { ejec, ponerEstado, leerEstado } = cargarCliente();
const copia = (o) => JSON.parse(JSON.stringify(o));

const COLEGIO = { id: "c1", label: "Colegio", days: [0, 1, 2, 3, 4], ini: "08:00", fin: "14:30" };

function casa(extra = {}) {
  const s = estadoVacio();
  s.currentMonth = "2026-10"; s.currentWeek = "2026-W44";
  // f4 es la única semanal de la semilla; las tres primeras son diarias.
  s.generated = true;
  s.extras = [
    { id: "x1", taskId: "e1", memberId: "mateo", status: "pending", listed: false },
    { id: "x2", taskId: "e2", memberId: "pablo", status: "pending", listed: false },
    { id: "x3", taskId: "e3", memberId: "sara", status: "pending", listed: false },
  ];
  return Object.assign(s, extra);
}

// ---------------------------------------------------------------------------
//  Servidor: saneado
// ---------------------------------------------------------------------------
test("el saneado deja las tres claves de horario aunque no lleguen", () => {
  const s = sanitizeState({ ...casa(), horarios: undefined });
  assert.deepEqual(Object.keys(s.horarios).sort(), ["mateo", "pablo", "sara"]);
  assert.deepEqual(s.horarios.mateo, []);
});

test("el saneado tira los bloques de horario rotos", () => {
  const s = sanitizeState(casa({
    horarios: {
      mateo: [
        COLEGIO,
        { id: "b1", label: "Al revés", days: [1], ini: "19:00", fin: "17:00" },
        { id: "b2", label: "Hora rara", days: [1], ini: "25:00", fin: "26:00" },
        { id: "b3", label: "Sin días", days: [], ini: "10:00", fin: "11:00" },
        { id: "b4", label: "Días raros", days: [9, -1, 2, 2], ini: "10:00", fin: "11:00" },
      ],
      intruso: [COLEGIO],
    },
  }));
  assert.deepEqual(s.horarios.mateo.map((b) => b.id), ["c1", "b4"]);
  assert.deepEqual(s.horarios.mateo[1].days, [2], "fuera de rango y repetidos se van");
  assert.equal(s.horarios.intruso, undefined, "solo hijos de la casa");
});

test("el saneado tira entradas de agenda que ya no casan", () => {
  const s = sanitizeState(casa({
    agenda: [
      { kind: "fixed", taskId: "f4", childId: "mateo", day: 1, slot: "tarde" },   // buena
      { kind: "fixed", taskId: "f1", childId: "mateo", day: 1, slot: "tarde" },   // f1 es diaria
      { kind: "fixed", taskId: "f4", childId: "papas", day: 1, slot: "tarde" },  // no es hijo
      { kind: "extra", taskId: "e1", day: 2, slot: "noche" },                    // buena
      { kind: "extra", taskId: "zz", day: 2, slot: "noche" },                    // no existe
      { kind: "extra", taskId: "e2", day: 9, slot: "noche" },                    // día imposible
      { kind: "extra", taskId: "e3", day: 2, slot: "madrugada" },                // franja inventada
      { kind: "fixed", taskId: "f4", childId: "mateo", day: 4, slot: "noche" },   // duplicada
    ],
  }));
  assert.deepEqual(s.agenda, [
    { kind: "fixed", taskId: "f4", childId: "mateo", day: 1, slot: "tarde" },
    { kind: "extra", taskId: "e1", day: 2, slot: "noche" },
  ]);
});

test("una fija que pasa a diaria sale del calendario", () => {
  const s = casa({ agenda: [{ kind: "fixed", taskId: "f4", childId: "mateo", day: 1, slot: "tarde" }] });
  s.fixedTasks.find((t) => t.id === "f4").freq = "daily";
  assert.deepEqual(sanitizeState(s).agenda, []);
});

// ---------------------------------------------------------------------------
//  Servidor: el calendario es de los papás
// ---------------------------------------------------------------------------
test("un hijo NO puede tocarse el calendario ni los horarios", () => {
  const prev = casa({ agenda: [{ kind: "extra", taskId: "e1", day: 1, slot: "tarde" }] });
  const nuevo = copia(prev);
  nuevo.agenda[0].day = 6;                    // se lo pasa al domingo
  nuevo.horarios.mateo = [COLEGIO];            // y se inventa clase

  const { estado, rechazos } = applyChildLimits(nuevo, prev, "mateo");

  assert.ok(rechazos.includes("agenda"));
  assert.ok(rechazos.includes("horarios"));
  assert.equal(estado.agenda[0].day, 1, "se restaura lo que había");
});

test("un hijo que solo marca su tarea no choca con el calendario", () => {
  const prev = casa({
    horarios: { mateo: [COLEGIO], pablo: [], sara: [] },
    agenda: [{ kind: "fixed", taskId: "f4", childId: "mateo", day: 1, slot: "tarde" }],
  });
  const nuevo = copia(prev);
  nuevo.fixedState = { mateo: { f4: { status: "submitted" } } };
  prev.fixedState = { mateo: { f4: { status: "pending" } } };

  assert.deepEqual(applyChildLimits(nuevo, prev, "mateo").rechazos, []);
});

// ---------------------------------------------------------------------------
//  Servidor: normalización al leer
// ---------------------------------------------------------------------------
test("una casa anterior al calendario recibe los campos, y una vez basta", () => {
  const s = casa();
  delete s.horarios; delete s.agenda;

  assert.equal(normalizarCalendario(s), true, "la primera vez cambia: hay que guardar");
  assert.deepEqual(Object.keys(s.horarios).sort(), ["mateo", "pablo", "sara"]);
  assert.deepEqual(s.agenda, []);
  assert.equal(normalizarCalendario(s), false, "la segunda ya no: si no, escritura por lectura");
});

test("reordenar claves (como hace PostgreSQL) no cuenta como cambio", () => {
  const s = casa({
    horarios: { mateo: [COLEGIO], pablo: [], sara: [] },
    agenda: [{ kind: "fixed", taskId: "f4", childId: "mateo", day: 1, slot: "tarde" }],
  });
  normalizarCalendario(s);
  // Mismo contenido, claves en otro orden
  s.horarios = { sara: [], mateo: [{ fin: "14:30", ini: "08:00", days: [0, 1, 2, 3, 4], label: "Colegio", id: "c1" }], pablo: [] };
  s.agenda = [{ slot: "tarde", day: 1, childId: "mateo", taskId: "f4", kind: "fixed" }];

  assert.equal(normalizarCalendario(s), false);
});

// ---------------------------------------------------------------------------
//  Cliente: tiempo libre
// ---------------------------------------------------------------------------
test("minutosLibres descuenta el colegio de la franja", () => {
  ponerEstado(casa({ horarios: { mateo: [COLEGIO], pablo: [], sara: [] } }));
  assert.equal(ejec(`minutosLibres("mateo",0,"manana")`), 0, "09:00-14:00 entera en el colegio");
  assert.equal(ejec(`minutosLibres("mateo",0,"tarde")`), 330, "14:00-20:00 menos media hora");
  assert.equal(ejec(`minutosLibres("mateo",5,"manana")`), 300, "el sábado no hay colegio");
  // Regresión: con la mañana empezando a las 07:00, la hora previa al colegio
  // contaba como libre y "Organizar" podía poner una tarea un lunes a las 7.
  assert.equal(ejec(`franjaLibre("mateo",0,"manana")`), false);
});

test("dos bloques solapados no se descuentan dos veces", () => {
  ponerEstado(casa({ horarios: {
    mateo: [
      { id: "a", label: "Clase", days: [0], ini: "15:00", fin: "17:00" },
      { id: "b", label: "Repaso", days: [0], ini: "16:00", fin: "18:00" },
    ], pablo: [], sara: [],
  } }));
  assert.equal(ejec(`minutosLibres("mateo",0,"tarde")`), 360 - 180);
});

// ---------------------------------------------------------------------------
//  Cliente: "Organizar semana"
// ---------------------------------------------------------------------------
function planificar() { return JSON.parse(ejec("JSON.stringify(planificarSemana())")); }

test("organizar coloca todo lo pendiente y nunca encima del horario", () => {
  ponerEstado(casa({ horarios: { mateo: [COLEGIO], pablo: [COLEGIO], sara: [COLEGIO] } }));
  const r = planificar();

  // 3 fijas semanales (f4 × 3 hijos) + 3 adicionales repartidas
  assert.equal(r.colocadas, 6);
  assert.equal(r.sinHueco.length, 0);
  r.agenda.forEach((e) => {
    assert.ok(!(e.day < 5 && e.slot === "manana"), "entre semana por la mañana hay colegio: " + JSON.stringify(e));
  });
});

test("organizar reparte: un hijo no acumula dos tareas el mismo día si puede evitarlo", () => {
  ponerEstado(casa());
  const r = planificar();
  const dueno = (e) => e.childId || { e1: "mateo", e2: "pablo", e3: "sara" }[e.taskId];
  ["mateo", "pablo", "sara"].forEach((h) => {
    const dias = r.agenda.filter((e) => dueno(e) === h).map((e) => e.day);
    assert.equal(new Set(dias).size, dias.length, h + " repite día: " + dias);
  });
});

test("organizar no mueve lo que los papás ya colocaron a mano", () => {
  const amano = { kind: "fixed", taskId: "f4", childId: "mateo", day: 6, slot: "noche" };
  ponerEstado(casa({ agenda: [amano] }));
  const r = planificar();
  assert.deepEqual(r.agenda[0], amano);
  assert.equal(r.colocadas, 5, "solo las otras cinco");
});

test("organizar es predecible: dos veces, mismo resultado", () => {
  ponerEstado(casa({ horarios: { mateo: [COLEGIO], pablo: [], sara: [COLEGIO] } }));
  assert.deepEqual(planificar(), planificar());
});

test("si un hijo no tiene ningún hueco, se dice en vez de colocarlo mal", () => {
  const todoOcupado = { id: "x", label: "Campamento", days: [0, 1, 2, 3, 4, 5, 6], ini: "07:00", fin: "23:00" };
  ponerEstado(casa({ horarios: { mateo: [todoOcupado], pablo: [], sara: [] } }));
  const r = planificar();

  assert.deepEqual(r.sinHueco.map((p) => p.hijo).sort(), ["mateo", "mateo"], "su fija y su adicional");
  assert.ok(!r.agenda.some((e) => e.childId === "mateo" || e.taskId === "e1"));
});

// ---------------------------------------------------------------------------
//  Cliente: lectura de la agenda
// ---------------------------------------------------------------------------
test("una adicional que cambia de dueño en el mercado sigue en su sitio, con el nuevo", () => {
  ponerEstado(casa({
    horarios: { mateo: [], pablo: [COLEGIO], sara: [] },
    agenda: [{ kind: "extra", taskId: "e1", day: 0, slot: "manana" }],
  }));
  let it = JSON.parse(ejec("JSON.stringify(itemsAgenda()[0])"));
  assert.equal(it.hijo, "mateo");
  assert.equal(it.conflicto, false);

  // Pablo se la queda en el mercado… y el lunes por la mañana tiene colegio.
  ejec(`S.extras.find(x=>x.taskId==="e1").memberId="pablo"`);
  it = JSON.parse(ejec("JSON.stringify(itemsAgenda()[0])"));
  assert.equal(it.hijo, "pablo");
  assert.equal(it.conflicto, true, "hay que avisar a los papás");
});

test("leer la agenda no la modifica (si no, bucle de repintado)", () => {
  const s = casa();
  delete s.horarios; delete s.agenda;            // casa antigua tal cual llega
  ponerEstado(s);
  ejec("S.profile='mateo'; itemsAgenda(); sinColocar(); planificarSemana(); tarjetaHoy('mateo'); mSemana(); dAgenda();");
  const despues = leerEstado();
  assert.equal(despues.horarios, undefined);
  assert.equal(despues.agenda, undefined);
});

test("diasTexto resume los días para que quepa en una línea", () => {
  assert.equal(ejec("diasTexto([0,1,2,3,4])"), "L–V");
  assert.equal(ejec("diasTexto([1,3])"), "M, J");
  assert.equal(ejec("diasTexto([5,6])"), "S, D");
});
