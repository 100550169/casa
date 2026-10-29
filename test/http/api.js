// ============================================================================
//  Pruebas extremo a extremo de la API, contra un servidor de verdad.
//
//  `npm test` prueba la lógica, pero no pasa por la capa HTTP (Express, el
//  código de casa, las rutas, los errores). Una actualización de Express podía
//  romper el servidor y las pruebas seguir en verde: pasó con Express 5, que
//  rompía /demo. Esto lo cubre.
//
//  Necesita el servidor arrancado contra un PostgreSQL VACÍO (lo escribe) y con
//  CODIGO_CASA puesto:
//
//    docker run -d --name casa-pg -e POSTGRES_PASSWORD=prueba -e POSTGRES_DB=casa -p 55432:5432 postgres:16-alpine
//    DATABASE_URL=postgres://postgres:prueba@localhost:55432/casa?sslmode=disable \
//      CODIGO_CASA=PRUE-BA12-3456 npm start
//    npm run test:http                      # en otra terminal
//
//  En GitHub lo hace solo .github/workflows/tests.yml.
//  NUNCA contra la casa de verdad: reinicia el estado y lo restaura.
// ============================================================================
const crypto = require("crypto");

const BASE = process.env.CASA_URL || process.argv[2] || "http://localhost:3000";
const CODIGO = process.env.CODIGO_CASA || "PRUE-BA12-3456";

if (/onrender\.com/.test(BASE)) {
  console.error("Estas pruebas escriben y reinician el estado: no se lanzan contra la casa de verdad.");
  process.exit(2);
}

let ok = 0, mal = 0;
const check = (cond, msg, extra) => {
  if (cond) { ok++; console.log("  ✔", msg); }
  else { mal++; console.log("  ✖", msg, extra !== undefined ? JSON.stringify(extra) : ""); }
};

async function pedir(ruta, { metodo = "GET", perfil = "papas", codigo = CODIGO, cuerpo, crudo, tipo, ip } = {}) {
  const h = { "X-Perfil": perfil };
  if (codigo !== null) h["X-Casa"] = codigo;
  if (ip) h["X-Forwarded-For"] = ip;
  let body;
  if (crudo !== undefined) { body = crudo; h["Content-Type"] = tipo || "application/json"; }
  else if (cuerpo !== undefined) { body = JSON.stringify(cuerpo); h["Content-Type"] = "application/json"; }
  const r = await fetch(BASE + ruta, { method: metodo, headers: h, body });
  const texto = await r.text();
  let data = null; try { data = JSON.parse(texto); } catch (e) {}
  return { status: r.status, data, texto, headers: r.headers };
}

(async () => {
  console.log("1. Lo que se sirve");
  let r = await pedir("/", { codigo: null });
  check(r.status === 200 && r.texto.includes("<title>"), "la app se sirve en /");
  r = await pedir("/demo", { codigo: null });
  check(r.status === 200 && r.texto.includes("<title>"), "/demo sirve la app (Express 5 la rompía)");
  r = await pedir("/perfiles.js", { codigo: null });
  check(r.status === 200 && /javascript/.test(r.headers.get("content-type") || ""), "archivos estáticos con su tipo");
  r = await pedir("/sw.js", { codigo: null });
  check(r.status === 200 && r.texto.includes("notificationclick"), "service worker con avisos");
  r = await pedir("/.well-known/assetlinks.json", { codigo: null });
  check(r.status === 503 && r.data, "assetlinks sin huella: 503 JSON");

  console.log("2. Código de casa");
  r = await pedir("/api/health", { codigo: null });
  check(r.status === 200 && r.data.protegida === true, "health es público y dice protegida:true", r.data);
  check(r.headers.get("x-powered-by") === null, "sin cabecera x-powered-by");
  check(r.headers.get("x-robots-tag") === "noindex, nofollow", "noindex activado");
  r = await pedir("/api/state", { codigo: null });
  check(r.status === 401 && r.data.error === "codigo_casa", "sin código: 401", r.status);
  r = await pedir("/api/state", { codigo: "MALO-MALO-MALO", ip: "10.0.0.1" });
  check(r.status === 401, "código equivocado: 401");
  r = await pedir("/api/reset", { metodo: "POST", codigo: null });
  check(r.status === 401, "reiniciar la casa sin código: 401", r.status);
  r = await pedir("/api/state", { codigo: CODIGO.toLowerCase().replace(/-/g, " ") });
  check(r.status === 200 && r.data.horarios, "código bueno, escrito en minúsculas y con espacios: 200");
  const estado0 = r.data;

  let ultimo;
  for (let i = 0; i < 31; i++) ultimo = await pedir("/api/state", { codigo: "X" + i, ip: "10.9.9.9" });
  check(ultimo.status === 429, "31 intentos fallidos seguidos: 429", ultimo.status);
  r = await pedir("/api/state", { ip: "10.9.9.9" });
  check(r.status === 429, "bloqueada incluso con el código bueno");
  r = await pedir("/api/state", { ip: "10.8.8.8" });
  check(r.status === 200, "otra IP no se ve afectada");

  console.log("3. Errores de quien llama");
  r = await pedir("/api/no-existe");
  check(r.status === 404 && r.data && r.data.error === "no_encontrado", "ruta /api desconocida: 404 JSON");
  r = await pedir("/api/state", { metodo: "PUT" });
  check(r.status === 400 && r.data.error === "estado_invalido", "PUT sin cuerpo: 400");
  r = await pedir("/api/state", { metodo: "PUT", crudo: "{esto no es json" });
  check(r.status === 400 && r.data && r.data.error === "json_invalido", "JSON roto: 400, no 500", r.status);
  r = await pedir("/api/state", { metodo: "PUT", crudo: JSON.stringify({ x: "a".repeat(5 * 1024 * 1024) }) });
  check(r.status === 413, "cuerpo de más de 4 MB: 413", r.status);
  r = await pedir("/api/push/suscribir", { metodo: "POST" });
  check(r.status === 400, "suscribir sin cuerpo: 400, no se cae");
  r = await pedir("/api/push/baja", { metodo: "POST" });
  check(r.status === 200, "baja sin cuerpo: no se cae");
  r = await pedir("/api/copias/abc/restaurar", { metodo: "POST" });
  check(r.status === 404, "id de copia no numérico: 404 limpio");

  console.log("4. Copias automáticas");
  r = await pedir("/api/copias");
  check(r.status === 200 && r.data.copias.length === 1 && r.data.copias[0].motivo === "diaria",
    "la primera lectura del día ha creado la copia diaria", r.data);
  for (let i = 0; i < 5; i++) await pedir("/api/state");
  r = await pedir("/api/copias");
  check(r.data.copias.length === 1, "leer más veces no crea más copias");
  r = await pedir("/api/copias", { perfil: "mateo" });
  check(r.status === 403, "un hijo no ve las copias");

  const mod = JSON.parse(JSON.stringify(estado0));
  mod.fixedPay = 12.5;
  r = await pedir("/api/state", { metodo: "PUT", cuerpo: mod });
  check(r.status === 200, "papás cambian la paga a 12,5", r.data);
  r = await pedir("/api/reset", { metodo: "POST" });
  check(r.status === 200, "reiniciar la casa");
  r = await pedir("/api/state");
  check(r.data.fixedPay === 8, "tras reiniciar la paga vuelve a 8");
  r = await pedir("/api/copias");
  const antes = r.data.copias.find((c) => c.motivo === "antes_de_reiniciar");
  check(!!antes, "se guardó una copia ANTES de reiniciar");
  r = await pedir(`/api/copias/${antes.id}/restaurar`, { metodo: "POST" });
  check(r.status === 200, "restaurar esa copia");
  r = await pedir("/api/state");
  check(r.data.fixedPay === 12.5, "la paga vuelve a 12,5: el reinicio se ha deshecho", r.data.fixedPay);
  r = await pedir("/api/copias");
  check(r.data.copias.some((c) => c.motivo === "antes_de_restaurar"), "restaurar también guardó copia");
  r = await pedir("/api/copias/999999/restaurar", { metodo: "POST" });
  check(r.status === 404, "copia inexistente: 404");

  console.log("5. Avisos");
  r = await pedir("/api/push/clave");
  check(r.status === 200 && /^[A-Za-z0-9_-]{80,}$/.test(r.data.clave), "clave pública VAPID generada");
  const clave = r.data.clave;
  r = await pedir("/api/push/clave");
  check(r.data.clave === clave, "la clave es estable entre peticiones");

  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const sub = (endpoint) => ({ endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(crypto.randomBytes(16)) } });
  r = await pedir("/api/push/suscribir", { metodo: "POST", cuerpo: { suscripcion: sub("https://169.254.169.254/latest") } });
  check(r.status === 400, "dirección que no es un servicio de avisos: rechazada");
  // Dirección de Apple inventada: no se llega a entregar nada a nadie.
  r = await pedir("/api/push/suscribir", { metodo: "POST", cuerpo: { suscripcion: sub("https://web.push.apple.com/prueba-casa-" + Date.now()) } });
  check(r.status === 200 && r.data.perfil === "papas", "suscripción de los papás guardada");
  r = await pedir("/api/push/estado");
  check(r.data.suscripciones.papas === 1, "1 móvil de los papás con avisos", r.data);

  // Sin forzar depende de la hora: fuera de 17:00–21:30 no manda. Se pide en
  // modo simulación para que, a cualquier hora, no gaste el envío del día.
  r = await pedir("/api/push/recordatorios?simular=1", { metodo: "POST" });
  check(r.status === 200 && (r.data.fueraDeHora === true || r.data.simulado === true),
    "sin forzar: respeta la ventana de la tarde", r.data);
  r = await pedir("/api/push/recordatorios?simular=1&forzar=1", { metodo: "POST" });
  check(r.status === 200 && r.data.simulado === true && Array.isArray(r.data.avisos), "recordatorio simulado");
  r = await pedir("/api/push/recordatorios?forzar=1", { metodo: "POST", perfil: "mateo" });
  check(r.status === 403, "un hijo no puede disparar recordatorios");
  r = await pedir("/api/push/recordatorios?forzar=1", { metodo: "POST" });
  check(r.status === 200 && !r.data.yaEnviado, "recordatorio de hoy enviado", r.data);
  r = await pedir("/api/push/recordatorios?forzar=1", { metodo: "POST" });
  check(r.data.yaEnviado === true, "un segundo intento el mismo día no manda nada");

  console.log("6. Un hijo entrega una tarea");
  r = await pedir("/api/state");
  const s = r.data; s.generated = true;
  await pedir("/api/state", { metodo: "PUT", cuerpo: s });
  r = await pedir("/api/state");
  const deMateo = r.data;
  const semanal = deMateo.fixedTasks.find((t) => t.freq === "weekly");
  deMateo.fixedState.mateo[semanal.id].status = "submitted";
  r = await pedir("/api/state", { metodo: "PUT", perfil: "mateo", cuerpo: deMateo });
  check(r.status === 200, "Mateo marca «" + semanal.name + "» como hecha", r.data);
  r = await pedir("/api/state");
  const aprobarse = r.data;
  aprobarse.fixedState.mateo[semanal.id].status = "approved";
  r = await pedir("/api/state", { metodo: "PUT", perfil: "mateo", cuerpo: aprobarse });
  check(r.status === 403, "pero no puede aprobársela él mismo", r.status);

  console.log(`\n${ok} bien, ${mal} mal`);
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
