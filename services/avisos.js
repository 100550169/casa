// ============================================================================
//  Qué avisar y a quién.
//
//  Funciones puras: reciben estados y devuelven una lista de avisos
//  { para, titulo, cuerpo, etiqueta }. No saben nada de cómo se envían (eso es
//  services/push.js), y por eso se pueden probar sin navegador ni red.
//
//  `para` es el id de un hijo ("mateo") o "papas".
//
//  Dos momentos:
//   - al GUARDAR: se compara el estado de antes con el de después y se avisa
//     de lo que le importa a otra persona (Sara entrega una tarea → a los
//     papás; los papás la aprueban → a Sara). Nunca a quien hizo el cambio.
//   - por la TARDE: un recordatorio por hijo con lo que le toca hoy, y a los
//     papás cuántas cosas esperan su visto bueno.
// ============================================================================
const { PAPAS } = require("../public/perfiles.js");

const obj = (v) => (v && typeof v === "object" ? v : {});
const nombreDe = (s, id) => ((s.members || []).find((m) => m.id === id) || {}).name || id;
const tareaFija = (s, id) => (s.fixedTasks || []).find((t) => t.id === id);
const tareaExtra = (s, id) => (s.extraTasks || []).find((t) => t.id === id);
const premioDe = (s, id) => (s.rewards || []).find((r) => r.id === id);
const hijosDe = (s) => (s.members || []).filter((m) => m.role === "child");

// "a, b, c y 2 más": un aviso del móvil se lee en dos líneas.
function enumerar(nombres, max = 3) {
  if (nombres.length <= max) return nombres.join(", ");
  return nombres.slice(0, max).join(", ") + " y " + (nombres.length - max) + " más";
}

// ---------------------------------------------------------------------------
//  Avisos por un cambio guardado
// ---------------------------------------------------------------------------
function avisosDeCambio(antes, despues) {
  const prev = obj(antes), nuevo = obj(despues);
  const out = [];
  const avisar = (para, titulo, cuerpo, etiqueta) => out.push({ para, titulo, cuerpo, etiqueta });

  // Un mismo paso de estado vale para fijas semanales y adicionales.
  function transicion(hijo, tarea, de, a, etiqueta) {
    if (!tarea || !de || de === a) return;
    const n = nombreDe(nuevo, hijo);
    if (a === "submitted") {
      avisar(PAPAS.id, `✅ ${n} ha hecho «${tarea.name}»`, "Toca darle el visto bueno.", etiqueta);
    } else if (a === "approved") {
      const premio = tarea.points ? `+${tarea.points} puntos. ` : "";
      avisar(hijo, `👏 ¡Aprobada! «${tarea.name}»`, premio + "Buen trabajo.", etiqueta);
    } else if (de === "submitted" && a === "pending") {
      avisar(hijo, `↩️ «${tarea.name}» necesita un repaso`, "Tus papás te la han devuelto. Échale otro vistazo.", etiqueta);
    }
    // "late" lo pone el servidor al cerrar el mes: avisar de eso en bloque
    // sería un aluvión de malas noticias a la vez. Se ve en la app.
  }

  // Fijas semanales (las diarias se marcan sin validación: no avisan)
  const fsPrev = obj(prev.fixedState), fsNuevo = obj(nuevo.fixedState);
  Object.keys(fsNuevo).forEach((hijo) => {
    Object.keys(obj(fsNuevo[hijo])).forEach((tid) => {
      const de = obj(obj(fsPrev[hijo])[tid]).status;
      const a = obj(fsNuevo[hijo][tid]).status;
      transicion(hijo, tareaFija(nuevo, tid), de, a, "fija-" + hijo + "-" + tid);
    });
  });

  // Adicionales
  const exPrev = new Map((prev.extras || []).map((x) => [x.id, x]));
  (nuevo.extras || []).forEach((x) => {
    const antesX = exPrev.get(x.id);
    if (!antesX) return;                      // reparto nuevo: no es un "cambio"
    transicion(x.memberId, tareaExtra(nuevo, x.taskId), antesX.status, x.status, "extra-" + x.id);
  });

  // Premios
  const canjesPrev = new Map((prev.redemptions || []).map((c) => [c.id, c]));
  (nuevo.redemptions || []).forEach((c) => {
    const p = premioDe(nuevo, c.rewardId);
    if (!p) return;
    const antesC = canjesPrev.get(c.id);
    if (!antesC && c.status === "pending") {
      avisar(PAPAS.id, `🎁 ${nombreDe(nuevo, c.childId)} pide «${p.title}»`,
        `${c.cost} puntos. Podéis concederlo o denegarlo en Premios.`, "canje-" + c.id);
    } else if (antesC && antesC.status === "pending" && c.status === "approved") {
      avisar(c.childId, `🎉 Te conceden «${p.title}»`, "¡A disfrutarlo!", "canje-" + c.id);
    } else if (antesC && antesC.status === "pending" && c.status === "denied") {
      avisar(c.childId, `Premio denegado: «${p.title}»`, "Recuperas tus puntos.", "canje-" + c.id);
    }
  });

  // Mercado entre hermanos
  const anuncio = (id) => (nuevo.listings || []).find((l) => l.id === id);
  const ofertasPrev = new Map((prev.offers || []).map((o) => [o.id, o]));
  (nuevo.offers || []).forEach((o) => {
    const l = anuncio(o.listingId);
    const t = l && tareaExtra(nuevo, l.taskId);
    if (!t) return;
    const antesO = ofertasPrev.get(o.id);
    if (!antesO && o.status === "pending") {
      const que = o.kind === "trade" ? "te propone un cambio por" : "quiere quedarse";
      avisar(l.sellerId, `📥 ${nombreDe(nuevo, o.bidderId)} ${que} «${t.name}»`,
        "Míralo en el Mercado.", "oferta-" + o.id);
    } else if (antesO && antesO.status === "pending" && o.status !== "pending") {
      const ok = o.status === "accepted";
      avisar(o.bidderId, ok ? `🤝 ${nombreDe(nuevo, l.sellerId)} acepta: «${t.name}»` : `${nombreDe(nuevo, l.sellerId)} no acepta tu oferta`,
        ok ? "Ahora la tarea es tuya." : "Puedes probar con otra.", "oferta-" + o.id);
    }
  });

  return out;
}

// ---------------------------------------------------------------------------
//  Recordatorio de la tarde
//
//  `dia` es 0 = lunes … 6 = domingo, en el huso de la casa.
// ---------------------------------------------------------------------------
function recordatoriosDelDia(estado, dia) {
  const s = obj(estado);
  const out = [];

  hijosDe(s).forEach((h) => {
    const casillas = obj(obj(s.fixedState)[h.id]);
    const planificadas = [];
    (s.agenda || []).filter((e) => e.day === dia).forEach((e) => {
      if (e.kind === "fixed") {
        if (e.childId !== h.id) return;
        const t = tareaFija(s, e.taskId);
        if (t && t.freq === "weekly" && (obj(casillas[t.id]).status || "pending") === "pending") planificadas.push(t.name);
      } else {
        const x = (s.extras || []).find((a) => a.taskId === e.taskId);
        const t = tareaExtra(s, e.taskId);
        // En el mercado ya no es "suya del todo": no se le recuerda.
        if (x && t && x.memberId === h.id && x.status === "pending" && !x.listed) planificadas.push(t.name);
      }
    });
    const sinMarcar = (s.fixedTasks || []).filter((t) => t.freq !== "weekly")
      .filter((t) => { const c = casillas[t.id]; return c && Array.isArray(c.days) && !c.days[dia]; })
      .map((t) => t.name);

    if (!planificadas.length && !sinMarcar.length) return;
    const partes = [];
    if (planificadas.length) partes.push(enumerar(planificadas));
    if (sinMarcar.length) partes.push((planificadas.length ? "y marca: " : "Marca: ") + enumerar(sinMarcar));
    out.push({
      para: h.id,
      titulo: planificadas.length ? `📅 Hoy te toca, ${h.name}` : `📅 ${h.name}, ¿ya lo has hecho?`,
      cuerpo: partes.join(" · "),
      etiqueta: "recordatorio",
    });
  });

  // Papás: lo que espera su visto bueno.
  let porValidar = (s.extras || []).filter((x) => x.status === "submitted").length;
  Object.values(obj(s.fixedState)).forEach((c) => {
    Object.values(obj(c)).forEach((v) => { if (v && v.status === "submitted") porValidar++; });
  });
  const premios = (s.redemptions || []).filter((c) => c.status === "pending").length;
  if (porValidar || premios) {
    const partes = [];
    if (porValidar) partes.push(porValidar + (porValidar === 1 ? " tarea por validar" : " tareas por validar"));
    if (premios) partes.push(premios + (premios === 1 ? " premio pedido" : " premios pedidos"));
    out.push({ para: PAPAS.id, titulo: "👀 Os esperan", cuerpo: partes.join(" y ") + ".", etiqueta: "validar" });
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Agrupar por destinatario
//
//  Si los papás aprueban seis tareas seguidas, el hijo no debe recibir seis
//  avisos: recibe uno con el resumen.
// ---------------------------------------------------------------------------
function agrupar(avisos) {
  const porDestino = new Map();
  avisos.forEach((a) => {
    if (!porDestino.has(a.para)) porDestino.set(a.para, []);
    porDestino.get(a.para).push(a);
  });
  const out = [];
  porDestino.forEach((lista, para) => {
    if (lista.length === 1) { out.push(lista[0]); return; }
    out.push({
      para,
      titulo: `🔔 ${lista.length} novedades en Casa`,
      cuerpo: lista.map((a) => a.titulo).join(" · ").slice(0, 220),
      etiqueta: "resumen",
    });
  });
  return out;
}

module.exports = { avisosDeCambio, recordatoriosDelDia, agrupar, enumerar };
