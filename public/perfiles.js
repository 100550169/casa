// ============================================================================
//  PERFILES DE LA CASA — fuente única de verdad.
//
//  ▶ PERSONALIZA AQUÍ TU CASA: cambia `name`, `emoji` y `color` de cada hijo
//    ANTES del primer uso. Mateo, Pablo y Sara son nombres de ejemplo.
//
//  Esta app es privada y familiar: no hay cuentas, ni contraseñas, ni email.
//  En su lugar hay cuatro perfiles fijos que no cambian nunca:
//
//      mateo · pablo · sara    →  experiencia de hijo (móvil)
//      papas                   →  Dashboard de los Papás (escritorio)
//
//  Los ids son CORTOS Y ESTABLES a propósito: se guardan dentro del estado
//  familiar (fixedState, extras, redemptions, listings, marketLog...) y tienen
//  que sobrevivir a cualquier despliegue. Cambiar un id aquí equivale a borrar
//  el historial de esa persona.
//
//  Elegir perfil NO es identificarse. Cualquiera que abra la app puede elegir
//  cualquiera de los cuatro: es intencionado. Lo que sí se conserva son las
//  reglas de producto (un hijo no se aprueba sus propias tareas), que viven en
//  services/stateGuard.js.
//
//  El archivo se carga en los dos lados:
//    - servidor: require("../public/perfiles.js")
//    - navegador: <script src="/perfiles.js"></script>
//  Una sola definición, para que no puedan divergir.
// ============================================================================
(function (raiz, definir) {
  const api = definir();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.keys(api).forEach((k) => { raiz[k] = api[k]; });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Los hijos, en el orden en que aparecen en el selector.
  const HIJOS = [
    { id: "mateo", name: "Mateo", role: "child", color: "#2f9fd0", emoji: "🦊" },
    { id: "pablo", name: "Pablo", role: "child", color: "#2fae73", emoji: "🐢" },
    { id: "sara",  name: "Sara",  role: "child", color: "#e0588f", emoji: "🦋" },
  ];

  // El panel de los padres. Internamente es un miembro más con role "parent":
  // así el reparto, las validaciones y el saneado siguen funcionando sin
  // inventar un caso especial en cada función.
  const PAPAS = {
    id: "papas", name: "Dashboard de los Papás", role: "parent",
    color: "#8b6fd6", emoji: "🏠", shortName: "Papás",
  };

  const PERFILES = HIJOS.concat([PAPAS]);
  const IDS_HIJOS = HIJOS.map((p) => p.id);

  const perfilPorId = (id) => PERFILES.find((p) => p.id === id) || null;
  const esPerfilValido = (id) => !!perfilPorId(id);
  const esHijo = (id) => IDS_HIJOS.indexOf(id) >= 0;
  const PERFIL_POR_DEFECTO = PAPAS.id;

  // Miembros tal y como se guardan dentro del estado familiar. `load` es la
  // disponibilidad de cada hijo y la editan los padres, así que se respeta la
  // que ya hubiera guardada.
  function miembrosIniciales(anteriores) {
    const previos = Array.isArray(anteriores) ? anteriores : [];
    return PERFILES.map((p) => {
      const antes = previos.find((m) => m && m.id === p.id) || {};
      return {
        id: p.id, name: p.name, role: p.role, color: p.color,
        load: ["normal", "reducida", "minima"].indexOf(antes.load) >= 0 ? antes.load : "normal",
      };
    });
  }

  return {
    PERFILES, HIJOS, PAPAS, IDS_HIJOS, PERFIL_POR_DEFECTO,
    perfilPorId, esPerfilValido, esHijo, miembrosIniciales,
  };
});
