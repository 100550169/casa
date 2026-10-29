// ============================================================================
//  Pruebas de qué se avisa y a quién.
//
//  La regla: se avisa a quien le importa, NUNCA a quien hizo el cambio. Si los
//  avisos molestan (por repetidos, por llegarle a quien no es, por llegar en
//  bloque), la familia los desactiva y se pierde lo que se buscaba.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { avisosDeCambio, recordatoriosDelDia, agrupar, enumerar } = require("../services/avisos");
const { endpointValido, validarSuscripcion } = require("../services/push");
const { estadoVacio } = require("../services/estadoService");

const copia = (o) => JSON.parse(JSON.stringify(o));

function casa() {
  const s = estadoVacio();
  s.generated = true;
  s.fixedState = {
    mateo: { f1: { days: [true, false, false, false, false, false, false] }, f4: { status: "pending" } },
    pablo: { f1: { days: [false, false, false, false, false, false, false] }, f4: { status: "pending" } },
    sara: { f1: { days: [true, true, true, true, true, true, true] }, f4: { status: "pending" } },
  };
  s.extras = [
    { id: "x1", taskId: "e1", memberId: "sara", status: "pending", listed: false },
    { id: "x2", taskId: "e4", memberId: "mateo", status: "pending", listed: false },
  ];
  return s;
}

// ---------------------------------------------------------------------------
//  Al guardar
// ---------------------------------------------------------------------------
test("un hijo entrega una tarea: aviso a los papás, no a él", () => {
  const antes = casa(), despues = copia(antes);
  despues.extras[0].status = "submitted";
  const a = avisosDeCambio(antes, despues);
  assert.equal(a.length, 1);
  assert.equal(a[0].para, "papas");
  assert.match(a[0].titulo, /Sara ha hecho «Limpiar el baño»/);
});

test("los papás aprueban: aviso al hijo, con los puntos", () => {
  const antes = casa(); antes.extras[0].status = "submitted";
  const despues = copia(antes); despues.extras[0].status = "approved";
  const [a] = avisosDeCambio(antes, despues);
  assert.equal(a.para, "sara");
  assert.match(a.titulo, /Aprobada/);
  assert.match(a.cuerpo, /\+40 puntos/);
});

test("los papás la devuelven: aviso al hijo para que la repase", () => {
  const antes = casa(); antes.fixedState.mateo.f4.status = "submitted";
  const despues = copia(antes); despues.fixedState.mateo.f4.status = "pending";
  const [a] = avisosDeCambio(antes, despues);
  assert.equal(a.para, "mateo");
  assert.match(a.titulo, /repaso/);
});

test("marcar una tarea DIARIA no avisa (no pasa por validación)", () => {
  const antes = casa(), despues = copia(antes);
  despues.fixedState.pablo.f1.days[2] = true;
  assert.deepEqual(avisosDeCambio(antes, despues), []);
});

test("el cierre de mes (vencidas) no manda un aluvión de avisos", () => {
  const antes = casa(), despues = copia(antes);
  despues.extras.forEach((x) => { x.status = "late"; });
  assert.deepEqual(avisosDeCambio(antes, despues), []);
});

test("un reparto nuevo no se toma por cambios de estado", () => {
  const antes = casa(), despues = copia(antes);
  despues.extras.push({ id: "x9", taskId: "e2", memberId: "pablo", status: "pending", listed: false });
  assert.deepEqual(avisosDeCambio(antes, despues), []);
});

test("pedir un premio avisa a los papás; resolverlo, al hijo", () => {
  const antes = casa();
  const pedido = copia(antes);
  pedido.redemptions = [{ id: "c1", rewardId: "r1", childId: "pablo", cost: 60, status: "pending", at: 1 }];
  const [a] = avisosDeCambio(antes, pedido);
  assert.equal(a.para, "papas");
  assert.match(a.titulo, /Pablo pide «1 h más de pantalla»/);

  const concedido = copia(pedido); concedido.redemptions[0].status = "approved";
  assert.equal(avisosDeCambio(pedido, concedido)[0].para, "pablo");
  const denegado = copia(pedido); denegado.redemptions[0].status = "denied";
  assert.match(avisosDeCambio(pedido, denegado)[0].cuerpo, /Recuperas tus puntos/);
});

test("mercado: la oferta avisa al vendedor; la respuesta, al que ofreció", () => {
  const antes = casa();
  antes.listings = [{ id: "l1", sellerId: "mateo", assignmentId: "x2", taskId: "e4", status: "open" }];
  const oferta = copia(antes);
  oferta.offers = [{ id: "o1", listingId: "l1", bidderId: "sara", kind: "take", status: "pending" }];
  const [a] = avisosDeCambio(antes, oferta);
  assert.equal(a.para, "mateo");
  assert.match(a.titulo, /Sara quiere quedarse «Sacar la basura»/);

  const aceptada = copia(oferta); aceptada.offers[0].status = "accepted";
  const [b] = avisosDeCambio(oferta, aceptada);
  assert.equal(b.para, "sara");
  assert.match(b.titulo, /acepta/);
});

test("muchos avisos para la misma persona se juntan en uno", () => {
  const grupo = agrupar([
    { para: "mateo", titulo: "A", cuerpo: "" },
    { para: "mateo", titulo: "B", cuerpo: "" },
    { para: "papas", titulo: "C", cuerpo: "" },
  ]);
  assert.equal(grupo.length, 2);
  const deMateo = grupo.find((a) => a.para === "mateo");
  assert.match(deMateo.titulo, /2 novedades/);
  assert.match(deMateo.cuerpo, /A · B/);
});

// ---------------------------------------------------------------------------
//  Recordatorio de la tarde
// ---------------------------------------------------------------------------
test("recuerda a cada hijo lo planificado para hoy y lo que no ha marcado", () => {
  const s = casa();
  s.agenda = [
    { kind: "extra", taskId: "e4", day: 1, slot: "noche" },                      // Mateo, martes
    { kind: "fixed", taskId: "f4", childId: "pablo", day: 1, slot: "tarde" },   // Pablo, martes
    { kind: "extra", taskId: "e1", day: 3, slot: "tarde" },                      // Sara, jueves
  ];
  const r = recordatoriosDelDia(s, 1);                       // martes
  const de = (id) => r.find((a) => a.para === id);

  assert.match(de("mateo").cuerpo, /Sacar la basura/);
  assert.match(de("mateo").cuerpo, /y marca: Hacer la cama/, "las diarias sin marcar hoy");
  assert.match(de("pablo").titulo, /Hoy te toca, Pablo/);
  assert.equal(de("sara"), undefined, "lo de Sara es el jueves y sus diarias están hechas");
});

test("quien lo tiene todo hecho no recibe recordatorio", () => {
  const s = casa();
  s.fixedState.sara = { f1: { days: [true, true, true, true, true, true, true] }, f2: { days: Array(7).fill(true) }, f3: { days: Array(7).fill(true) }, f4: { status: "approved" } };
  s.agenda = [{ kind: "extra", taskId: "e1", day: 1, slot: "tarde" }];
  s.extras[0].status = "submitted";                         // ya la entregó
  const r = recordatoriosDelDia(s, 1);
  assert.equal(r.find((a) => a.para === "sara"), undefined);
});

test("una tarea puesta en el mercado no se recuerda", () => {
  const s = casa();
  s.agenda = [{ kind: "extra", taskId: "e4", day: 1, slot: "noche" }];
  s.extras[1].listed = true;
  const mateo = recordatoriosDelDia(s, 1).find((a) => a.para === "mateo");
  assert.ok(!mateo || !mateo.cuerpo.includes("Sacar la basura"));
});

test("a los papás se les recuerda lo que espera su visto bueno", () => {
  const s = casa();
  s.extras[0].status = "submitted";
  s.fixedState.mateo.f4.status = "submitted";
  s.redemptions = [{ id: "c1", rewardId: "r1", childId: "mateo", cost: 60, status: "pending" }];
  const papas = recordatoriosDelDia(s, 0).find((a) => a.para === "papas");
  assert.match(papas.cuerpo, /2 tareas por validar y 1 premio pedido/);
});

test("enumerar recorta las listas largas", () => {
  assert.equal(enumerar(["a", "b"]), "a, b");
  assert.equal(enumerar(["a", "b", "c", "d", "e"]), "a, b, c y 2 más");
});

// ---------------------------------------------------------------------------
//  Suscripciones: solo de servicios de avisos reales
// ---------------------------------------------------------------------------
test("solo se aceptan direcciones de los servicios de avisos reales", () => {
  [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/QGx9",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-par02p.notify.windows.com/w/?token=1",
  ].forEach((u) => assert.equal(endpointValido(u), true, u));

  [
    "http://fcm.googleapis.com/fcm/send/abc",           // sin https
    "https://localhost/push",                           // el propio servidor
    "https://169.254.169.254/latest/meta-data",         // metadatos de la nube
    "https://fcm.googleapis.com.malo.com/x",            // parecido no vale
    "https://evilweb.push.apple.com.attacker.net/",
    "javascript:alert(1)",
    "",
  ].forEach((u) => assert.equal(endpointValido(u), false, u));
});

test("una suscripción sin claves válidas se rechaza", () => {
  const buena = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
  assert.ok(validarSuscripcion(buena));
  assert.equal(validarSuscripcion({ ...buena, keys: { p256dh: "<x>", auth: "y" } }), null);
  assert.equal(validarSuscripcion({ endpoint: buena.endpoint }), null);
  assert.equal(validarSuscripcion(null), null);
});

// ---------------------------------------------------------------------------
//  Ventana del recordatorio
//
//  GitHub llegó a lanzar el de las 18:00 a las 22:31. Un aviso a esas horas no
//  sirve (o despierta a alguien): el servidor solo manda de 17:00 a 21:30.
// ---------------------------------------------------------------------------
test("el recordatorio solo sale entre las 17:00 y las 21:30", () => {
  const { dentroDeVentana } = require("../routes/push");
  const h = (hh, mm = 0) => hh * 60 + mm;
  assert.equal(dentroDeVentana(h(16, 59)), false, "antes de las 17:00");
  assert.equal(dentroDeVentana(h(17, 0)), true);
  assert.equal(dentroDeVentana(h(19, 45)), true);
  assert.equal(dentroDeVentana(h(21, 29)), true);
  assert.equal(dentroDeVentana(h(21, 30)), false, "a las 21:30 ya no");
  assert.equal(dentroDeVentana(h(22, 31)), false, "como pasó en octubre");
});

test("la hora local respeta el cambio de horario de Madrid", () => {
  const { minutosLocales } = require("../services/tiempo");
  // 17:00 UTC: en invierno son las 18:00 en Madrid; en verano, las 19:00.
  assert.equal(minutosLocales(new Date("2026-12-15T17:00:00Z")), 18 * 60);
  assert.equal(minutosLocales(new Date("2026-07-15T17:00:00Z")), 19 * 60);
  // Pasada la medianoche UTC sigue siendo la hora de allí, no la del servidor.
  assert.equal(minutosLocales(new Date("2026-12-15T23:30:00Z")), 30);
});
