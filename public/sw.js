// ============================================================================
//  Service worker de "Casa".
//
//  REGLA IMPORTANTE: aquí NO se cachea nada de /api/.
//  El estado de la familia es compartido y se sincroniza cada 4 segundos; si el
//  service worker sirviera respuestas guardadas de la API, los dispositivos
//  verían datos viejos y volveríamos a tener el problema de estado obsoleto que
//  ya costó arreglar. Solo se guarda el "cascarón" (HTML, iconos, manifest),
//  que es lo que permite que la app abra al instante y muestre un mensaje
//  decente cuando no hay conexión.
// ============================================================================
// OJO: al cambiar cualquier archivo de CASCARON hay que SUBIR ESTE NÚMERO.
// Si no, los dispositivos que ya tengan la app instalada seguirán sirviendo la
// copia vieja guardada en su caché y no verán el cambio nunca.
// v2 (ago 2026): iconos de iOS regenerados sin transparencia.
// v3 (ago 2026): el JavaScript pasa a "red primero" para que los cambios de
//                código lleguen de inmediato, y se añade demo.js.
// v4 (sep 2026): fuera las cuentas. Hay que renovar el cascarón porque el HTML
//                guardado todavía pediría la pantalla de inicio de sesión.
// v5 (oct 2026): avisos en el móvil (push) y código de casa. El service worker
//                nuevo tiene que instalarse para poder recibir avisos.
const VERSION = "casa-v5";
const CASCARON = [
  "/",
  "/manifest.webmanifest",
  "/iconos/icono-192.png",
  "/iconos/icono-512.png",
  "/iconos/icono-512-maskable.png",
  "/iconos/apple-touch-icon.png",
  "/iconos/apple-touch-icon-167.png",
  "/iconos/apple-touch-icon-152.png",
  "/iconos/apple-touch-icon-120.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CASCARON))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  // Solo se gestiona lo de este mismo servidor y solo lecturas.
  if (url.origin !== self.location.origin || peticion.method !== "GET") return;

  // La API NUNCA pasa por caché: siempre a la red, sin excepción.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.well-known/")) return;

  // Navegación (abrir la app): red primero; si no hay conexión, el cascarón.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((c) => c.put("/", copia)).catch(() => {});
          return respuesta;
        })
        .catch(() => caches.match("/").then((r) => r || respuestaSinConexion()))
    );
    return;
  }

  // Imágenes y manifest: caché primero (casi nunca cambian y así abre al
  // instante). Cuando cambien de verdad, se sube VERSION y se renuevan.
  const esImagen = /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname) ||
                   url.pathname === "/manifest.webmanifest";
  if (esImagen) {
    evento.respondWith(
      caches.match(peticion).then((guardada) => guardada || fetch(peticion).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((c) => c.put(peticion, copia)).catch(() => {});
        }
        return respuesta;
      }))
    );
    return;
  }

  // Todo lo demás (JavaScript, CSS…): RED PRIMERO, con la caché como respaldo
  // si no hay conexión.
  // Antes esto era "caché primero" y provocaba que un cambio en el código no
  // llegara nunca a quien ya tuviera la app instalada: seguía ejecutando la
  // versión vieja guardada. Como la app se actualiza sola al desplegar, la
  // prioridad aquí es traer siempre lo último.
  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((c) => c.put(peticion, copia)).catch(() => {});
        }
        return respuesta;
      })
      .catch(() => caches.match(peticion))
  );
});

// ---------------------------------------------------------------------------
//  Avisos en el móvil (Web Push)
//
//  Llegan aunque la app esté cerrada. Hay que mostrar SIEMPRE una
//  notificación por cada aviso recibido: Safari retira el permiso a las webs
//  que reciben avisos "silenciosos" sin enseñar nada.
// ---------------------------------------------------------------------------
self.addEventListener("push", (evento) => {
  let datos = {};
  try { datos = evento.data ? evento.data.json() : {}; } catch (e) { datos = {}; }
  evento.waitUntil(self.registration.showNotification(datos.titulo || "Casa", {
    body: datos.cuerpo || "Hay novedades en Casa.",
    // Con la misma etiqueta, un aviso nuevo sustituye al anterior en vez de
    // amontonarse (p. ej. la misma tarea aprobada y luego devuelta).
    tag: datos.etiqueta || "casa",
    icon: "/iconos/icono-192.png",
    badge: "/iconos/icono-192.png",
    data: { url: "/" },
  }));
});

// Al tocar el aviso: si la app ya está abierta, se trae al frente; si no, se abre.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = (evento.notification.data && evento.notification.data.url) || "/";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      return abierta ? abierta.focus() : self.clients.openWindow(url);
    })
  );
});

function respuestaSinConexion() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Casa · sin conexión</title>' +
    '<div style="font-family:system-ui,sans-serif;background:#fef6ea;color:#43352a;min-height:100vh;' +
    'display:grid;place-items:center;text-align:center;padding:24px;margin:0">' +
    '<div><div style="font-size:48px">🏠</div><h1 style="font-size:22px">Sin conexión</h1>' +
    '<p style="color:#9c8a76;max-width:320px">No se puede conectar con el servidor de la familia. ' +
    'Comprueba tu conexión y vuelve a intentarlo.</p>' +
    '<button onclick="location.reload()" style="font:inherit;font-weight:700;background:#ff7a59;color:#fff;' +
    'border:none;padding:12px 20px;border-radius:14px">Reintentar</button></div></div>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
