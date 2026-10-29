// ============================================================================
//  Estado de la casa: semilla, forma y lectura/escritura en la base de datos.
//
//  Sustituye al antiguo familyService. La diferencia de fondo: antes los
//  miembros salían de la tabla `family_members` (y por tanto de cuentas de
//  usuario con contraseña); ahora salen de public/perfiles.js, que es fijo.
//
//  Todo lo demás se conserva tal cual: el estado sigue siendo un único
//  documento JSON con un contador de versión, y los datos de cada persona
//  siguen colgando de su id.
// ============================================================================
const { query } = require("../db");
const {
  PERFILES, PAPAS, esPerfilValido, esHijo, miembrosIniciales,
} = require("../public/perfiles.js");
const { sanitizeState, sanearHorarios, sanearAgenda, contextoAgenda } = require("./stateGuard");
const { claveMes, claveSemana } = require("./tiempo");

// ---------------------------------------------------------------------------
//  Semilla de una casa recién estrenada.
// ---------------------------------------------------------------------------
function estadoVacio() {
  const now = new Date();
  const dish = (id, name, type, tags) => ({ id, name, type, tags: tags || [] });
  return {
    currentMonth: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"),
    currentWeek: null,
    rate: 0.05, fixedPay: 8,
    members: miembrosIniciales([]),
    fixedTasks: [
      { id: "f1", name: "Hacer la cama", icon: "🛏️", freq: "daily" },
      { id: "f2", name: "Recoger tu plato", icon: "🍽️", freq: "daily" },
      { id: "f3", name: "Preparar la mochila", icon: "🎒", freq: "daily" },
      { id: "f4", name: "Poner una lavadora", icon: "🧺", freq: "weekly" },
    ],
    extraTasks: [
      { id: "e1", name: "Limpiar el baño", points: 40, icon: "🛁" },
      { id: "e2", name: "Aspirar el salón", points: 25, icon: "🧹" },
      { id: "e3", name: "Poner la lavadora", points: 20, icon: "🧺" },
      { id: "e4", name: "Sacar la basura", points: 10, icon: "🗑️" },
      { id: "e5", name: "Pasear al perro", points: 15, icon: "🐕" },
    ],
    fixedState: {}, extras: [], generated: false,
    streak: {}, history: {},
    dishes: [
      dish("d1", "Tostadas con tomate", "desayuno", ["rápido"]),
      dish("d2", "Yogur con cereales", "desayuno", ["rápido"]),
      dish("d3", "Pasta con tomate", "comida", ["vegetariano"]),
      dish("d4", "Pollo al horno", "comida", []),
      dish("d5", "Lentejas", "comida", ["legumbres", "vegetariano"]),
      dish("d6", "Tortilla francesa", "cena", ["rápido", "vegetariano"]),
      dish("d7", "Ensalada César", "cena", []),
    ],
    menu: {
      Lun: { desayuno: "", comida: "", cena: "" },
      Mar: { desayuno: "", comida: "", cena: "" },
      "Mié": { desayuno: "", comida: "", cena: "" },
      Jue: { desayuno: "", comida: "", cena: "" },
      Vie: { desayuno: "", comida: "", cena: "" },
      "Sáb": { desayuno: "", comida: "", cena: "" },
      Dom: { desayuno: "", comida: "", cena: "" },
    },
    rewards: [
      { id: "r1", title: "1 h más de pantalla", cost: 60, type: "Tiempo", stock: null, active: true },
      { id: "r2", title: "Elegir la peli del finde", cost: 40, type: "Privilegio", stock: 1, active: true },
    ],
    redemptions: [],
    listings: [], offers: [], marketLog: [],
    // Calendario: vacío hasta que los papás apunten horarios y organicen.
    horarios: Object.fromEntries(
      PERFILES.filter((p) => p.role === "child").map((p) => [p.id, []])),
    agenda: [],
  };
}

// ---------------------------------------------------------------------------
//  Adopción de los perfiles fijos.
//
//  Hace dos cosas, y la primera solo ocurre una vez en la vida de la casa:
//
//  1. TRADUCE los ids antiguos. El estado que venía de la app con cuentas
//     usaba UUID de la tabla `users` dentro de fixedState, extras, canjes,
//     mercado e historial. Se emparejan por nombre con Mateo, Pablo y Sara, y
//     cualquier padre o madre pasa a ser "papas". Sin esta traducción, todo el
//     historial quedaría colgando de ids que ya no existen y el saneado lo
//     tiraría a la basura.
//
//  2. FIJA la lista de miembros a los cuatro perfiles, conservando la
//     disponibilidad (`load`) que los padres hubieran configurado.
//
//  Devuelve true si ha cambiado algo, para poder persistirlo.
// ---------------------------------------------------------------------------
// "Mía" y "MIA" son la misma persona: se comparan sin tildes ni mayúsculas.
const normalizar = (s) => String(s == null ? "" : s).trim().toLowerCase()
  .normalize("NFD").split("").filter((c) => {
    const cp = c.charCodeAt(0);
    return cp < 0x300 || cp > 0x36f;          // fuera las tildes sueltas
  }).join("");

function adoptarPerfiles(state) {
  const previos = Array.isArray(state.members) ? state.members : [];

  // --- 1. Mapa de ids viejos -> perfiles fijos ---
  const mapa = new Map();
  previos.forEach((m) => {
    if (!m || !m.id || esPerfilValido(m.id)) return;   // ya es un perfil: nada que hacer
    if (m.role === "parent") { mapa.set(m.id, PAPAS.id); return; }
    const destino = PERFILES.find((p) => p.role === "child"
      && normalizar(p.name) === normalizar(m.name));
    if (destino) mapa.set(m.id, destino.id);
    // Un hijo cuyo nombre no coincide con ninguno de los tres no se traduce:
    // sus referencias quedan colgando y las limpia el saneado. Es lo correcto,
    // porque esa persona ya no forma parte de esta casa.
  });

  const traducir = (id) => (mapa.has(id) ? mapa.get(id) : id);
  let cambio = mapa.size > 0;

  if (cambio) {
    // Claves de objeto indexadas por persona
    ["fixedState", "streak", "streakCarry", "monthPoints"].forEach((campo) => {
      state[campo] = renombrarClaves(state[campo], traducir);
    });
    Object.keys(state.history || {}).forEach((mes) => {
      const m = state.history[mes];
      if (!m || typeof m !== "object") return;
      ["points", "hechas", "vencidas"].forEach((k) => {
        m[k] = renombrarClaves(m[k], traducir);
      });
    });
    // Campos que guardan una persona dentro de un elemento de lista
    reasignar(state.extras, [["memberId"]]);
    reasignar(state.listings, [["sellerId"]]);
    reasignar(state.offers, [["bidderId"]]);
    reasignar(state.marketLog, [["from"], ["to"]]);
    reasignar(state.redemptions, [["childId"]]);
    (state.extras || []).forEach((x) => {
      if (x && x.bounty) {
        x.bounty.from = traducir(x.bounty.from);
        x.bounty.to = traducir(x.bounty.to);
      }
    });
  }

  function reasignar(lista, campos) {
    if (!Array.isArray(lista)) return;
    lista.forEach((el) => {
      if (!el) return;
      campos.forEach(([c]) => { el[c] = traducir(el[c]); });
    });
  }

  // --- 2. Los miembros son SIEMPRE los cuatro perfiles ---
  // La comparación va por huella() y no por JSON.stringify porque los miembros
  // vuelven de PostgreSQL con las claves reordenadas: si no, "no ha cambiado
  // nada" se leería como un cambio y habría una escritura por cada lectura.
  const miembros = miembrosIniciales(previos.map((m) => ({ ...m, id: traducir(m.id) })));
  if (huella(miembros) !== huella(previos)) {
    state.members = miembros;
    cambio = true;
  }
  return cambio;
}

function renombrarClaves(origen, traducir) {
  if (!origen || typeof origen !== "object" || Array.isArray(origen)) return origen || {};
  const salida = {};
  Object.keys(origen).forEach((k) => { salida[traducir(k)] = origen[k]; });
  return salida;
}

// ---------------------------------------------------------------------------
//  Relleno de las casillas de tareas fijas.
//
//  Lo hace el SERVIDOR para que el estado que entrega venga ya completo.
//  Antes lo rellenaba solo el cliente y no lo guardaba: el sondeo veía
//  diferencia contra el servidor en cada vuelta, adoptaba el remoto, volvía a
//  rellenar... y la pantalla se repintaba cada 4 segundos sin parar.
//
//  Devuelve true si ha cambiado algo, para poder guardarlo.
// ---------------------------------------------------------------------------
function ensureFixedShape(state) {
  let cambio = false;
  if (!state.fixedState || typeof state.fixedState !== "object") {
    state.fixedState = {}; cambio = true;
  }
  const hijos = (state.members || []).filter((m) => m.role === "child");
  const tareas = state.fixedTasks || [];

  hijos.forEach((c) => {
    if (!state.fixedState[c.id]) { state.fixedState[c.id] = {}; cambio = true; }
    tareas.forEach((t) => {
      const cur = state.fixedState[c.id][t.id];
      const quiereDias = t.freq !== "weekly";
      if (!cur || quiereDias !== Array.isArray(cur.days)) {
        state.fixedState[c.id][t.id] = quiereDias
          ? { days: [false, false, false, false, false, false, false] }
          : { status: "pending" };
        cambio = true;
      }
    });
    // Tareas que ya no existen en el catálogo
    Object.keys(state.fixedState[c.id]).forEach((taskId) => {
      if (!tareas.some((t) => t.id === taskId)) {
        delete state.fixedState[c.id][taskId]; cambio = true;
      }
    });
  });

  // Casillas de alguien que ya no es un hijo de esta casa
  Object.keys(state.fixedState).forEach((id) => {
    if (!esHijo(id)) { delete state.fixedState[id]; cambio = true; }
  });

  return cambio;
}

// ---------------------------------------------------------------------------
//  Forma de los platos y los menús.
//
//  Las casas antiguas guardaban los platos como texto suelto y el menú como un
//  plato por día. Ahora un plato es {id, name, type, tags} y cada día tiene
//  desayuno, comida y cena.
//
//  El cliente ya sabe convertirlo (ensureShape en public/index.html), pero si
//  solo lo arreglara él, el sondeo vería en cada vuelta una diferencia contra
//  lo guardado, adoptaría lo remoto, volvería a convertir... y la pantalla se
//  repintaría cada 4 segundos. Mismo caso que las casillas de tareas fijas: la
//  conversión tiene que hacerla también el servidor, Y GUARDARLA.
//
//  Esta función es el espejo exacto de la del cliente. Si se cambia una, hay
//  que cambiar la otra: en cuanto den resultados distintos, vuelve el bucle.
// ---------------------------------------------------------------------------
const DIAS_MENU = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const COMIDAS_MENU = ["desayuno", "comida", "cena"];

// Comparación que NO depende del orden de las claves.
//
// Hace falta porque PostgreSQL guarda el JSONB con las claves reordenadas: un
// {id, name, type, tags} vuelve de la base de datos como {id, name, tags,
// type}. Con un JSON.stringify normal, reconstruir ese mismo objeto parecería
// un cambio, el servidor lo guardaría, y volveríamos a tener una escritura por
// cada lectura — justo lo que esta normalización viene a evitar.
function huella(v) {
  if (Array.isArray(v)) return "[" + v.map(huella).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort()
      .map((k) => JSON.stringify(k) + ":" + huella(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function normalizarMenus(state) {
  const antes = huella([state.dishes, state.menu]);

  const platos = Array.isArray(state.dishes) ? state.dishes : [];
  state.dishes = platos.map((p, i) => (p && typeof p === "object")
    ? {
      id: p.id || ("d" + i),
      name: p.name || "",
      type: COMIDAS_MENU.indexOf(p.type) >= 0 ? p.type : "comida",
      tags: Array.isArray(p.tags) ? p.tags : [],
    }
    : { id: "d" + i, name: String(p), type: "comida", tags: [] }
  ).filter((p) => p.name);

  if (!state.menu || typeof state.menu !== "object") state.menu = {};
  DIAS_MENU.forEach((d) => {
    const v = state.menu[d];
    if (v && typeof v === "object") {
      COMIDAS_MENU.forEach((m) => { if (typeof v[m] !== "string") v[m] = ""; });
    } else {
      // Antes era el nombre de un plato: se busca su id y se pone como comida.
      const encontrado = state.dishes.find((p) => p.name === v);
      state.menu[d] = { desayuno: "", comida: encontrado ? encontrado.id : "", cena: "" };
    }
  });

  return huella([state.dishes, state.menu]) !== antes;
}

// ---------------------------------------------------------------------------
//  Forma del calendario (horarios + agenda).
//
//  Misma lección que los menús y las casillas: las casas que existían antes del
//  calendario no tienen estos campos. Si solo el cliente los rellenara, el
//  sondeo vería diferencia en cada vuelta y la pantalla se repintaría sin
//  parar. Lo hace el servidor, con los MISMOS saneadores que el PUT, y lo
//  guarda. De paso tira las entradas que se han quedado colgando (una tarea
//  borrada, una fija que ha pasado a diaria…).
//
//  Devuelve true si ha cambiado algo, para poder guardarlo.
// ---------------------------------------------------------------------------
function normalizarCalendario(state) {
  const antes = huella([state.horarios, state.agenda]);
  const ctx = contextoAgenda(state);
  state.horarios = sanearHorarios(state.horarios, [...ctx.idsHijos]);
  state.agenda = sanearAgenda(state.agenda, ctx);
  return huella([state.horarios, state.agenda]) !== antes;
}

// ---------------------------------------------------------------------------
//  Deja lista una copia para restaurarla: la de un archivo que suben los papás
//  o una de las copias automáticas. Puede venir de cualquier sitio y de
//  cualquier época, así que se sanea igual que un PUT, se traducen los ids
//  antiguos y se sella con el ciclo ACTUAL (si no, el GET siguiente la tomaría
//  por una semana vieja y la reiniciaría).
// ---------------------------------------------------------------------------
function prepararRestauracion(entrada) {
  const estado = sanitizeState(entrada);
  adoptarPerfiles(estado);
  estado.currentMonth = claveMes();
  estado.currentWeek = claveSemana();
  ensureFixedShape(estado);
  normalizarMenus(estado);
  normalizarCalendario(estado);
  return estado;
}

// ---------------------------------------------------------------------------
//  Acceso a la base de datos. Una única fila (ver migración 008).
// ---------------------------------------------------------------------------
async function leerEstado() {
  const r = await query("SELECT data, version FROM casa_state WHERE id = 1");
  if (r.rows[0]) return { estado: r.rows[0].data, version: Number(r.rows[0].version) };

  const estado = estadoVacio();
  await query(
    "INSERT INTO casa_state (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING",
    [JSON.stringify(estado)]
  );
  return { estado, version: 1 };
}

// Guarda sin comprobar nada. Para los caminos en los que el estado lo produce
// el servidor (reinicios de ciclo, restaurar una copia, reiniciar la casa).
async function guardarEstado(estado) {
  const r = await query(
    `INSERT INTO casa_state (id, data, version, updated_at)
          VALUES (1, $1::jsonb, 2, now())
     ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              version = casa_state.version + 1,
              updated_at = now()
       RETURNING version`,
    [JSON.stringify(estado)]
  );
  return Number(r.rows[0].version);
}

// Guarda solo si nadie ha escrito desde que este dispositivo leyó.
// Devuelve la versión nueva, o null si hubo conflicto.
// versionCliente = 0 significa "no sé de qué versión vengo": se acepta igual,
// porque bloquear ahí dejaría la app inutilizable tras cualquier despiste.
async function guardarSiVersion(estado, versionCliente) {
  const r = await query(
    `UPDATE casa_state
        SET data = $1::jsonb, version = version + 1, updated_at = now()
      WHERE id = 1 AND ($2 = 0 OR version = $2)
      RETURNING version`,
    [JSON.stringify(estado), versionCliente]
  );
  return r.rowCount ? Number(r.rows[0].version) : null;
}

async function versionActual() {
  const r = await query("SELECT version FROM casa_state WHERE id = 1");
  return r.rows[0] ? Number(r.rows[0].version) : 0;
}

module.exports = {
  estadoVacio,
  adoptarPerfiles,
  ensureFixedShape,
  normalizarMenus,
  normalizarCalendario,
  prepararRestauracion,
  leerEstado,
  guardarEstado,
  guardarSiVersion,
  versionActual,
};
