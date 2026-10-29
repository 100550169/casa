// ============================================================================
//  MODO DEMO — "Casa"
//
//  Sirve para enseñar la app a alguien sin que toque los datos reales de casa.
//
//  CÓMO FUNCIONA
//  Toda la app habla con el servidor a través de una única función, api().
//  Aquí la sustituimos por una versión falsa que responde desde una casa
//  inventada guardada en memoria. Consecuencias:
//
//    - NO se hace ni una sola petición al servidor real.
//    - NO hay base de datos.
//    - Lo que se toque se pierde al recargar (o al pulsar "Reiniciar").
//
//  Los perfiles son los mismos de siempre (Mateo, Pablo, Sara y los papás):
//  se cambia de uno a otro con el selector normal de la app, que es justo lo
//  que hace la demo interesante — enseñar las dos experiencias sin necesitar
//  dos dispositivos.
// ============================================================================
(function () {
  "use strict";

  // --- Fechas: la demo debe verse "de esta semana" sea cuando sea ----------
  function claveMes(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function claveSemana(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dia = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dia + 3);
    const primerJue = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const sem = 1 + Math.round(((t - primerJue) / 86400000 - 3 + ((primerJue.getUTCDay() + 6) % 7)) / 7);
    return t.getUTCFullYear() + "-W" + String(sem).padStart(2, "0");
  }
  const hoy = new Date();

  // Marca los N primeros días de la semana como hechos.
  // A propósito NO depende del día de hoy: si dependiera, un lunes la demo
  // aparecería casi vacía y no se entendería nada al enseñarla.
  function dias(n) {
    const d = [false, false, false, false, false, false, false];
    for (let i = 0; i < n && i < 7; i++) d[i] = true;
    return d;
  }

  // --- La casa de ejemplo ---------------------------------------------------
  function estadoInicial() {
    return {
      currentMonth: claveMes(hoy), currentWeek: claveSemana(hoy),
      rate: 0.05, fixedPay: 8,
      // Los mismos cuatro perfiles que la app real, con la disponibilidad de
      // Pablo rebajada para que se vea el efecto en el reparto.
      members: miembrosIniciales([{ id: "pablo", load: "reducida" }]),
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
      // Los tres casos de la regla del dinero, para que se vean de un vistazo:
      //   Sara  22/22 = 100% → cobra la paga fija Y desbloquea las adicionales
      //   Mateo   17/22 =  77% → cobra la paga fija, adicionales aún bloqueadas
      //   Pablo  9/22 =  41% → por debajo del 75%: pierde la paga fija
      // (3 tareas diarias × 7 días + 1 semanal = 22 unidades por hijo)
      fixedState: {
        sara: { f1: { days: dias(7) }, f2: { days: dias(7) }, f3: { days: dias(7) }, f4: { status: "approved" } },
        mateo: { f1: { days: dias(6) }, f2: { days: dias(6) }, f3: { days: dias(5) }, f4: { status: "submitted" } },
        pablo: { f1: { days: dias(3) }, f2: { days: dias(3) }, f3: { days: dias(3) }, f4: { status: "pending" } },
      },
      extras: [
        { id: "x1", taskId: "e1", memberId: "mateo", status: "approved", listed: false },
        { id: "x2", taskId: "e2", memberId: "sara", status: "submitted", listed: false },
        { id: "x3", taskId: "e3", memberId: "pablo", status: "pending", listed: true },
        { id: "x4", taskId: "e5", memberId: "sara", status: "approved", listed: false,
          bounty: { points: 5, from: "pablo", to: "sara" } },
        { id: "x5", taskId: "e4", memberId: "mateo", status: "pending", listed: false },
      ],
      generated: true,
      monthPoints: { mateo: 0, pablo: 0, sara: 0 },
      // Coherentes con fixedState: en la app real las calcula el servidor a
      // partir de las casillas (services/rachas.js); aquí van fijas porque la
      // demo no tiene servidor. Sara encadena semanas, Mateo lleva 5 días, y a
      // Pablo se le ha roto: así se ve también ese caso.
      streak: { mateo: 5, pablo: 0, sara: 12 },
      history: { "2026-07": { points: { mateo: 210, pablo: 95, sara: 260 } } },
      dishes: [
        { id: "b1", name: "Tostadas con tomate", type: "desayuno", tags: ["rápido"] },
        { id: "b2", name: "Yogur con cereales", type: "desayuno", tags: ["rápido"] },
        { id: "b3", name: "Batido de frutas", type: "desayuno", tags: [] },
        { id: "c1", name: "Pasta con tomate", type: "comida", tags: ["vegetariano"] },
        { id: "c2", name: "Pollo al horno", type: "comida", tags: [] },
        { id: "c3", name: "Lentejas", type: "comida", tags: ["legumbres"] },
        { id: "c4", name: "Arroz al horno", type: "comida", tags: [] },
        { id: "c5", name: "Macarrones", type: "comida", tags: [] },
        { id: "n1", name: "Tortilla francesa", type: "cena", tags: ["rápido"] },
        { id: "n2", name: "Ensalada César", type: "cena", tags: [] },
        { id: "n3", name: "Sopa y croquetas", type: "cena", tags: [] },
        { id: "n4", name: "Pescado a la plancha", type: "cena", tags: [] },
      ],
      menu: {
        Lun: { desayuno: "b1", comida: "c1", cena: "n1" },
        Mar: { desayuno: "b2", comida: "c2", cena: "n2" },
        "Mié": { desayuno: "b1", comida: "c3", cena: "n3" },
        Jue: { desayuno: "b3", comida: "c4", cena: "n4" },
        Vie: { desayuno: "b2", comida: "c5", cena: "n1" },
        "Sáb": { desayuno: "b3", comida: "c2", cena: "n2" },
        Dom: { desayuno: "b1", comida: "c1", cena: "n3" },
      },
      rewards: [
        { id: "r1", title: "1 h más de pantalla", cost: 60, type: "Tiempo", stock: null, active: true },
        { id: "r2", title: "Elegir la peli del finde", cost: 40, type: "Privilegio", stock: 1, active: true },
        { id: "r3", title: "Noche sin tareas", cost: 120, type: "Privilegio", stock: null, active: true },
        { id: "r4", title: "Cena a elegir", cost: 80, type: "Plan", stock: 2, active: true },
      ],
      // Una solicitud ya pedida, para que se vea el contador en "Premios"
      redemptions: [
        { id: "c1", rewardId: "r2", childId: "sara", cost: 40, status: "pending", at: Date.now() - 7200000, resolvedAt: 0 },
      ],
      streakCarry: {},
      listings: [{
        id: "l1", sellerId: "pablo", assignmentId: "x3", taskId: "e3",
        pointsOffered: 8, acceptsTrade: true, note: "Tengo entreno, ¿alguien?",
        status: "open", createdAt: Date.now() - 3600000,
      }],
      offers: [],
      marketLog: [{
        kind: "take", taskId: "e5", from: "pablo", to: "sara",
        points: 5, at: Date.now() - 86400000,
      }],
      // Calendario. Pensado para que se vean todos los casos:
      //   - Sara tiene danza lunes y miércoles por la tarde, así que
      //     "Pasear al perro" el lunes por la tarde sale como CONFLICTO.
      //   - "Sacar la basura" de Mateo va HOY, sea el día que sea, para que su
      //     móvil enseñe la tarjeta "Hoy te toca".
      //   - La lavadora de Sara y dos adicionales quedan sin colocar, para que
      //     "Organizar semana" tenga algo que hacer.
      horarios: {
        mateo: [
          { id: "h1", label: "Colegio", days: [0, 1, 2, 3, 4], ini: "08:00", fin: "14:30" },
          { id: "h2", label: "Baloncesto", days: [1, 3], ini: "17:30", fin: "19:00" },
        ],
        pablo: [
          { id: "h3", label: "Colegio", days: [0, 1, 2, 3, 4], ini: "08:00", fin: "15:00" },
          { id: "h4", label: "Robótica", days: [2], ini: "18:00", fin: "19:30" },
        ],
        sara: [
          { id: "h5", label: "Colegio", days: [0, 1, 2, 3, 4], ini: "08:00", fin: "15:00" },
          { id: "h6", label: "Danza", days: [0, 2], ini: "15:00", fin: "19:30" },
        ],
      },
      agenda: [
        { kind: "fixed", taskId: "f4", childId: "mateo", day: 5, slot: "manana" },
        { kind: "fixed", taskId: "f4", childId: "pablo", day: 3, slot: "tarde" },
        { kind: "extra", taskId: "e1", day: 2, slot: "tarde" },
        { kind: "extra", taskId: "e4", day: (hoy.getDay() + 6) % 7, slot: "noche" },
        { kind: "extra", taskId: "e5", day: 0, slot: "tarde" },
      ],
    };
  }

  let ESTADO = estadoInicial();

  // --- El servidor falso ----------------------------------------------------
  const copia = (o) => JSON.parse(JSON.stringify(o));

  function error(clave, codigo) {
    const e = new Error(clave);
    e.status = codigo || 400;
    e.payload = { error: clave };
    return e;
  }

  // Solo existen las rutas del estado. Ya no hay cuentas, familias ni
  // invitaciones que fingir: la app real tampoco las tiene.
  async function apiDemo(url, opts) {
    const metodo = ((opts && opts.method) || "GET").toUpperCase();
    const ruta = String(url).split("?")[0];
    // Pequeño retardo para que la interfaz se comporte como con un servidor real
    await new Promise((r) => setTimeout(r, 40));

    if (ruta === "/api/state") {
      if (metodo === "PUT") {
        const cuerpo = opts.body;
        ESTADO = typeof cuerpo === "string" ? JSON.parse(cuerpo) : copia(cuerpo);
        return { ok: true, version: 1 };
      }
      return copia(ESTADO);
    }

    if (ruta === "/api/reset") { ESTADO = estadoInicial(); return { ok: true }; }
    if (ruta === "/api/restore") throw error("demo_solo_lectura", 403);

    // Ajustes de la casa: se enseñan como en una casa protegida y con avisos,
    // pero nada de esto existe de verdad en la demo.
    if (ruta === "/api/health") return { ok: true, db: false, protegida: true };
    if (ruta === "/api/push/estado") return { suscripciones: { mateo: 1, sara: 1, papas: 2 } };
    if (ruta === "/api/copias") {
      const dia = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
      return { copias: [0, 1, 2, 3].map((n) => ({
        id: n + 1, dia: dia(n), motivo: "diaria", version: 40 - n,
        creada: new Date(Date.now() - n * 86400000).toISOString(), bytes: 4000,
      })) };
    }
    if (ruta.indexOf("/api/push/") === 0 || ruta.indexOf("/api/copias/") === 0) {
      throw error("demo_solo_lectura", 403);
    }

    throw error("no_encontrado", 404);
  }

  // --- Barra de aviso -------------------------------------------------------
  function pintarBarraDemo() {
    if (document.getElementById("demoBar")) return;
    const barra = document.createElement("div");
    barra.id = "demoBar";
    barra.innerHTML =
      '<span class="demo-eti">DEMO</span>' +
      '<span class="demo-txt">Datos de ejemplo. No se guarda nada.</span>' +
      '<span class="demo-sep"></span>' +
      '<button id="demoRol" class="demo-btn">👀 Cambiar de perfil</button>' +
      '<button id="demoReset" class="demo-btn">Reiniciar</button>' +
      '<button id="demoSalir" class="demo-btn">Salir</button>';
    document.body.appendChild(barra);

    const estilo = document.createElement("style");
    estilo.textContent =
      "#demoBar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;" +
      "gap:8px;padding:7px 12px;background:#43352a;color:#fff5e9;font:600 13px system-ui,sans-serif;" +
      "box-shadow:0 -4px 14px rgba(0,0,0,.2);white-space:nowrap;" +
      "padding-bottom:calc(7px + env(safe-area-inset-bottom))}" +
      "#demoBar .demo-eti{background:#ff7a59;color:#fff;padding:3px 9px;border-radius:7px;font-weight:800;" +
      "letter-spacing:.06em;font-size:11px;flex:none}" +
      "#demoBar .demo-txt{opacity:.85;overflow:hidden;text-overflow:ellipsis}" +
      "#demoBar .demo-sep{flex:1}" +
      "#demoBar .demo-btn{background:rgba(255,255,255,.12);color:inherit;border:1px solid rgba(255,255,255,.25);" +
      "border-radius:9px;padding:6px 11px;font:inherit;cursor:pointer;flex:none}" +
      "#demoBar .demo-btn:hover{background:rgba(255,255,255,.22)}" +
      // La app tiene su propia barra de navegación abajo en la vista móvil, y
      // hojas que suben desde abajo: se desplazan para que la barra de demo no
      // las tape (y viceversa).
      "body.demo-activa .nav{bottom:46px}" +
      "body.demo-activa .mob .phone{padding-bottom:160px}" +
      "body.demo-activa .sheet{bottom:46px}" +
      "body.demo-activa .modebar{top:0}" +
      "body.demo-activa .pick-shell{padding-bottom:78px}" +
      // En pantallas estrechas se quita el texto largo para que todo quepa en
      // una sola línea.
      "@media(max-width:560px){#demoBar .demo-txt{display:none}#demoBar{gap:6px;padding-left:10px;padding-right:10px}" +
      "#demoBar .demo-btn{padding:6px 9px;font-size:12px}}" +

      // ---- Marco de teléfono (solo en la vista del hijo, en pantalla ancha) ----
      // El fondo de alrededor se apaga para que el móvil destaque.
      "body.demo-marco{background:#e8dcc9;background-image:none}" +
      "#demoMarco{position:relative;width:390px;height:800px;margin:26px auto 84px;" +
      "border:13px solid #241d19;border-radius:52px;overflow:hidden;background:var(--bg);" +
      "box-shadow:0 28px 70px rgba(36,29,25,.38), 0 0 0 2px #3b302a;" +
      // Este transform es lo que ancla los position:fixed de dentro al marco.
      "transform:translateZ(0)}" +
      "#demoMuesca{position:absolute;top:0;left:50%;transform:translateX(-50%);width:150px;height:26px;" +
      "background:#241d19;border-radius:0 0 18px 18px;z-index:60;pointer-events:none}" +
      "#demoMarco #mob{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}" +
      "#demoMarco #mob .phone{max-width:none;min-height:0;padding:62px 16px 104px}" +
      // Dentro del marco todo pasa de position:fixed a position:absolute.
      // Con fixed, aun anclándose al marco por el transform, el navegador
      // resuelve `bottom` contra una caja que no coincide con el borde visible
      // y las hojas se salían por abajo. Con absolute, el ancla es el marco
      // (que es position:relative) y encaja exacto.
      "#demoMarco .modebar,#demoMarco .nav,#demoMarco .sheet,#demoMarco .sheet-bg{position:absolute}" +
      "#demoMarco .modebar{top:0;left:0;right:0;padding-top:14px}" +
      "#demoMarco .nav{bottom:0;left:0;right:0;max-width:none;margin:0}" +
      "#demoMarco .sheet{bottom:0;left:0;right:0;max-width:none;margin:0;max-height:76%}" +
      "#demoMarco .sheet-bg{inset:0}" +
      "body.demo-marco .mob .phone{padding-bottom:104px}";
    document.head.appendChild(estilo);
    document.body.classList.add("demo-activa");

    document.getElementById("demoRol").onclick = cambiarDePerfilDemo;
    document.getElementById("demoReset").onclick = reiniciarDemo;
    document.getElementById("demoSalir").onclick = salirDeLaDemo;
    actualizarBotonRol();
  }

  // El botón dice a quién se está mirando. En pantalla estrecha, solo el nombre.
  function actualizarBotonRol() {
    const b = document.getElementById("demoRol");
    if (!b) return;
    const id = perfilAbierto();
    const p = id ? perfilPorId(id) : null;
    const nombre = p ? (p.shortName || p.name) : "perfil";
    b.textContent = window.innerWidth < 560 ? ("👀 " + nombre) : ("👀 " + nombre + " · cambiar");
  }

  // --- Marco de móvil ------------------------------------------------------
  // En un ordenador, la vista del hijo se vería como una columna estrecha
  // perdida en medio de la pantalla. Para que la demo enseñe la app tal y como
  // se ve de verdad, se mete dentro de un marco con forma de teléfono.
  //
  // El truco está en el `transform` del marco: hace que los elementos con
  // position:fixed de dentro (la barra de navegación, las hojas que suben)
  // se anclen al marco en vez de a la ventana del navegador.
  const IDS_MOVIL = ["modebar", "mob", "sheetBg", "sheet"];

  function aplicarMarco(activar) {
    let marco = document.getElementById("demoMarco");
    if (activar) {
      if (!marco) {
        marco = document.createElement("div");
        marco.id = "demoMarco";
        marco.innerHTML = '<div id="demoMuesca"></div>';
        document.body.appendChild(marco);
      }
      IDS_MOVIL.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.parentNode !== marco) marco.appendChild(el);
      });
      document.body.classList.add("demo-marco");
    } else {
      if (marco) {
        IDS_MOVIL.forEach((id) => {
          const el = document.getElementById(id);
          if (el) document.body.appendChild(el);
        });
        marco.remove();
      }
      document.body.classList.remove("demo-marco");
    }
  }

  // Qué perfil hay abierto ahora mismo, o null si se está en el selector.
  function perfilAbierto() {
    const sel = document.getElementById("picker");
    if (sel && sel.style.display === "block") return null;
    return typeof window.perfilActual === "function" ? window.perfilActual() : null;
  }

  // El marco solo tiene sentido si hay sitio: en un móvil de verdad, la app ya
  // ocupa toda la pantalla y enmarcarla sería absurdo.
  const cabeMarco = () => window.innerWidth >= 900 && window.innerHeight >= 700;
  function revisarMarco() {
    const id = perfilAbierto();
    aplicarMarco(!!id && esHijo(id) && cabeMarco());
    actualizarBotonRol();
  }

  window.addEventListener("resize", revisarMarco);

  // Cambiar de perfil es lo mismo que en la app real: se abre el selector.
  function cambiarDePerfilDemo() {
    if (typeof window.cambiarDePerfil === "function") window.cambiarDePerfil();
    revisarMarco();
  }

  async function reiniciarDemo() {
    ESTADO = estadoInicial();
    if (typeof window.bootstrap === "function") await window.bootstrap();
    revisarMarco();
  }

  function salirDeLaDemo() {
    location.href = "/";
  }

  // --- Arranque -------------------------------------------------------------
  window.api = apiDemo;              // a partir de aquí, nada sale a la red
  window.__DEMO__ = true;

  // El marco de teléfono tiene que aparecer y desaparecer al cambiar de perfil.
  // En vez de inventar un evento, se envuelven las dos funciones de la app que
  // marcan ese cambio: pintar la pantalla y volver al selector.
  ["render", "mostrarSelector"].forEach((nombre) => {
    const original = window[nombre];
    if (typeof original !== "function") return;
    window[nombre] = function () {
      const r = original.apply(this, arguments);
      revisarMarco();
      return r;
    };
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pintarBarraDemo);
  } else {
    pintarBarraDemo();
  }
})();
