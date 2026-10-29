// ============================================================================
//  Pruebas del código de casa.
//
//  Es la única puerta de la casa: sin él no se lee ni se borra nada. Por eso
//  conviene tener atadas las tres cosas que importan:
//    - que sin código configurado la casa sigue funcionando (no deja a nadie
//      fuera por desplegar sin haberlo puesto),
//    - que con código, sin él no se pasa,
//    - que no se puede probar códigos sin fin.
// ============================================================================
const test = require("node:test");
const assert = require("node:assert");
const { crearGuardia, generarCodigo, normalizarCodigo } = require("../services/codigoCasa");
const { cargarCliente } = require("./_cliente");

// Petición y respuesta falsas, lo justo para el middleware.
function llamar(guardia, { codigo, ip = "1.2.3.4" } = {}) {
  const req = { ip, get: (h) => (h === "X-Casa" ? codigo : undefined) };
  const out = { status: 200, siguio: false, cabeceras: {} };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
    set(k, v) { out.cabeceras[k] = v; return this; },
  };
  guardia.middleware(req, res, () => { out.siguio = true; });
  return out;
}

test("sin CODIGO_CASA la casa sigue abierta (como antes)", () => {
  const g = crearGuardia({ codigo: "" });
  assert.equal(g.activo, false);
  assert.equal(llamar(g).siguio, true);
});

test("con código, sin él no se pasa", () => {
  const g = crearGuardia({ codigo: "ABCD-EFGH-JKMN" });
  const r = llamar(g);
  assert.equal(r.siguio, false);
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "codigo_casa");
});

test("el código bueno pasa, escrito como sea", () => {
  const g = crearGuardia({ codigo: "ABCD-EFGH-JKMN" });
  ["ABCD-EFGH-JKMN", "abcdefghjkmn", " abcd efgh jkmn ", "Abcd-Efgh-Jkmn"].forEach((c) => {
    assert.equal(llamar(g, { codigo: c }).siguio, true, c);
  });
});

test("un código parecido no vale", () => {
  const g = crearGuardia({ codigo: "ABCD-EFGH-JKMN" });
  ["ABCD-EFGH-JKMP", "ABCDEFGHJKM", "ABCD-EFGH-JKMN-X"].forEach((c) => {
    assert.equal(llamar(g, { codigo: c }).status, 401, c);
  });
});

test("tras muchos intentos fallidos se bloquea esa IP, incluso con el código bueno", () => {
  let reloj = 0;
  const g = crearGuardia({ codigo: "ABCD-EFGH-JKMN", maxFallos: 5, ventanaMs: 1000, ahora: () => reloj });
  for (let i = 0; i < 5; i++) assert.equal(llamar(g, { codigo: "MALO" + i }).status, 401);

  // Bloqueada: ya no se compara, así que tampoco sirve para adivinar.
  const r = llamar(g, { codigo: "ABCD-EFGH-JKMN" });
  assert.equal(r.status, 429);
  assert.ok(r.cabeceras["Retry-After"]);

  // Otra IP (otro móvil fuera de casa) no paga los platos rotos
  assert.equal(llamar(g, { codigo: "ABCD-EFGH-JKMN", ip: "9.9.9.9" }).siguio, true);

  // Pasado el tiempo, vuelve a dejar probar
  reloj = 2000;
  assert.equal(llamar(g, { codigo: "ABCD-EFGH-JKMN" }).siguio, true);
});

test("abrir la app sin código no gasta intentos", () => {
  const g = crearGuardia({ codigo: "ABCD-EFGH-JKMN", maxFallos: 2 });
  for (let i = 0; i < 10; i++) assert.equal(llamar(g).status, 401);
  assert.equal(llamar(g, { codigo: "ABCD-EFGH-JKMN" }).siguio, true, "un móvil nuevo no se bloquea solo");
});

test("generarCodigo da códigos legibles y distintos", () => {
  const vistos = new Set();
  for (let i = 0; i < 200; i++) {
    const c = generarCodigo();
    assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.doesNotMatch(c, /[ILO01]/, "sin letras que se confundan");
    vistos.add(c);
  }
  assert.equal(vistos.size, 200);
  assert.equal(normalizarCodigo("ab-cd 12"), "ABCD12");
});

// ---------------------------------------------------------------------------
//  Cliente: el enlace que mandan los papás
// ---------------------------------------------------------------------------
test("el cliente lee el código del enlace (#casa=…)", () => {
  const { ejec } = cargarCliente();
  assert.equal(ejec(`leerCodigoDeEnlace("#casa=ABCD-EFGH-JKMN")`), "ABCD-EFGH-JKMN");
  assert.equal(ejec(`leerCodigoDeEnlace("#demo&casa=abcd%20efgh")`), "abcd efgh");
  assert.equal(ejec(`leerCodigoDeEnlace("#otra-cosa")`), "");
  assert.equal(ejec(`leerCodigoDeEnlace("#casa=<script>")`), "", "nada raro entra por el enlace");
});
