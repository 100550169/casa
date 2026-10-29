// ============================================================================
//  Arnés compartido para probar la lógica del cliente.
//
//  Toda la app vive en el <script> de public/index.html. Aquí se carga ese
//  código en un contexto aislado de Node y se ejercita TAL CUAL: no se copia
//  ni se reescribe la lógica, así que si alguien cambia una fórmula sin querer
//  las pruebas lo pillan.
//
//  OJO: el script declara `let S`, y las variables let/const NO se convierten
//  en propiedades del objeto de contexto. Por eso el estado se lee y se
//  escribe ejecutando código DENTRO del contexto (ejec/ponerEstado), nunca
//  tocando ctx.S desde fuera: eso crearía otra variable y las pruebas pasarían
//  en falso.
//
//  El navegador carga /perfiles.js antes que la app; aquí se hace lo mismo, y
//  con el archivo de verdad: si alguien cambiara los ids de los perfiles, las
//  pruebas se enterarían.
// ============================================================================
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function cargarCliente() {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "public", "index.html"), "utf8");
  const partes = html.split("<script>");
  const codigo = partes[partes.length - 1].split("</script>")[0];
  const perfiles = fs.readFileSync(
    path.join(__dirname, "..", "public", "perfiles.js"), "utf8");

  const nodo = {
    style: {}, classList: { add() {}, remove() {}, contains: () => false },
    appendChild() {}, addEventListener() {}, innerHTML: "", value: "",
    files: [], options: [], focus() {}, click() {}, remove() {},
  };
  const ctx = {
    console,
    // Los diálogos del navegador: se aceptan siempre para poder ejercitar los
    // caminos que piden confirmación (borrar, volver a repartir…).
    confirm: () => true,
    alert: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { pathname: "/", hash: "", href: "", replace() {}, reload() {} },
    navigator: {}, setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Blob: function () {},
    document: {
      getElementById: () => nodo, querySelector: () => nodo, querySelectorAll: () => [],
      createElement: () => nodo, addEventListener() {},
      head: nodo, body: nodo, readyState: "complete",
    },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // Primero los perfiles, como en el navegador: la app los da por presentes.
  vm.runInContext(perfiles, ctx);
  // bootstrap() falla al no haber servidor: es esperado, solo queremos las funciones.
  try { vm.runInContext(codigo, ctx); } catch (e) { /* esperado */ }

  // Se anulan las salidas al exterior. `api` y `render` son declaraciones de
  // función, así que sí son propiedades del contexto y se pueden sustituir.
  // Pintar no interesa aquí: el renderizado se comprueba en el navegador.
  vm.runInContext("api = async function(){ return {}; }; render = function(){};", ctx);

  const ejec = (codigo) => vm.runInContext(codigo, ctx);
  return {
    ctx, ejec,
    ponerEstado: (o) => ejec("S = " + JSON.stringify(o) + ";"),
    leerEstado: () => JSON.parse(ejec("JSON.stringify(S)")),
  };
}

module.exports = { cargarCliente };
