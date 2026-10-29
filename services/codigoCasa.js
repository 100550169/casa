// ============================================================================
//  Código de casa.
//
//  La app no tiene cuentas y no las va a tener: a un niño no se le pide una
//  contraseña. Pero sin nada, cualquiera que conociera la dirección podía leer
//  el estado de la casa (con los horarios de los críos) e incluso borrarlo.
//
//  El código de casa cierra eso sin molestar:
//    - los papás mandan UNA vez a cada móvil un enlace que lleva el código,
//    - el móvil lo guarda y lo envía solo en cada petición (cabecera X-Casa),
//    - el servidor rechaza todo lo que no lo traiga.
//  Nadie lo teclea en el día a día. Si un móvil lo pierde (por ejemplo, al
//  instalar la app en la pantalla de inicio del iPhone, que guarda sus datos
//  aparte), la app lo pide una vez.
//
//  El código vive en la variable de entorno CODIGO_CASA. Si no está puesta, la
//  casa funciona abierta como antes y el Dashboard lo avisa en rojo.
// ============================================================================
const crypto = require("crypto");

// Mayúsculas y sin separadores: "abcd efgh-jkmn" vale igual que "ABCDEFGHJKMN".
const normalizarCodigo = (c) => String(c == null ? "" : c).toUpperCase().replace(/[^A-Z0-9]/g, "");

// Sin I, L, O, 0 ni 1: que no haya dudas al dictarlo o copiarlo a mano.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generarCodigo() {
  const bytes = crypto.randomBytes(12);
  const c = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
  return c.slice(0, 4) + "-" + c.slice(4, 8) + "-" + c.slice(8, 12);
}

// Se fabrica con opciones para poder probarla con un reloj falso.
function crearGuardia({
  codigo = process.env.CODIGO_CASA,
  maxFallos = 30,
  ventanaMs = 15 * 60 * 1000,
  ahora = () => Date.now(),
} = {}) {
  const esperado = normalizarCodigo(codigo);
  const activo = esperado.length > 0;
  const fallos = new Map();                       // ip -> { n, desde }

  const caducado = (f, t) => t - f.desde > ventanaMs;
  function bloqueado(ip, t) {
    const f = fallos.get(ip);
    if (!f) return false;
    if (caducado(f, t)) { fallos.delete(ip); return false; }
    return f.n >= maxFallos;
  }
  function anotarFallo(ip, t) {
    const f = fallos.get(ip);
    if (!f || caducado(f, t)) fallos.set(ip, { n: 1, desde: t });
    else f.n++;
    // Que un ataque desde muchas IPs no llene la memoria.
    if (fallos.size > 5000) for (const [k, v] of fallos) if (caducado(v, t)) fallos.delete(k);
  }
  // Comparación en tiempo constante: se comparan las huellas, que siempre
  // miden lo mismo, para no dar pistas por lo que tarda en responder.
  const huella = (s) => crypto.createHash("sha256").update(s).digest();
  const coincide = (dado) => activo && crypto.timingSafeEqual(huella(normalizarCodigo(dado)), huella(esperado));

  function middleware(req, res, next) {
    if (!activo) return next();
    const t = ahora();
    const ip = req.ip || "?";
    // Se mira ANTES de comparar: si no, un bloqueado seguiría pudiendo probar
    // códigos y distinguir el bueno por la respuesta.
    if (bloqueado(ip, t)) {
      res.set("Retry-After", String(Math.ceil(ventanaMs / 1000)));
      return res.status(429).json({ error: "demasiados_intentos" });
    }
    const dado = req.get("X-Casa");
    if (coincide(dado)) return next();
    // Una petición SIN código (la app recién abierta en un móvil nuevo) no gasta
    // intentos; solo cuenta probar uno equivocado.
    if (normalizarCodigo(dado)) anotarFallo(ip, t);
    return res.status(401).json({ error: "codigo_casa" });
  }

  return { activo, middleware, coincide };
}

module.exports = { crearGuardia, generarCodigo, normalizarCodigo };
