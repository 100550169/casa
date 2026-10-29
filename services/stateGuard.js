// ============================================================================
//  Saneado y permisos del estado familiar.
//
//  Dos capas independientes:
//
//  1. sanitizeState()  — normaliza el JSON que llega: tipos, longitudes,
//     enumerados y referencias. Evita que se guarde basura que luego rompa la
//     pantalla de toda la familia, y recorta lo que podría acabar en el HTML.
//
//  2. applyChildLimits() — reglas de rol. Un hijo necesita escribir el estado
//     para marcar sus tareas, pero no puede aprobárselas ni tocar las de sus
//     hermanos. Antes esas reglas solo existían en la interfaz, y con las
//     herramientas del navegador se saltaban.
// ============================================================================

const ESTADOS_TAREA = ["pending", "submitted", "approved", "late"];
const CARGAS = ["normal", "reducida", "minima"];
const COMIDAS = ["desayuno", "comida", "cena"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_LISTA = 200;

// --- Ayudas de normalización ------------------------------------------------
const txt = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v, def = 0, min = -1e6, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const ent = (v, def = 0, min = 0, max = 1e6) => Math.round(num(v, def, min, max));
const unoDe = (v, opciones, def) => (opciones.indexOf(v) >= 0 ? v : def);
const lista = (v, max = MAX_LISTA) => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
// Los ids acaban dentro de atributos onclick="fn('...')". Aquí conviven ids
// cortos ("f1", "e3") con UUID de la base de datos para los miembros, así que
// se admiten letras, números, guion y guion bajo.
const ident = (v) => String(v == null ? "" : v).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
const color = (v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#9c8a76");
// Los iconos son emoji: se les quita cualquier carácter con significado en HTML.
const icono = (v) => txt(v, 8).replace(/[<>&"'`\\]/g, "") || "⭐";

// ---------------------------------------------------------------------------
//  Calendario
//
//  `horarios`: lo que cada hijo tiene ocupado (colegio, entrenamientos…).
//  `agenda`:   en qué día y franja hace cada tarea. Es una PLANTILLA semanal:
//              vale para todas las semanas hasta que los papás la cambien.
//
//  Se exportan sueltos porque estadoService los reutiliza para normalizar el
//  estado al leerlo: una sola implementación, para que el saneado del PUT y la
//  normalización del GET no puedan dar resultados distintos (si los dieran,
//  volvería el bucle de repintado).
// ---------------------------------------------------------------------------
const FRANJAS = ["manana", "tarde", "noche"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function sanearHorarios(v, idsHijos) {
  const entrada = obj(v);
  const salida = {};
  idsHijos.forEach((h) => {
    salida[h] = lista(entrada[h], 20).map(obj).map((b) => {
      const days = [...new Set(lista(b.days, 7).map((d) => ent(d, -1, -1, 7)))]
        .filter((d) => d >= 0 && d <= 6).sort((a, c) => a - c);
      return {
        id: ident(b.id), label: txt(b.label, 40).trim(), days,
        ini: HORA.test(b.ini) ? b.ini : "", fin: HORA.test(b.fin) ? b.fin : "",
      };
    }).filter((b) => b.id && b.days.length && b.ini && b.fin && b.ini < b.fin);
  });
  return salida;
}

// Clave única de una entrada: las fijas van por (tarea, hijo); las adicionales
// solo por tarea, porque su hijo sale de la asignación del mes.
const claveAgenda = (e) => e.kind + "|" + e.taskId + "|" + (e.kind === "fixed" ? e.childId : "");

function sanearAgenda(v, { idsHijos, idsFijasSemanales, idsExtras }) {
  const vistas = new Set();
  return lista(v, 300).map(obj).map((e) => {
    const kind = unoDe(e.kind, ["fixed", "extra"], "");
    const salida = { kind, taskId: ident(e.taskId) };
    if (kind === "fixed") salida.childId = ident(e.childId);
    salida.day = ent(e.day, -1, -1, 7);
    salida.slot = unoDe(e.slot, FRANJAS, "");
    return salida;
  }).filter((e) => {
    if (!e.kind || !e.slot || e.day < 0 || e.day > 6) return false;
    // Una fija que ha pasado a diaria ya no se coloca: es de todos los días.
    if (e.kind === "fixed" && !(idsFijasSemanales.has(e.taskId) && idsHijos.has(e.childId))) return false;
    if (e.kind === "extra" && !idsExtras.has(e.taskId)) return false;
    const k = claveAgenda(e);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

// Contexto que necesita sanearAgenda, sacado de un estado ya saneado.
function contextoAgenda(s) {
  return {
    idsHijos: new Set((s.members || []).filter((m) => m.role === "child").map((m) => m.id)),
    idsFijasSemanales: new Set((s.fixedTasks || []).filter((t) => t.freq === "weekly").map((t) => t.id)),
    idsExtras: new Set((s.extraTasks || []).map((t) => t.id)),
  };
}

// ---------------------------------------------------------------------------
//  1. Saneado
// ---------------------------------------------------------------------------
function sanitizeState(entrada) {
  const s = obj(entrada);

  // members lo reescribe syncMembers() desde la base de datos; aquí solo se
  // normaliza para que el saneado del resto pueda apoyarse en él.
  const members = lista(s.members, 30).map(obj).map((m) => ({
    id: ident(m.id),
    name: txt(m.name, 40),
    role: unoDe(m.role, ["parent", "child"], "child"),
    color: color(m.color),
    load: unoDe(m.load, CARGAS, "normal"),
  })).filter((m) => m.id);
  const idsHijos = new Set(members.filter((m) => m.role === "child").map((m) => m.id));
  const idsMiembros = new Set(members.map((m) => m.id));

  const fixedTasks = lista(s.fixedTasks, 50).map(obj).map((t) => ({
    id: ident(t.id), name: txt(t.name, 60), icon: icono(t.icon),
    freq: unoDe(t.freq, ["daily", "weekly"], "daily"),
  })).filter((t) => t.id && t.name);
  const idsFijas = new Set(fixedTasks.map((t) => t.id));

  const extraTasks = lista(s.extraTasks, 100).map(obj).map((t) => ({
    id: ident(t.id), name: txt(t.name, 60),
    points: ent(t.points, 1, 0, 10000), icon: icono(t.icon),
  })).filter((t) => t.id && t.name);
  const idsExtras = new Set(extraTasks.map((t) => t.id));

  // fixedState: solo hijos y tareas que existen
  const fixedState = {};
  Object.keys(obj(s.fixedState)).slice(0, 50).forEach((claveHijo) => {
    const h = ident(claveHijo);
    if (!idsHijos.has(h)) return;
    const porTarea = obj(obj(s.fixedState)[claveHijo]);
    fixedState[h] = {};
    Object.keys(porTarea).slice(0, 100).forEach((claveTarea) => {
      const t = ident(claveTarea);
      if (!idsFijas.has(t)) return;      // descarta referencias colgantes
      const cur = obj(porTarea[claveTarea]);
      if (Array.isArray(cur.days)) {
        const days = [];
        for (let i = 0; i < 7; i++) days.push(cur.days[i] === true);
        fixedState[h][t] = { days };
      } else {
        fixedState[h][t] = { status: unoDe(cur.status, ESTADOS_TAREA, "pending") };
      }
    });
  });

  // Asignaciones: se tiran las que apunten a una tarea o a un hijo inexistente
  const extras = lista(s.extras).map(obj).map((x) => {
    const b = obj(x.bounty);
    const salida = {
      id: ident(x.id), taskId: ident(x.taskId), memberId: ident(x.memberId),
      status: unoDe(x.status, ESTADOS_TAREA, "pending"), listed: x.listed === true,
    };
    if (b.points != null && idsHijos.has(ident(b.from)) && idsHijos.has(ident(b.to))) {
      salida.bounty = { points: ent(b.points, 0, 0, 10000), from: ident(b.from), to: ident(b.to) };
    }
    return salida;
  }).filter((x) => x.id && idsExtras.has(x.taskId) && idsHijos.has(x.memberId));
  const idsAsignacion = new Set(extras.map((x) => x.id));

  const listings = lista(s.listings).map(obj).map((l) => ({
    id: ident(l.id), sellerId: ident(l.sellerId), assignmentId: ident(l.assignmentId),
    taskId: ident(l.taskId), pointsOffered: ent(l.pointsOffered, 0, 0, 10000),
    acceptsTrade: l.acceptsTrade === true, note: txt(l.note, 140),
    status: unoDe(l.status, ["open", "closed", "cancelled"], "cancelled"),
    createdAt: ent(l.createdAt, 0, 0, 1e15),
  })).filter((l) => l.id && idsExtras.has(l.taskId) && idsHijos.has(l.sellerId)
    && (l.status !== "open" || idsAsignacion.has(l.assignmentId)));
  const idsAnuncio = new Set(listings.map((l) => l.id));

  // Hay dos tipos de solicitud sobre un anuncio:
  //   take  -> "me la quedo": no ofrece nada a cambio
  //   trade -> propone cambiarla por una tarea suya
  // Por eso los campos de la tarea ofrecida solo se exigen en los trueques.
  const offers = lista(s.offers).map(obj).map((o) => ({
    id: ident(o.id), listingId: ident(o.listingId), bidderId: ident(o.bidderId),
    kind: unoDe(o.kind, ["take", "trade"], o.offeredTaskId ? "trade" : "take"),
    offeredAssignmentId: ident(o.offeredAssignmentId), offeredTaskId: ident(o.offeredTaskId),
    pointsAsked: ent(o.pointsAsked, 0, 0, 10000),
    status: unoDe(o.status, ["pending", "rejected", "accepted"], "rejected"),
    createdAt: ent(o.createdAt, 0, 0, 1e15),
  })).filter((o) => {
    if (!o.id || !idsAnuncio.has(o.listingId) || !idsHijos.has(o.bidderId)) return false;
    if (o.kind === "take") return true;
    return idsExtras.has(o.offeredTaskId)
      && (o.status !== "pending" || idsAsignacion.has(o.offeredAssignmentId));
  });

  // El historial del mercado se conserva aunque la tarea ya no exista: es un
  // registro de lo ocurrido, y el cliente lo pinta a prueba de huecos.
  const marketLog = lista(s.marketLog, 100).map(obj).map((m) => ({
    kind: unoDe(m.kind, ["take", "trade"], "take"),
    taskId: ident(m.taskId), giveTaskId: ident(m.giveTaskId),
    from: ident(m.from), to: ident(m.to),
    points: ent(m.points, 0, 0, 10000), at: ent(m.at, 0, 0, 1e15),
  })).filter((m) => idsMiembros.has(m.from) && idsMiembros.has(m.to));

  const porHijo = (v) => {
    const out = {};
    idsHijos.forEach((c) => { out[c] = ent(obj(v)[c], 0, 0, 1e6); });
    return out;
  };

  // El archivo de cada mes: puntos y cuántas adicionales acabaron hechas o sin
  // hacer (lo escribe resumenDelMes al cerrar el mes).
  const history = {};
  Object.keys(obj(s.history)).slice(0, 120).forEach((k) => {
    if (!/^\d{4}-\d{2}$/.test(k)) return;
    const m = obj(obj(s.history)[k]);
    history[k] = {
      points: porHijo(m.points),
      hechas: porHijo(m.hechas),
      vencidas: porHijo(m.vencidas),
    };
  });

  const dishes = lista(s.dishes, 150).map(obj).map((p, i) => ({
    id: ident(p.id) || ("d" + i), name: txt(p.name, 60),
    type: unoDe(p.type, COMIDAS, "comida"),
    tags: lista(p.tags, 10).map((t) => txt(t, 24)).filter(Boolean),
  })).filter((p) => p.name);
  const idsPlato = new Set(dishes.map((p) => p.id));

  const menu = {};
  DIAS.forEach((d) => {
    const dia = obj(obj(s.menu)[d]);
    menu[d] = {};
    COMIDAS.forEach((m) => {
      const id = ident(dia[m]);
      menu[d][m] = idsPlato.has(id) ? id : "";   // descarta platos borrados
    });
  });

  const rewards = lista(s.rewards, 60).map(obj).map((r) => ({
    id: ident(r.id), title: txt(r.title, 80), cost: ent(r.cost, 0, 0, 100000),
    type: txt(r.type, 30),
    stock: r.stock == null ? null : ent(r.stock, 0, 0, 9999),
    active: r.active !== false,
  })).filter((r) => r.id && r.title);
  const idsPremio = new Set(rewards.map((r) => r.id));

  const redemptions = lista(s.redemptions, 200).map(obj).map((c) => ({
    id: ident(c.id), rewardId: ident(c.rewardId), childId: ident(c.childId),
    cost: ent(c.cost, 0, 0, 100000),
    status: unoDe(c.status, ["pending", "approved", "denied"], "pending"),
    at: ent(c.at, 0, 0, 1e15),
    resolvedAt: ent(c.resolvedAt, 0, 0, 1e15),
  })).filter((c) => c.id && idsPremio.has(c.rewardId) && idsHijos.has(c.childId));

  const ctxAgenda = contextoAgenda({ members, fixedTasks, extraTasks });
  const horarios = sanearHorarios(s.horarios, [...ctxAgenda.idsHijos]);
  const agenda = sanearAgenda(s.agenda, ctxAgenda);

  return {
    currentMonth: /^\d{4}-\d{2}$/.test(s.currentMonth) ? s.currentMonth : "",
    currentWeek: /^\d{4}-W\d{2}$/.test(s.currentWeek) ? s.currentWeek : "",
    rate: num(s.rate, 0.05, 0, 1000),
    fixedPay: num(s.fixedPay, 8, 0, 100000),
    members, fixedTasks, extraTasks, fixedState, extras,
    generated: s.generated === true,
    monthPoints: porHijo(s.monthPoints),
    // streak la recalcula el servidor en cada escritura; streakCarry es lo que
    // se arrastra de semanas anteriores y hay que conservarlo (si se perdiera,
    // la racha volvería a cero cada lunes).
    streak: porHijo(s.streak),
    streakCarry: porHijo(s.streakCarry),
    history, dishes, menu, rewards, redemptions, listings, offers, marketLog,
    horarios, agenda,
  };
}

// ---------------------------------------------------------------------------
//  Comparación que NO depende del orden de las claves.
//
//  PostgreSQL devuelve el JSONB con las claves reordenadas alfabéticamente, y
//  sanitizeState reconstruye los objetos en el orden en que están escritos
//  aquí. Comparar con JSON.stringify daba distinto para dos objetos idénticos.
//
//  No es un detalle: por esto un hijo recibía 403 al marcar una tarea suya.
//  Su móvil devolvía el estado tal cual se lo habían dado, el saneado lo
//  reconstruía con otro orden de claves, y `streak` parecía haber cambiado.
// ---------------------------------------------------------------------------
function huella(v) {
  if (Array.isArray(v)) return "[" + v.map(huella).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort()
      .map((k) => JSON.stringify(k) + ":" + huella(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
//  2. Límites por rol
//
//  Devuelve { estado, rechazos }. `rechazos` describe lo que se ha impedido:
//  sirve para responder 403 con un motivo en vez de guardar en silencio.
// ---------------------------------------------------------------------------
function applyChildLimits(entrante, anterior, childId) {
  const rechazos = [];
  // Los DOS lados se sanean, para comparar peras con peras. Si solo se saneara
  // uno, un `monthPoints: {}` guardado en la base de datos contra el
  // `{mateo:0, pablo:0, sara:0}` que produce el saneado parecería un intento
  // de manipulación, y el hijo recibiría un 403 al marcar su tarea.
  // sanitizeState es idempotente, así que sanear de nuevo lo ya saneado no
  // cuesta nada más que una pasada.
  const salida = sanitizeState(obj(entrante));
  const prev = sanitizeState(obj(anterior));

  // Campos que un hijo nunca escribe: se restauran y se avisa del intento.
  // El calendario (horarios y agenda) lo organizan los papás: el hijo lo ve,
  // pero no lo cambia.
  const SOLO_PADRES = [
    "members", "fixedTasks", "extraTasks", "rewards", "dishes", "menu",
    "fixedPay", "rate", "streak", "streakCarry", "history", "monthPoints", "generated",
    "horarios", "agenda",
  ];
  SOLO_PADRES.forEach((k) => {
    if (huella(salida[k]) !== huella(prev[k])) rechazos.push(k);
    salida[k] = prev[k];
  });

  // Las claves de ciclo se restauran EN SILENCIO: quien las valida es la
  // comprobación de ciclo desfasado (409), que da un motivo más útil que un
  // 403 genérico cuando el servidor acaba de cambiar de semana.
  ["currentMonth", "currentWeek"].forEach((k) => {
    if (k in prev) salida[k] = prev[k];
  });

  // --- Tareas fijas: solo las propias, y solo pending -> submitted ---
  const fsPrev = obj(prev.fixedState);
  const fsNuevo = obj(salida.fixedState);
  const fsFinal = {};
  Object.keys(fsPrev).forEach((hijo) => {
    if (hijo !== childId) { fsFinal[hijo] = fsPrev[hijo]; return; } // intocable
    const tareasPrev = obj(fsPrev[hijo]);
    const tareasNuevo = obj(fsNuevo[hijo]);
    fsFinal[hijo] = {};
    Object.keys(tareasPrev).forEach((tid) => {
      const antes = obj(tareasPrev[tid]);
      const ahora = obj(tareasNuevo[tid]);
      if (Array.isArray(antes.days)) {
        // Las diarias se auto-reportan: puede marcarlas y desmarcarlas.
        fsFinal[hijo][tid] = Array.isArray(ahora.days) ? ahora : antes;
      } else {
        const permitido = antes.status === "pending" && ahora.status === "submitted";
        if (ahora.status && ahora.status !== antes.status && !permitido) {
          rechazos.push("fixedState." + tid + ": " + antes.status + "->" + ahora.status);
          fsFinal[hijo][tid] = antes;
        } else {
          fsFinal[hijo][tid] = permitido ? { status: "submitted" } : antes;
        }
      }
    });
  });
  salida.fixedState = fsFinal;

  // --- Adicionales ---
  // Un hijo puede marcar como hecha una tarea SUYA, y usar el mercado (que
  // cambia memberId y listed). Lo que no puede es aprobar ni marcar vencida.
  const exPrev = lista(prev.extras);
  const exNuevo = lista(salida.extras);
  const porId = new Map(exPrev.map((x) => [x.id, x]));
  salida.extras = exNuevo.map((x) => {
    const antes = porId.get(x.id);
    if (!antes) return x;                       // asignación nueva: la crea el padre al repartir
    if (x.status === antes.status) return x;
    const esMia = antes.memberId === childId;
    const permitido = esMia && antes.status === "pending" && x.status === "submitted";
    if (!permitido) {
      rechazos.push("extras." + x.id + ": " + antes.status + "->" + x.status);
      return { ...x, status: antes.status };
    }
    return x;
  });

  return { estado: salida, rechazos };
}

module.exports = {
  sanitizeState, applyChildLimits,
  sanearHorarios, sanearAgenda, contextoAgenda, huella,
};
