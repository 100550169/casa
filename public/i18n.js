// ============================================================================
//  IDIOMAS — motor de traducción y catálogo, compartido por cliente y servidor.
//
//  La interfaz se escribe en español, que es el idioma de origen. Para el resto
//  de idiomas hay un catálogo «frase en español → traducción»:
//
//    - En el navegador, traducirDom() recorre lo que la app acaba de pintar
//      (nodos de texto y atributos visibles: placeholder, title, aria-label,
//      alt) y sustituye cada frase conocida. Un MutationObserver lo aplica a
//      todo lo que se pinte después: pantallas, modales, hojas y avisos.
//    - En el servidor, traducirAviso() pasa los avisos push al idioma que eligió
//      cada móvil al suscribirse.
//
//  Por qué así y no con claves t("menu.titulo") por todo index.html: ver
//  docs/adr/0011-runtime-ui-translation.md.
//
//  Reglas del catálogo:
//    - La clave es el texto COMPLETO de un nodo, con los espacios interiores
//      reducidos a uno. Un nodo que no coincide entero no se toca, así que los
//      datos de la casa (nombres, tareas) no se traducen por accidente.
//    - Las frases con partes variables van en PATRONES: {1}, {2}… capturan
//      nombres o números y se copian tal cual en la traducción.
//    - Las letras sueltas (L, M, X…) no van en el catálogo: chocarían con las
//      iniciales de los avatares. Los días cortos los da diasCortos().
// ============================================================================
(function (raiz, definir) {
  const api = definir();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.keys(api).forEach((k) => { raiz[k] = api[k]; });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IDIOMAS = [
    { id: "es", nombre: "Español" },
    { id: "en", nombre: "English" },
  ];
  const IDIOMA_ORIGEN = "es";
  const CLAVE_IDIOMA = "casa_idioma_v1";
  const LOCALES = { es: "es-ES", en: "en-GB" };

  const esIdiomaValido = (id) => IDIOMAS.some((i) => i.id === id);
  const normalizarIdioma = (id) => (esIdiomaValido(id) ? id : IDIOMA_ORIGEN);
  const localeDe = (id) => LOCALES[normalizarIdioma(id)];

  const DIAS_CORTOS = { es: ["L", "M", "X", "J", "V", "S", "D"], en: ["M", "T", "W", "T", "F", "S", "S"] };
  const DIAS_LARGOS = {
    es: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
    en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  };
  const MESES = {
    es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const diasCortos = (id) => DIAS_CORTOS[normalizarIdioma(id)];
  const diasLargos = (id) => DIAS_LARGOS[normalizarIdioma(id)];
  const nombresMeses = (id) => MESES[normalizarIdioma(id)];

  // --------------------------------------------------------------------------
  //  Catálogo inglés (ver más abajo, CATALOGO_EN y PATRONES_EN)
  // --------------------------------------------------------------------------
  const CATALOGOS = {};
  const PATRONES = {};

  const escaparRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function compilar([origen, destino]) {
    const nums = [];
    let re = "^";
    origen.split(/\{(\d)\}/).forEach((parte, i) => {
      if (i % 2) { nums.push(parte); re += "(.+?)"; } else re += escaparRe(parte);
    });
    return { re: new RegExp(re + "$", "s"), nums, destino };
  }
  function registrar(id, catalogo, patrones) {
    CATALOGOS[id] = catalogo;
    PATRONES[id] = patrones.map(compilar);
  }

  // Traduce el texto completo de un nodo. Conserva los espacios de los lados
  // (separan el nodo de sus vecinos en la línea) y devuelve el original si no
  // hay traducción. En un patrón, cada parte variable se copia tal cual salvo
  // que sea, entera, una frase del catálogo («Lun», «Tiempo»…).
  function traducirFrase(texto, idioma) {
    if (idioma === IDIOMA_ORIGEN || !CATALOGOS[idioma] || typeof texto !== "string") return texto;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(texto);
    const nucleo = m[2].replace(/\s+/g, " ");
    if (!nucleo) return texto;
    const catalogo = CATALOGOS[idioma];
    const exacta = (s) => (Object.prototype.hasOwnProperty.call(catalogo, s) ? catalogo[s] : null);
    if (exacta(nucleo) !== null) return m[1] + exacta(nucleo) + m[3];
    for (const p of PATRONES[idioma]) {
      const r = p.re.exec(nucleo);
      if (!r) continue;
      let salida = p.destino;
      p.nums.forEach((n, i) => {
        const parte = r[i + 1];
        salida = salida.split("{" + n + "}").join(exacta(parte) !== null ? exacta(parte) : parte);
      });
      return m[1] + salida + m[3];
    }
    return texto;
  }

  // Un mensaje de alert/confirm puede tener varios párrafos: se traduce cada uno.
  const traducirMensaje = (texto, idioma) =>
    String(texto == null ? "" : texto).split("\n").map((l) => traducirFrase(l, idioma)).join("\n");

  // Avisos push: el título entero y el cuerpo por trozos (los avisos agrupados
  // unen sus títulos con " · ").
  function traducirAviso(aviso, idioma) {
    if (idioma === IDIOMA_ORIGEN || !aviso) return aviso;
    const trozos = (t) => String(t || "").split(" · ").map((x) => traducirFrase(x, idioma)).join(" · ");
    return Object.assign({}, aviso, { titulo: trozos(aviso.titulo), cuerpo: trozos(aviso.cuerpo) });
  }

  // --------------------------------------------------------------------------
  //  Navegador
  // --------------------------------------------------------------------------
  const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"];
  const NO_TRADUCIR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };

  function idiomaGuardado() {
    try {
      const g = globalThis.localStorage && globalThis.localStorage.getItem(CLAVE_IDIOMA);
      if (esIdiomaValido(g)) return g;
    } catch (e) { /* sin almacenamiento: se usa el del navegador */ }
    const nav = globalThis.navigator || {};
    const lista = [].concat(nav.languages || [], nav.language || []);
    const elegido = lista.map((l) => String(l).slice(0, 2).toLowerCase()).find(esIdiomaValido);
    return elegido || IDIOMA_ORIGEN;
  }
  function guardarIdioma(id) {
    try { globalThis.localStorage.setItem(CLAVE_IDIOMA, normalizarIdioma(id)); } catch (e) { /* sin almacenamiento */ }
  }

  function traducirNodoTexto(n, idioma) {
    const padre = n.parentNode;
    if (!padre || NO_TRADUCIR[padre.nodeName] || (padre.closest && padre.closest('[translate="no"]'))) return;
    const t = traducirFrase(n.nodeValue, idioma);
    if (t !== n.nodeValue) n.nodeValue = t;
  }
  function traducirElemento(el, idioma) {
    if (el.closest && el.closest('[translate="no"]')) return;
    ATRIBUTOS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      const v = el.getAttribute(a);
      const t = traducirFrase(v, idioma);
      if (t !== v) el.setAttribute(a, t);
    });
  }
  function traducirDom(raizDom, idioma) {
    if (idioma === IDIOMA_ORIGEN || !raizDom) return;
    if (raizDom.nodeType === 3) return traducirNodoTexto(raizDom, idioma);
    if (raizDom.nodeType !== 1 && raizDom.nodeType !== 9) return;
    const doc = raizDom.ownerDocument || raizDom;
    const textos = doc.createTreeWalker(raizDom, 4 /* NodeFilter.SHOW_TEXT */);
    const pendientes = [];
    while (textos.nextNode()) pendientes.push(textos.currentNode);
    pendientes.forEach((n) => traducirNodoTexto(n, idioma));
    if (raizDom.nodeType === 1) traducirElemento(raizDom, idioma);
    raizDom.querySelectorAll("[" + ATRIBUTOS.join("],[") + "]").forEach((el) => traducirElemento(el, idioma));
  }

  // Deja traducida la página y todo lo que se pinte a partir de ahora.
  function observarIdioma(idioma) {
    const doc = globalThis.document;
    if (!doc || !doc.documentElement) return;
    doc.documentElement.lang = normalizarIdioma(idioma);
    if (idioma === IDIOMA_ORIGEN) return;
    doc.title = traducirFrase(doc.title, idioma);
    ["alert", "confirm", "prompt"].forEach((nombre) => {
      const original = globalThis[nombre];
      if (typeof original !== "function") return;
      globalThis[nombre] = function (mensaje, ...resto) {
        return original.call(globalThis, traducirMensaje(mensaje, idioma), ...resto);
      };
    });
    const empezar = () => {
      traducirDom(doc.body, idioma);
      new MutationObserver((cambios) => {
        cambios.forEach((c) => {
          if (c.type === "characterData") traducirNodoTexto(c.target, idioma);
          else if (c.type === "attributes") traducirElemento(c.target, idioma);
          else c.addedNodes.forEach((n) => traducirDom(n, idioma));
        });
      }).observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
    };
    if (doc.body) empezar(); else doc.addEventListener("DOMContentLoaded", empezar);
  }

  // ==========================================================================
  //  CATÁLOGO INGLÉS
  // ==========================================================================
  const CATALOGO_EN = {
    // --- General y navegación ---
    "Casa · tareas en familia": "Casa · family chores",
    "Cambiar": "Switch",
    "Conectado": "Connected",
    "Sin conexión con el servidor": "No connection to the server",
    "Resumen": "Overview", "Los hijos": "Children", "Calendario": "Calendar", "Tareas fijas": "Fixed chores",
    "Adicionales": "Extra chores", "Validar": "Approve", "Premios": "Rewards", "Menús": "Meals", "Economía": "Economy",
    "Inicio": "Home", "Semana": "Week", "Mercado": "Market", "Logros": "Badges", "Menú": "Meals",
    "Papás": "Parents", "· Papás": "· Parents", "· 🏠 Papás": "· 🏠 Parents",
    "Dashboard de los Papás": "Parents' dashboard",
    "Lun": "Mon", "Mar": "Tue", "Mié": "Wed", "Jue": "Thu", "Vie": "Fri", "Sáb": "Sat", "Dom": "Sun",
    "Mañana": "Morning", "Tarde": "Afternoon", "Noche": "Evening",
    "🌅 Mañana": "🌅 Morning", "☀️ Tarde": "☀️ Afternoon", "🌙 Noche": "🌙 Evening",
    "Vale": "OK", "Cancelar": "Cancel", "Guardar": "Save", "Añadir": "Add", "+ Añadir": "+ Add", "Borrar": "Delete",
    "Colocar": "Place", "Vaciar": "Clear", "Total": "Total", "Hijo/a": "Child", "Tarea": "Chore", "Tipo": "Type",
    "Estado": "Status", "Puntos": "Points", "Racha": "Streak", "Extras": "Extras", "Fijas": "Fixed", "fijas": "fixed",
    "extra": "extra", "Hijos": "Children", "Todos": "All", "Día": "Day", "Días": "Days", "días": "days",
    "Desde": "From", "Hasta": "To", "Nombre": "Name", "Icono": "Icon", "Frecuencia": "Frequency",
    "libre": "free", "ocupado": "busy", "ahora": "now", "hoy": "today", "bloqueado": "locked",
    "activo": "active", "desactivado": "disabled", "Desactivar": "Disable", "Activar": "Enable",

    // --- Selector de perfil, código de casa y errores ---
    "¿Quién eres?": "Who are you?",
    "Tus tareas y tu paga · móvil": "Your chores and allowance · phone",
    "Panel de la casa · ordenador": "Household dashboard · computer",
    "Los papás": "Parents",
    "Se recuerda tu elección en este dispositivo.": "This device remembers your choice.",
    "Puedes cambiarla cuando quieras desde arriba.": "You can change it any time from the top bar.",
    "Esta casa es privada": "This household is private",
    "Escribe el": "Enter the", "código de casa": "house code",
    ". Te lo dan tus papás (o abre el enlace que te hayan mandado).": ". Your parents can give it to you (or open the link they sent you).",
    "Código de casa": "House code",
    "Solo se pide una vez en cada móvil.": "You only need it once on each phone.",
    "Escribe el código.": "Enter the code.",
    "Ese código no es el de esta casa. Revísalo.": "That is not this household's code. Check it.",
    "Demasiados intentos seguidos. Espera unos minutos.": "Too many attempts in a row. Wait a few minutes.",
    "No se pudo comprobar. ¿Hay conexión?": "Could not check it. Are you online?",
    "Algo no ha ido bien": "Something went wrong",
    "Elegir otro perfil": "Choose another profile",
    "No hay ningún hijo configurado en la casa.": "There are no children set up in this household.",
    "No se pudo cargar la casa. Comprueba la conexión y vuelve a intentarlo.": "Could not load the household. Check your connection and try again.",
    "No se pudo cargar la demo.": "Could not load the demo.",
    "Otro dispositivo guardó al mismo tiempo y tu último cambio no se pudo aplicar. Revísalo, por favor.": "Another device saved at the same time and your last change could not be applied. Please check it.",

    // --- Hoja de perfil ---
    "Estás usando la app como": "You are using the app as",
    "Podéis validar tareas y cambiar los ajustes de la casa": "You can approve chores and change the household settings",
    "Marcas tus tareas; tus papás las validan": "You tick off your chores; your parents approve them",
    "Cambiar a": "Switch to", "Ver todos los perfiles": "See all profiles", "Idioma": "Language",
    "Avisos en este móvil": "Notifications on this phone", "Cambiar de perfil": "Switch profile",

    // --- Demo ---
    "Datos de ejemplo. No se guarda nada.": "Sample data. Nothing is saved.",
    "👀 perfil · cambiar": "👀 profile · switch", "Reiniciar": "Reset", "Salir": "Exit",

    // --- Resumen (padres) ---
    "Resumen de la casa": "Household overview",
    "A entregar este mes": "To pay this month", "Por validar": "To approve", "Tareas activas": "Active chores",
    "Cuánto debes a cada hijo/a": "What you owe each child",
    "Fija si completa ≥75% · adicionales solo con el 100% de las fijas": "Fixed allowance at ≥75% · extras only at 100% of fixed chores",
    "Fija €/sem": "Fixed €/wk", "Extra €/mes": "Extra €/mo",
    "Equilibrio de esfuerzo (adicionales)": "Effort balance (extra chores)",
    "Se reparte el peso, no el número de tareas.": "Effort is shared out, not the number of chores.",
    "Mercado de tareas entre hermanos": "Sibling chore marketplace",
    "Solo lectura. Los hijos se organizan; tú validas igualmente quién hace cada tarea.": "Read only. The children sort it out between themselves; you still approve who does each chore.",
    "En venta ahora": "On offer now", "Operaciones recientes": "Recent trades",
    "Aún no has generado el mes": "You have not generated the month yet",
    "Reparte las tareas fijas y adicionales para empezar.": "Assign fixed and extra chores to get started.",
    "Generar mes": "Generate month",

    // --- Los hijos ---
    "A entregar": "To pay", "Ver su ficha": "View details", "Comparativa del mes": "Monthly comparison",
    "Los mismos números para los tres, uno al lado del otro.": "The same figures for everyone, side by side.",
    "Puntos disponibles para premios": "Points available for rewards",
    "Los pedidos sin responder mantienen los puntos reservados.": "Unanswered requests keep the points on hold.",
    "No hay hijos configurados.": "No children set up.", "Ese hijo/a ya no existe.": "That child no longer exists.",
    "Puntos del mes": "Points this month", "Sin tareas fijas.": "No fixed chores.",
    "Sus tareas adicionales": "Their extra chores", "Todavía no tiene tareas repartidas.": "No chores assigned yet.",
    "Premios que ha pedido": "Rewards requested", "No ha pedido ningún premio.": "No rewards requested.",
    "Cuánta carga puede asumir": "How much they can take on",
    "Se usa al repartir las adicionales: quien tenga menos tiempo (exámenes, entrenamientos) recibe menos peso.": "Used when assigning extra chores: whoever has less time (exams, training) gets less load.",
    "Todavía no hay meses cerrados.": "No closed months yet.", "Historial": "History",

    // --- Calendario (padres) ---
    "Calendario de la semana": "Weekly calendar", "🪄 Organizar semana": "🪄 Organize week", "Organizar semana": "Organize week",
    "El plan se repite todas las semanas hasta que lo cambiéis. Elige un hijo para ver su tiempo ocupado. Pulsa una tarea para moverla.": "The plan repeats every week until you change it. Pick a child to see their busy time. Tap a chore to move it.",
    "Elige un hijo para ver su tiempo ocupado.": "Pick a child to see their busy time.",
    "Tareas que aún no tienen día.": "Chores without a day yet.",
    "las coloca solas en huecos libres.": "places them in free slots automatically.",
    "Todas las tareas tienen día. ✓": "Every chore has a day. ✓",
    "Las adicionales aparecerán aquí cuando repartas el mes.": "Extra chores will appear here once you assign the month.",
    "Horarios de cada hijo": "Each child's schedule",
    "Lo que cada uno tiene fijo cada semana. El calendario evita esas horas al organizar.": "Everyone's fixed weekly commitments. The calendar avoids those hours when organizing.",
    "Sin horarios: libre toda la semana.": "No schedule: free all week.",
    "Todo colocado": "Everything placed",
    "Todas las tareas ya tienen día. Para empezar de cero, usa": "Every chore already has a day. To start over, use",
    "🪄 Semana organizada": "🪄 Week organized",
    "tarea(s) colocadas en huecos libres.": "chore(s) placed in free slots.",
    "Su hijo no tiene ninguna franja libre. Revisa sus horarios o colócalas a mano.": "That child has no free slot. Check their schedule or place them by hand.",
    "Puedes mover cualquier tarea pulsando sobre ella.": "You can move any chore by tapping it.",
    "· adicional. Elige cuándo. Lo rayado es tiempo ocupado.": "· extra chore. Pick when. Hatched means busy.",
    "· semanal. Elige cuándo. Lo rayado es tiempo ocupado.": "· weekly chore. Pick when. Hatched means busy.",
    "Lo rayado es tiempo ocupado.": "Hatched means busy.",
    "Quitar del calendario": "Remove from calendar",
    "Algo que tenga fijo cada semana: colegio, entrenamiento, academia…": "Something they have every week: school, training, lessons…",
    "🏫 Colegio L–V": "🏫 School M–F", "⚽ Extraescolar": "⚽ After-school activity",
    "¿Qué es?": "What is it?", "Añadir al horario": "Add to schedule", "Ej. Fútbol": "e.g. Football",
    "Ponle un nombre (Colegio, Fútbol…).": "Give it a name (School, Football…).",
    "Marca al menos un día.": "Tick at least one day.",
    "La hora de fin tiene que ser posterior a la de inicio.": "The end time must be after the start time.",
    "¿Quitar todas las tareas del calendario? Los horarios se quedan.": "Remove every chore from the calendar? Schedules are kept.",
    "tiene ocupado": "is busy", "por la": "in the",
    "Colegio": "School",

    // --- Tareas fijas y adicionales ---
    "Lista común de tareas fijas": "Shared list of fixed chores",
    "Diaria": "Daily", "Semanal": "Weekly", "Una vez por semana": "Once a week",
    "Borrar tarea fija": "Delete fixed chore", "Borrar tarea adicional": "Delete extra chore",
    "Tareas adicionales": "Extra chores", "Catálogo": "Catalog", "Reparto actual": "Current assignment",
    "Volver a repartir": "Reassign", "Genera el mes para ver el reparto.": "Generate the month to see the assignment.",
    "Volver a repartir borrará el reparto actual, lo que tus hijos ya hayan marcado y los anuncios del mercado. ¿Continuar?": "Reassigning will erase the current assignment, whatever your children have already ticked and the marketplace listings. Continue?",
    "Nueva tarea fija": "New fixed chore", "Ej. Tender la cama": "e.g. Make the bed",
    "Nueva tarea adicional": "New extra chore", "Esfuerzo (pts)": "Effort (pts)", "Ej. Limpiar la cocina": "e.g. Clean the kitchen",

    // --- Validar ---
    "Validaciones": "Approvals", "Las tareas": "", "diarias": "Daily",
    "(hacer la cama, etc.) las marcan los hijos día a día y no necesitan tu validación. Aquí solo aparecen las": "chores (make the bed, etc.) are ticked by the children day by day and need no approval. Only",
    "semanales": "weekly", "y las": "and", "adicionales": "extra chores appear here",
    "por validar": "to approve", "Aprobar": "Approve", "Rechazar": "Send back", "sin empezar": "not started",
    "Marcar vencida": "Mark as late", "semanal": "weekly", "adicional": "extra",
    "Nada pendiente de validar.": "Nothing waiting for approval.",

    // --- Premios (padres) ---
    "Premios y canjes": "Rewards and redemptions",
    "Al conceder se descuentan los puntos. Al denegar, tu hijo/a los recupera.": "Granting deducts the points. Denying gives them back to your child.",
    "Premio": "Reward", "Pedido": "Requested", "Conceder": "Grant", "Denegar": "Deny",
    "No hay solicitudes pendientes.": "No pending requests.", "Catálogo de premios": "Reward catalog",
    "Lo que tus hijos pueden pedir con sus puntos. Desactiva uno para retirarlo sin borrar el historial.": "What your children can request with their points. Disable one to withdraw it without erasing the history.",
    "Coste": "Cost", "Quedan": "Left", "Sin premios todavía. Añade el primero.": "No rewards yet. Add the first one.",
    "Borrar premio": "Delete reward", "Nuevo premio": "New reward", "¿Qué se puede conseguir?": "What can be earned?",
    "Coste en puntos": "Cost in points", "Privilegio": "Privilege", "Tiempo": "Time", "Plan": "Outing", "Regalo": "Gift",
    "Unidades disponibles (vacío = sin límite)": "Units available (empty = unlimited)", "Añadir premio": "Add reward",
    "Ej. Elegir la peli del finde": "e.g. Pick the weekend movie", "sin límite": "unlimited",
    "Pon un coste en puntos.": "Set a cost in points.",

    // --- Menús ---
    "Planificador de menús": "Meal planner", "Menú de la semana": "This week's meals",
    "Elige desayuno, comida y cena de cada día, o genera la semana entera desde tu base de platos.": "Pick breakfast, lunch and dinner for each day, or generate the whole week from your dish database.",
    "🎲 Generar semana": "🎲 Generate week", "Desayuno": "Breakfast", "Comida": "Lunch", "Cena": "Dinner",
    "desayuno": "breakfast", "comida": "lunch", "cena": "dinner",
    "Base de platos": "Dish database", "+ Plato": "+ Dish", "Borrar plato": "Delete dish", "Sin platos todavía.": "No dishes yet.",
    "Nuevo plato": "New dish", "Nombre del plato": "Dish name", "¿Para qué comida?": "Which meal?",
    "Añadir a la base": "Add to database", "Ej. Curry de garbanzos": "e.g. Chickpea curry",

    // --- Economía y ajustes ---
    "Economía y ajustes": "Economy and settings", "Parámetros de dinero": "Money settings",
    "Paga fija por semana (€)": "Fixed weekly allowance (€)", "Euros por punto en adicionales": "Euros per point on extra chores",
    "Regla: ≥75% de fijas → cobra la paga fija. 100% de fijas → además gana las adicionales.": "Rule: ≥75% of fixed chores → earns the fixed allowance. 100% → also earns the extra chores.",
    "Disponibilidad de cada hijo/a": "Each child's availability", "Normal": "Normal", "Reducida": "Reduced", "Mínima": "Minimal",
    "Reiniciar datos de ejemplo": "Reset to sample data",
    "🔒 Acceso a la casa": "🔒 Household access", "En la demo no hay código de casa.": "The demo has no house code.",
    "Sin código de casa": "No house code",
    "Se entra solo con la dirección. Si algún día queréis que pida un código (por ejemplo, para publicarla), basta con poner": "Anyone with the address can get in. If you ever want it to ask for a code (for example, to publish it), just set",
    "en Render: pasos en": "on Render: steps in", "(«Enabling the house code»).": "(“Enabling the house code”).",
    "✓ Protegida con código de casa": "✓ Protected with a house code",
    "Para un móvil nuevo, mándale este enlace una vez (WhatsApp, AirDrop…). En un iPhone con la app ya instalada, escribe el código dentro de la app.": "For a new phone, send it this link once (messaging app, AirDrop…). On an iPhone with the app already installed, type the code inside the app.",
    "📋 Copiar enlace": "📋 Copy link", "Ver código": "Show code",
    "Enlace copiado. Pégalo en un mensaje para el móvil nuevo.": "Link copied. Paste it in a message to the new phone.",
    "Copia este enlace:": "Copy this link:", "Abre este enlace para entrar en Casa:": "Open this link to join Casa:",
    "🔔 Avisos": "🔔 Notifications", "En la demo no hay avisos.": "The demo has no notifications.",
    "Cada uno los activa en su móvil (en iPhone, con la app en la pantalla de inicio). Recordatorio cada tarde + avisos al momento cuando alguien entrega, aprueba o pide algo.": "Everyone enables them on their own phone (on iPhone, with the app on the home screen). A reminder every afternoon + instant notifications when someone submits, approves or requests something.",
    "🗂️ Copias de seguridad": "🗂️ Backups", "Se guarda una": "One is saved", "cada día": "every day",
    "sola (las últimas 30) y otra justo antes de reiniciar o restaurar. Volver atrás es un clic.": "automatically (the last 30), plus another one right before any reset or restore. Going back takes one click.",
    "Volver a esta": "Restore this one", "⬇️ Descargar copia": "⬇️ Download backup", "⬆️ Restaurar desde archivo": "⬆️ Restore from file",
    "Si la copia nocturna está activada (solo en repositorios privados), cada noche se guarda otra fuera, en GitHub (rama": "If the nightly backup is enabled (private repositories only), another copy is stored off-site every night, on GitHub (branch",
    "No se pudieron cargar las copias.": "Could not load the backups.",
    "Todavía no hay copias: se hará la primera hoy.": "No backups yet: the first one will be made today.",
    "Diaria": "Daily", "Antes de reiniciar": "Before reset", "Antes de restaurar": "Before restore",
    "En la demo no se restauran copias.": "Backups cannot be restored in the demo.",
    "En la demo no se descargan copias.": "Backups cannot be downloaded in the demo.",
    "Lo de ahora se guarda antes como copia: se puede deshacer.": "The current state is saved as a backup first: it can be undone.",
    "No se pudo restaurar. Inténtalo de nuevo.": "Could not restore. Please try again.",
    "No se pudo descargar la copia. Inténtalo de nuevo.": "Could not download the backup. Please try again.",
    "El archivo no es una copia válida.": "The file is not a valid backup.",
    "El archivo no parece una copia de esta app.": "The file does not look like a backup from this app.",
    "Esto reemplazará TODOS los datos actuales por los de la copia (lo de ahora se guarda antes como copia). ¿Continuar?": "This will replace ALL current data with the backup (the current state is saved as a backup first). Continue?",
    "Copia restaurada correctamente.": "Backup restored successfully.",
    "Antes se guarda una copia: se puede deshacer desde «Copias de seguridad». ¿Continuar?": "A backup is saved first: it can be undone from “Backups”. Continue?",
    "No se pudo reiniciar. Inténtalo de nuevo.": "Could not reset. Please try again.",

    // --- Avisos en el móvil ---
    "✓ Avisos activados aquí": "✓ Notifications enabled here", "🔔 Activar avisos": "🔔 Enable notifications",
    "🔔 Que no se te olvide nada": "🔔 Never forget a thing", "Activar avisos": "Enable notifications", "Ahora no": "Not now",
    "Desactivar avisos": "Disable notifications", "Probar": "Test", "Enviar aviso de prueba": "Send a test notification",
    "Activa los avisos y te recordamos por la tarde lo que te toca. También te enteras al momento cuando te aprueban algo.": "Enable notifications and we'll remind you every afternoon of what's due. You'll also hear right away when something gets approved.",
    "Este navegador no admite avisos.": "This browser does not support notifications.",
    "Has bloqueado los avisos. Para activarlos: Ajustes del móvil → Notificaciones → Casa.": "You have blocked notifications. To enable them: phone Settings → Notifications → Casa.",
    "Sin permiso no se pueden mandar avisos.": "Notifications cannot be sent without permission.",
    "No se pudieron activar los avisos. Inténtalo de nuevo.": "Could not enable notifications. Please try again.",
    "Este móvil no tiene los avisos activados.": "This phone does not have notifications enabled.",
    "No se pudo mandar el aviso de prueba.": "Could not send the test notification.",
    "Los avisos están bloqueados en este dispositivo. Actívalos en Ajustes → Notificaciones → Casa.": "Notifications are blocked on this device. Enable them in Settings → Notifications → Casa.",
    "Para recibir avisos en el iPhone, primero añade Casa a la pantalla de inicio: en Safari, botón Compartir → «Añadir a pantalla de inicio». Después ábrela desde ese icono y activa los avisos.": "To get notifications on an iPhone, first add Casa to the home screen: in Safari, Share → “Add to Home Screen”. Then open it from that icon and enable notifications.",

    // --- Móvil: inicio ---
    "📅 Hoy te toca": "📅 Due today", "adicional · por hacer": "extra · to do", "adicional · hecha ✓": "extra · done ✓",
    "adicional · esperando visto bueno": "extra · awaiting approval", "adicional · en el mercado": "extra · in the marketplace",
    "semanal · por hacer": "weekly · to do", "semanal · hecha ✓": "weekly · done ✓", "semanal · esperando visto bueno": "weekly · awaiting approval",
    "todo hecho ✓": "all done ✓", "Ganado este mes": "Earned this month",
    "Paga fija ✓": "Fixed allowance ✓", "Paga fija en riesgo": "Fixed allowance at risk",
    "Extras al 100% de fijas": "Extras at 100% of fixed chores", "Extras desbloqueadas": "Extras unlocked",
    "Tus tareas fijas (esta semana)": "Your fixed chores (this week)",
    "Paga fija asegurada. Complétalas todas para desbloquear las extras.": "Fixed allowance secured. Finish them all to unlock the extras.",
    "Llega al 75% para asegurar tu paga fija.": "Reach 75% to secure your fixed allowance.",
    "¡Todo al día! Ya puedes ganar con las adicionales.": "All caught up! You can now earn with extra chores.",
    "Esperando visto bueno": "Awaiting approval", "Adicionales (dinero extra)": "Extra chores (extra money)",
    "Aprobada ✓": "Approved ✓", "Toca a ti": "Your turn", "Hecha": "Done", "Hecha ✓": "Done ✓",
    "🏷️ en el mercado": "🏷️ in the marketplace", "Retirar": "Withdraw", "El mes aún no está repartido.": "This month has not been assigned yet.",
    "por hacer": "to do", "esperando visto bueno": "awaiting approval",

    // --- Móvil: semana ---
    "Tu semana, organizada por tus papás según tus horarios.": "Your week, organized by your parents around your schedule.",
    "Todos los días": "Every day", "Sin tareas este día.": "No chores this day.",
    "Tus papás aún no han organizado la semana.": "Your parents have not organized the week yet.",

    // --- Móvil: mercado ---
    "Vende una tarea ofreciendo puntos a quien la haga, o cámbiala por otra. Os organizáis entre vosotros.": "Sell a chore by offering points to whoever does it, or swap it for another one. You sort it out between yourselves.",
    "🛒 Tablón de la familia": "🛒 Family board", "pts extra": "extra pts", "Ofrecer trueque": "Offer a swap",
    "📦 Tus tareas adicionales": "📦 Your extra chores", "Vender / cambiar": "Sell / swap",
    "🧾 Movimientos recientes": "🧾 Recent activity", "🏷️ Tus anuncios": "🏷️ Your listings",
    "Aún sin ofertas": "No offers yet", "Nadie ha puesto tareas ahora mismo.": "Nobody has listed any chores right now.",
    "No tienes tareas adicionales libres para vender.": "You have no free extra chores to sell.",
    "Cuando tus padres asignen las tareas adicionales, podrás venderlas o cambiarlas aquí.": "Once your parents assign the extra chores, you can sell or swap them here.",
    "Ya se la has pedido": "Already requested", "¿Te quedas esta tarea?": "Take this chore?",
    "Ganarás al completarla": "You will earn when you finish it", "Pedírsela": "Ask for it",
    "Ofrecer un trueque": "Offer a swap", "Quieres la": "You want", "¿Qué tarea tuya ofreces a cambio?": "Which of your chores do you offer in return?",
    "Puntos que pides además (si su tarea es más pesada)": "Extra points you ask for (if their chore is heavier)",
    "Enviar oferta": "Send offer", "Le darás": "You will give", "Sin puntos de por medio.": "No points involved.",
    "A cambio tú harás:": "In return you will do:", "Te pide además:": "They also ask for:",
    "Sin tareas para cambiar": "No chores to swap", "No tienes tareas adicionales libres que ofrecer a cambio.": "You have no free extra chores to offer in return.",
    "Poner en el mercado": "List in the marketplace", "Puntos extra que ofreces a quien la haga": "Extra points you offer whoever does it",
    "Aceptar también ofertas de trueque": "Also accept swap offers", "Nota (opcional)": "Note (optional)", "Publicar": "Publish",
    "Ej. esta semana no puedo, ¿alguien?": "e.g. I can't this week, anyone?",
    "Ofrece puntos o permite trueque (o ambos).": "Offer points or allow swaps (or both).",
    "Ya has pedido esta tarea. Espera a que te responda.": "You have already asked for this chore. Wait for a reply.",
    "Elige una tarea válida tuya.": "Pick a valid chore of yours.", "Esa tarea ya no está disponible.": "That chore is no longer available.",
    "La tarea que te ofrecían ya no está disponible.": "The chore you were offered is no longer available.",
    "· acepta trueque": "· accepts swaps", "Acepta trueque": "Accepts swaps",

    // --- Móvil: logros, menú y premios ---
    "Tu trabajo este mes": "Your work this month", "Puntos acumulados": "Points earned", "Mes anterior": "Last month",
    "El nivel se reinicia cada mes: refleja cuánto has trabajado este mes.": "Your level resets every month: it reflects how much you worked this month.",
    "El nivel se reinicia el día 1 de cada mes.": "Your level resets on the 1st of every month.",
    "Adicionales hechas": "Extra chores done",
    "1ª tarea": "1st chore", "Fijas 100%": "Fixed 100%", "Trato justo": "Fair deal",
    "Hoy se come": "Today's meals", "Toda la semana": "The whole week", "Aún no hay menú para hoy.": "No meals planned for today.",
    "Puedes gastar": "You can spend", "Canjear": "Redeem", "Tus solicitudes": "Your requests",
    "Esperando respuesta": "Awaiting reply", "Cancelar solicitud": "Cancel request",
    "Tus padres aún no han puesto premios.": "Your parents have not added any rewards yet.",
    "Canjear premio": "Redeem reward", "Enviar solicitud": "Send request",
    "Los puntos se te reservan ahora. Cuando tus padres lo aprueben, se descontarán; si lo deniegan, los recuperas.": "Your points are reserved now. When your parents approve it they will be deducted; if they deny it, you get them back.",
    "Ese premio ya no está disponible.": "That reward is no longer available.", "No te llegan los puntos.": "You do not have enough points.",
    "¿Cancelar la solicitud? Recuperas los puntos.": "Cancel the request? You get your points back.",

    // --- Avisos push (servidor) ---
    "Toca darle el visto bueno.": "Time to approve it.", "Buen trabajo.": "Great job.",
    "Tus papás te la han devuelto. Échale otro vistazo.": "Your parents sent it back. Give it another go.",
    "¡A disfrutarlo!": "Enjoy!", "Recuperas tus puntos.": "Your points are back.",
    "Míralo en el Mercado.": "Check it in the Marketplace.", "Ahora la tarea es tuya.": "The chore is yours now.",
    "Puedes probar con otra.": "You can try another one.", "👀 Os esperan": "👀 Waiting for you",
    "🔔 Los avisos funcionan": "🔔 Notifications are working",
    "Así te llegará lo que pase en Casa.": "This is how Casa will keep you posted.",
    "Hay novedades en Casa.": "There is news in Casa.",
  };

  // Más concretos primero: se usa el primero que encaja.
  const PATRONES_EN = [
    ["Nivel {1} · {2} pts este mes", "Level {1} · {2} pts this month"],
    ["Nivel {1} · {2} pts", "Level {1} · {2} pts"],
    ["Nivel {1}", "Level {1}"],
    ["Hola, {1}", "Hi, {1}"],
    ["{1}% fijas", "{1}% fixed"],
    ["{1} por validar", "{1} to approve"],
    ["{1} premio(s)", "{1} reward(s)"],
    ["{1} de {2} franjas libres", "{1} of {2} slots free"],
    ["{1} libres · {2} reservados", "{1} available · {2} on hold"],
    ["{1} libres", "{1} available"],
    ["⚠ {1} tarea(s) en una franja ocupada.", "⚠ {1} chore(s) in a busy slot."],
    ["Sin colocar ({1})", "Unscheduled ({1})"],
    ["Sin hueco ({1})", "No free slot ({1})"],
    ["Solicitudes por responder ({1})", "Requests awaiting a reply ({1})"],
    ["{1} · adicional · {2} pts", "{1} · extra · {2} pts"],
    ["{1} · semanal", "{1} · weekly"],
    ["{1} · ofrece {2} pts · acepta trueque", "{1} · offers {2} pts · accepts swaps"],
    ["{1} · ofrece {2} pts", "{1} · offers {2} pts"],
    ["{1} · acepta trueque", "{1} · accepts swaps"],
    ["Ofreces {1} pts · Acepta trueque", "You offer {1} pts · Accepts swaps"],
    ["Ofreces {1} pts", "You offer {1} pts"],
    ["de {1} ({2} pts)", "from {1} ({2} pts)"],
    ["de {1} · esfuerzo {2}", "from {1} · effort {2}"],
    ["{1} se quedó", "{1} took"],
    ["Cada día · {1} por semana", "Every day · {1} per week"],
    ["Las mismas para todos los hijos. Base de la paga fija ({1}/semana al completar ≥75%). Marca cada tarea como diaria o semanal.",
      "The same for every child. They make up the fixed allowance ({1}/week at ≥75% completion). Mark each chore as daily or weekly."],
    ["Dan dinero extra (puntos × {1}). Se reparten por peso entre los hijos.", "They earn extra money (points × {1}). Assigned by effort among the children."],
    ["Reciben avisos: {1}", "Notifications for: {1}"],
    ["👀 {1} · cambiar", "👀 {1} · switch"],
    ["Diaria · {1}/7 días ✓", "Daily · {1}/7 days ✓"],
    ["Diaria · {1}/7 días", "Daily · {1}/7 days"],
    ["Diaria · {1}", "Daily · {1}"],
    ["Antes de reiniciar · {1}", "Before reset · {1}"],
    ["Antes de restaurar · {1}", "Before restore · {1}"],
    ["Mañana {1}", "Morning {1}"], ["Tarde {1}", "Afternoon {1}"], ["Noche {1}", "Evening {1}"],
    ["{1} · Mañana · {2}", "{1} · Morning · {2}"], ["{1} · Tarde · {2}", "{1} · Afternoon · {2}"], ["{1} · Noche · {2}", "{1} · Evening · {2}"],
    ["{1} · Mañana", "{1} · Morning"], ["{1} · Tarde", "{1} · Afternoon"], ["{1} · Noche", "{1} · Evening"],
    ["{1} por la mañana", "{1} morning"], ["{1} por la tarde", "{1} afternoon"], ["{1} por la noche", "{1} evening"],
    ["Horario de {1}", "{1}'s schedule"],
    ["{1} pendientes", "{1} pending"], ["{1} pendiente", "{1} pending"],
    ["🔥 Racha de {1} días", "🔥 {1}-day streak"],
    ["🔥 {1} días", "🔥 {1} days"],
    ["Racha {1}", "Streak {1}"],
    ["{1} tareas", "{1} chores"], ["{1} tarea", "{1} chore"],
    ["Pedírsela (+{1})", "Ask for it (+{1})"],
    ["{1} · {2} pts de esfuerzo", "{1} · {2} pts of effort"],
    ["{1} pts de esfuerzo", "{1} pts of effort"],
    ["+{1} pts de mercado", "+{1} marketplace pts"],
    ["{1}/100 pts para el siguiente", "{1}/100 pts to the next level"],
    ["{1} · quedan {2}", "{1} · {2} left"],
    ["Te faltan {1} pts", "You need {1} more pts"],
    ["De {1} pts, tienes {2} pedidos", "{2} of your {1} pts are on hold"],
    ["Vas a pedir \"", "You are requesting \""],
    ["\" por", "\" for"],
    ["{1} tiene que aceptarlo antes de que la tarea pase a ser tuya.", "{1} has to accept before the chore becomes yours."],
    ["de {1}", "from {1}"],
    // Diálogos con datos
    ["Esto reiniciará TODOS los datos de la casa: tareas, puntos, premios e historial. Los perfiles de {1} se quedan.",
      "This will reset ALL household data: chores, points, rewards and history. The profiles of {1} are kept."],
    ["¿Volver la casa a como estaba el {1}?", "Restore the household to how it was on {1}?"],
    ["Hecho. La casa está como el {1}.", "Done. The household is back to {1}."],
    ["¿Borrar \"{1}\" de la base de platos?", "Delete \"{1}\" from the dish database?"],
    ["¿Borrar \"{1}\" del horario de {2}?", "Delete \"{1}\" from {2}'s schedule?"],
    ["\"{1}\" tiene {2} solicitud(es) en el historial. Si lo borras, esas líneas quedarán sin nombre. ¿Mejor desactivarlo?",
      "\"{1}\" has {2} request(s) in the history. If you delete it, those lines will lose their name. Disable it instead?"],
    ["¿Borrar de todos modos?", "Delete anyway?"],
    ["¿Borrar \"{1}\"?", "Delete \"{1}\"?"],
    // Avisos push (servidor)
    ["✅ {1} ha hecho «{2}»", "✅ {1} finished “{2}”"],
    ["👏 ¡Aprobada! «{1}»", "👏 Approved! “{1}”"],
    ["+{1} puntos. Buen trabajo.", "+{1} points. Great job."],
    ["↩️ «{1}» necesita un repaso", "↩️ “{1}” needs another look"],
    ["🎁 {1} pide «{2}»", "🎁 {1} is asking for “{2}”"],
    ["{1} puntos. Podéis concederlo o denegarlo en Premios.", "{1} points. You can grant or deny it under Rewards."],
    ["🎉 Te conceden «{1}»", "🎉 You got “{1}”"],
    ["Premio denegado: «{1}»", "Reward denied: “{1}”"],
    ["📥 {1} te propone un cambio por «{2}»", "📥 {1} proposes a swap for “{2}”"],
    ["📥 {1} quiere quedarse «{2}»", "📥 {1} wants to take “{2}”"],
    ["🤝 {1} acepta: «{2}»", "🤝 {1} accepted: “{2}”"],
    ["{1} no acepta tu oferta", "{1} declined your offer"],
    ["📅 Hoy te toca, {1}", "📅 Due today, {1}"],
    ["📅 {1}, ¿ya lo has hecho?", "📅 {1}, have you done it yet?"],
    ["y marca: {1}", "and tick off: {1}"],
    ["Marca: {1}", "Tick off: {1}"],
    ["{1} tarea por validar y {2} premio pedido.", "{1} chore to approve and {2} reward requested."],
    ["{1} tarea por validar y {2} premios pedidos.", "{1} chore to approve and {2} rewards requested."],
    ["{1} tareas por validar y {2} premio pedido.", "{1} chores to approve and {2} reward requested."],
    ["{1} tareas por validar y {2} premios pedidos.", "{1} chores to approve and {2} rewards requested."],
    ["{1} tarea por validar.", "{1} chore to approve."], ["{1} tareas por validar.", "{1} chores to approve."],
    ["{1} premio pedido.", "{1} reward requested."], ["{1} premios pedidos.", "{1} rewards requested."],
    ["🔔 {1} novedades en Casa", "🔔 {1} updates in Casa"],
  ];
  registrar("en", CATALOGO_EN, PATRONES_EN);

  return {
    IDIOMAS, IDIOMA_ORIGEN, CLAVE_IDIOMA,
    esIdiomaValido, normalizarIdioma, localeDe, diasCortos, diasLargos, nombresMeses,
    traducirFrase, traducirMensaje, traducirAviso,
    idiomaGuardado, guardarIdioma, traducirDom, observarIdioma,
  };
});
