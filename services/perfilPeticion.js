// ============================================================================
//  Qué perfil dice ser quien hace la petición.
//
//  Cada dispositivo manda su perfil en la cabecera `X-Perfil`. No es una
//  credencial: responde a "¿quién usa este móvil?" y sirve para las reglas de
//  producto (un hijo reporta, los papás validan). Quién puede entrar en la casa
//  lo decide otra cosa: el código de casa (services/codigoCasa.js).
// ============================================================================
const { esHijo, esPerfilValido, PERFIL_POR_DEFECTO } = require("../public/perfiles.js");

// Si no llega un perfil válido se asume el de los papás. Con el código de casa
// activado esto ya no abre ninguna puerta: sin código no se llega hasta aquí.
function perfilDe(req) {
  const p = String(req.get("X-Perfil") || "").trim();
  return esPerfilValido(p) ? p : PERFIL_POR_DEFECTO;
}

// Los ajustes de la casa (copias, reinicio, recordatorios) son de los papás.
function soloPapas(req, res, next) {
  if (esHijo(perfilDe(req))) return res.status(403).json({ error: "solo_papas" });
  next();
}

module.exports = { perfilDe, soloPapas };
