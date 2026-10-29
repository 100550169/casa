// ============================================================================
//  Generador de iconos de "Casa".
//
//  Escribe los PNG del icono sin depender de ninguna librería externa: dibuja
//  los píxeles a mano y los comprime con zlib, que ya viene con Node.
//  Así el proyecto sigue sin dependencias de compilación.
//
//  Uso:  node herramientas/generar-iconos.js
//
//  Genera en public/iconos/:
//    icono-192.png          icono normal (Android/PWA)
//    icono-512.png          icono normal grande + fuente para Bubblewrap
//    icono-512-maskable.png versión con margen, para los iconos recortados
//                           en círculo/cuadrado redondeado de Android
//    apple-touch-icon.png   180x180, para "Añadir a pantalla de inicio" en iPhone
// ============================================================================
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SALIDA = path.join(__dirname, "..", "public", "iconos");

// --- Utilidades de color ----------------------------------------------------
const mezcla = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
// Paleta de la app (las mismas variables CSS que usa index.html)
const CORAL = [0xff, 0x7a, 0x59]; // --accent
const SOL   = [0xff, 0xc2, 0x4b]; // --sun
const CREMA = [0xff, 0xf6, 0xea];
const MARRON= [0x43, 0x35, 0x2a]; // --text

// --- Escritura de PNG -------------------------------------------------------
function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo) >>> 0, 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

let TABLA_CRC = null;
function crc32(buf) {
  if (!TABLA_CRC) {
    TABLA_CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLA_CRC[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// pixeles: Buffer RGBA de ancho*alto*4
function escribirPng(ruta, ancho, alto, pixeles) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8;    // 8 bits por canal
  cabecera[9] = 6;    // RGBA
  cabecera[10] = 0; cabecera[11] = 0; cabecera[12] = 0;

  // Cada fila del PNG va precedida por un byte de filtro (0 = ninguno)
  const crudo = Buffer.alloc(alto * (1 + ancho * 4));
  for (let y = 0; y < alto; y++) {
    crudo[y * (1 + ancho * 4)] = 0;
    pixeles.copy(crudo, y * (1 + ancho * 4) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", cabecera),
    trozo("IDAT", zlib.deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(ruta, png);
  return png.length;
}

// --- Dibujo del icono -------------------------------------------------------
// opciones:
//   margen        proporción de aire alrededor del dibujo (0 = llena el lienzo)
//   sinRecorte    true  = fondo OPACO que llena todo el cuadrado, sin esquinas
//                         redondeadas ni transparencia. Obligatorio para el
//                         icono de Apple (iOS descarta o ennegrece los PNG con
//                         canal alfa) y para los "maskable" de Android, que
//                         recorta el sistema con su propia forma.
//                 false = cuadrado redondeado con las esquinas transparentes.
//   zonaSegura    con sinRecorte, qué proporción del centro ocupa el dibujo,
//                 para que no se coma nada el recorte del sistema.
function dibujar(tam, margen, opciones) {
  const sinRecorte = !!(opciones && opciones.sinRecorte);
  const zonaSegura = (opciones && opciones.zonaSegura) || 0.76;
  const px = Buffer.alloc(tam * tam * 4);
  const poner = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= tam || y >= tam) return;
    const i = (y * tam + x) * 4;
    // Mezcla sobre lo que ya hubiera (para los bordes suavizados)
    const af = a / 255, ab = px[i + 3] / 255;
    const ao = af + ab * (1 - af);
    if (ao === 0) return;
    px[i]     = Math.round((r * af + px[i]     * ab * (1 - af)) / ao);
    px[i + 1] = Math.round((g * af + px[i + 1] * ab * (1 - af)) / ao);
    px[i + 2] = Math.round((b * af + px[i + 2] * ab * (1 - af)) / ao);
    px[i + 3] = Math.round(ao * 255);
  };

  // --- Geometría del FONDO ---
  // Con sinRecorte el fondo llena todo el lienzo y queda opaco.
  const m = sinRecorte ? 0 : Math.round(tam * margen);
  const lado = tam - m * 2;
  const radio = sinRecorte ? 0 : lado * 0.235;  // esquinas como las tarjetas
  const cx0 = m, cy0 = m, cx1 = m + lado, cy1 = m + lado;

  // Cobertura de un píxel dentro del cuadrado redondeado (con suavizado)
  function coberturaFondo(x, y) {
    if (sinRecorte) return 1;             // opaco de borde a borde
    const MUESTRAS = 3, paso = 1 / MUESTRAS;
    let dentro = 0;
    for (let sy = 0; sy < MUESTRAS; sy++) {
      for (let sx = 0; sx < MUESTRAS; sx++) {
        const px2 = x + (sx + 0.5) * paso, py2 = y + (sy + 0.5) * paso;
        if (px2 < cx0 || px2 > cx1 || py2 < cy0 || py2 > cy1) continue;
        // Distancia a la esquina más cercana
        const qx = Math.max(cx0 + radio - px2, 0, px2 - (cx1 - radio));
        const qy = Math.max(cy0 + radio - py2, 0, py2 - (cy1 - radio));
        if (qx * qx + qy * qy <= radio * radio) dentro++;
      }
    }
    return dentro / (MUESTRAS * MUESTRAS);
  }

  // Fondo: degradado coral → sol en diagonal
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const cob = coberturaFondo(x, y);
      if (cob <= 0) continue;
      const t = Math.min(1, Math.max(0, ((x - cx0) + (y - cy0)) / (lado * 2)));
      poner(x, y, mezcla(CORAL, SOL, t), Math.round(cob * 255));
    }
  }

  // --- Geometría del CONTENIDO (la casita) ---
  // Con sinRecorte se encoge al centro para sobrevivir al recorte del sistema.
  const ladoC = sinRecorte ? tam * zonaSegura : lado;
  const oxC = sinRecorte ? (tam - ladoC) / 2 : cx0;
  const oyC = sinRecorte ? (tam - ladoC) / 2 : cy0;

  const centroX = oxC + ladoC / 2;
  const tejadoY = oyC + ladoC * 0.30;     // vértice del tejado
  const aleroY  = oyC + ladoC * 0.52;     // base del tejado
  const baseY   = oyC + ladoC * 0.74;     // suelo de la casa
  const medioAncho = ladoC * 0.30;        // medio ancho del tejado
  const muroMedio  = ladoC * 0.205;       // medio ancho del cuerpo

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const MUESTRAS = 3, paso = 1 / MUESTRAS;
      let dentro = 0;
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const fx = x + (sx + 0.5) * paso, fy = y + (sy + 0.5) * paso;
          let hit = false;
          // Tejado: triángulo
          if (fy >= tejadoY && fy <= aleroY) {
            const prog = (fy - tejadoY) / (aleroY - tejadoY);
            if (Math.abs(fx - centroX) <= medioAncho * prog) hit = true;
          }
          // Cuerpo: rectángulo
          if (!hit && fy > aleroY && fy <= baseY && Math.abs(fx - centroX) <= muroMedio) hit = true;
          // Puerta: se recorta del cuerpo
          if (hit && fy > baseY - ladoC * 0.155 && Math.abs(fx - centroX) <= ladoC * 0.072) hit = false;
          if (hit) dentro++;
        }
      }
      if (dentro > 0) poner(x, y, CREMA, Math.round((dentro / (MUESTRAS * MUESTRAS)) * 255));
    }
  }

  return px;
}

// --- Generación -------------------------------------------------------------
fs.mkdirSync(SALIDA, { recursive: true });

const trabajos = [
  // --- PWA / Android: cuadrado redondeado con esquinas transparentes ---
  { archivo: "icono-192.png", tam: 192, margen: 0 },
  { archivo: "icono-512.png", tam: 512, margen: 0 },

  // --- Android "maskable": lo recorta el sistema con su propia forma ---
  // Tiene que ser OPACO y llenar todo el cuadrado; si tuviera las esquinas
  // transparentes se verían negras al aplicar la máscara.
  { archivo: "icono-512-maskable.png", tam: 512, sinRecorte: true, zonaSegura: 0.72 },

  // --- iOS ("Añadir a pantalla de inicio") ---
  // iOS NO admite transparencia aquí: compone el alfa sobre negro y en varias
  // versiones descarta el icono entero (queda sin icono). Por eso van opacos y
  // sin redondear: el redondeo lo aplica iOS.
  { archivo: "apple-touch-icon.png", tam: 180, sinRecorte: true, zonaSegura: 0.80 },
  { archivo: "apple-touch-icon-167.png", tam: 167, sinRecorte: true, zonaSegura: 0.80 }, // iPad Pro
  { archivo: "apple-touch-icon-152.png", tam: 152, sinRecorte: true, zonaSegura: 0.80 }, // iPad
  { archivo: "apple-touch-icon-120.png", tam: 120, sinRecorte: true, zonaSegura: 0.80 }, // iPhone antiguos
];

for (const t of trabajos) {
  const px = dibujar(t.tam, t.margen || 0, { sinRecorte: t.sinRecorte, zonaSegura: t.zonaSegura });
  const bytes = escribirPng(path.join(SALIDA, t.archivo), t.tam, t.tam, px);
  const nota = t.sinRecorte ? "opaco" : "con transparencia";
  console.log("  " + t.archivo.padEnd(30) + (t.tam + "x" + t.tam).padEnd(10) +
              (bytes / 1024).toFixed(1).padStart(6) + " kB   " + nota);
}

// iOS busca /apple-touch-icon.png en la raíz del sitio si no encuentra la
// etiqueta <link>. Se deja una copia ahí como red de seguridad.
fs.copyFileSync(
  path.join(SALIDA, "apple-touch-icon.png"),
  path.join(__dirname, "..", "public", "apple-touch-icon.png")
);
console.log("\nIconos generados en public/iconos/ (+ copia en la raíz para iOS)");
