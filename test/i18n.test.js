// ============================================================================
//  Idiomas: el catálogo de public/i18n.js y cómo se aplica.
//
//  La interfaz se escribe en español y se traduce al vuelo. Lo que importa:
//    - el español nunca se toca (es el idioma de origen),
//    - solo se traduce un texto que coincide ENTERO con el catálogo, para no
//      traducir por accidente los datos de la casa,
//    - en las frases con partes variables, esas partes se copian tal cual,
//    - los avisos push salen en el idioma de cada móvil.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  IDIOMAS, IDIOMA_ORIGEN, normalizarIdioma, localeDe, diasCortos, diasLargos, nombresMeses,
  traducirFrase, traducirMensaje, traducirAviso,
} = require("../public/i18n.js");
const { avisosDeCambio } = require("../services/avisos");

test("hay dos idiomas y el de origen es el español", () => {
  assert.deepEqual(IDIOMAS.map((i) => i.id), ["es", "en"]);
  assert.equal(IDIOMA_ORIGEN, "es");
});

test("un idioma desconocido o vacío se queda en español", () => {
  assert.equal(normalizarIdioma("fr"), "es");
  assert.equal(normalizarIdioma(undefined), "es");
  assert.equal(normalizarIdioma("en"), "en");
  assert.equal(localeDe("en"), "en-GB");
  assert.equal(localeDe("xx"), "es-ES");
});

test("el español es el idioma de origen: nunca se traduce", () => {
  assert.equal(traducirFrase("Resumen de la casa", "es"), "Resumen de la casa");
});

test("una frase del catálogo se traduce conservando los espacios de los lados", () => {
  assert.equal(traducirFrase("Resumen de la casa", "en"), "Household overview");
  assert.equal(traducirFrase("  Calendario ", "en"), "  Calendar ");
});

test("los espacios interiores de la plantilla no impiden encontrar la frase", () => {
  assert.equal(traducirFrase("Tareas\n      fijas", "en"), "Fixed chores");
});

test("lo que no está en el catálogo se deja tal cual (los datos de la casa)", () => {
  assert.equal(traducirFrase("Limpiar el garaje", "en"), "Limpiar el garaje");
  assert.equal(traducirFrase("Resumen de la casa de Mateo", "en"), "Resumen de la casa de Mateo",
    "solo cuenta la coincidencia completa");
});

test("los patrones copian las partes variables sin traducirlas", () => {
  assert.equal(traducirFrase("Hola, Mateo", "en"), "Hi, Mateo");
  assert.equal(traducirFrase("Nivel 2 · 74 pts este mes", "en"), "Level 2 · 74 pts this month");
  assert.equal(traducirFrase("Te faltan 46 pts", "en"), "You need 46 more pts");
  assert.equal(traducirFrase("De 64 pts, tienes 40 pedidos", "en"), "40 of your 64 pts are on hold",
    "el orden de las partes puede cambiar");
});

test("una parte variable que es una frase del catálogo sí se traduce", () => {
  assert.equal(traducirFrase("Lun por la mañana", "en"), "Mon morning");
  assert.equal(traducirFrase("Privilegio · quedan 1", "en"), "Privilege · 1 left");
});

test("los mensajes de varios párrafos se traducen párrafo a párrafo", () => {
  const m = "¿Volver la casa a como estaba el 28 oct?\n\nLo de ahora se guarda antes como copia: se puede deshacer.";
  assert.equal(traducirMensaje(m, "en"),
    "Restore the household to how it was on 28 oct?\n\nThe current state is saved as a backup first: it can be undone.");
});

test("días y meses salen del idioma, no del catálogo (las iniciales chocarían con los avatares)", () => {
  assert.deepEqual(diasCortos("en"), ["M", "T", "W", "T", "F", "S", "S"]);
  assert.equal(diasLargos("es")[2], "miércoles");
  assert.equal(nombresMeses("en")[9], "October");
  assert.equal(traducirFrase("M", "en"), "M", "una inicial suelta nunca se traduce");
});

test("un aviso push se traduce entero; en español no cambia", () => {
  const aviso = { para: "papas", titulo: "✅ Mateo ha hecho «Poner una lavadora»", cuerpo: "Toca darle el visto bueno.", etiqueta: "x" };
  assert.deepEqual(traducirAviso(aviso, "es"), aviso);
  const en = traducirAviso(aviso, "en");
  assert.equal(en.titulo, "✅ Mateo finished “Poner una lavadora”");
  assert.equal(en.cuerpo, "Time to approve it.");
  assert.equal(en.etiqueta, "x");
});

test("los avisos agrupados se traducen trozo a trozo", () => {
  const aviso = { titulo: "🔔 2 novedades en Casa", cuerpo: "👏 ¡Aprobada! «A» · 🎉 Te conceden «B»" };
  const en = traducirAviso(aviso, "en");
  assert.equal(en.titulo, "🔔 2 updates in Casa");
  assert.equal(en.cuerpo, "👏 Approved! “A” · 🎉 You got “B”");
});

test("todos los textos que genera avisos.js tienen traducción", () => {
  const casa = {
    members: [{ id: "mateo", name: "Mateo", role: "child" }, { id: "papas", name: "Papás", role: "parent" }],
    fixedTasks: [{ id: "f4", name: "Lavadora", freq: "weekly" }],
    extraTasks: [{ id: "e1", name: "Baño", points: 40 }],
    fixedState: { mateo: { f4: { status: "pending" } } },
    extras: [{ id: "x1", taskId: "e1", memberId: "mateo", status: "pending" }],
    rewards: [{ id: "r1", title: "Peli", cost: 40 }],
    redemptions: [],
  };
  const pasos = [
    (s) => { s.fixedState.mateo.f4.status = "submitted"; },
    (s) => { s.fixedState.mateo.f4.status = "approved"; },
    (s) => { s.extras[0].status = "submitted"; },
    (s) => { s.extras[0].status = "pending"; },
    (s) => { s.redemptions.push({ id: "c1", rewardId: "r1", childId: "mateo", cost: 40, status: "pending" }); },
    (s) => { s.redemptions[0].status = "approved"; },
  ];
  let antes = JSON.parse(JSON.stringify(casa));
  pasos.forEach((paso) => {
    const despues = JSON.parse(JSON.stringify(antes));
    paso(despues);
    avisosDeCambio(antes, despues).forEach((a) => {
      const en = traducirAviso(a, "en");
      assert.notEqual(en.titulo, a.titulo, "sin traducir: " + a.titulo);
      assert.notEqual(en.cuerpo, a.cuerpo, "sin traducir: " + a.cuerpo);
    });
    antes = despues;
  });
});
