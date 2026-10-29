// ============================================================================
//  Copias automáticas (solo papás).
//
//    GET  /api/copias                 las copias guardadas, más recientes primero
//    POST /api/copias/:id/restaurar   vuelve la casa a como estaba en esa copia
//
//  Restaurar también guarda antes una copia del estado actual: deshacer un
//  "restaurar" equivocado es otro clic.
// ============================================================================
const express = require("express");
const { soloPapas } = require("../services/perfilPeticion");
const { listarCopias, leerCopia, guardarCopia } = require("../services/copias");
const { leerEstado, guardarEstado, prepararRestauracion } = require("../services/estadoService");

const router = express.Router();
router.use(soloPapas);

router.get("/", async (req, res) => {
  try {
    res.json({ copias: await listarCopias() });
  } catch (e) {
    console.error("[copias/listar]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

router.post("/:id/restaurar", async (req, res) => {
  try {
    const data = await leerCopia(req.params.id);
    if (!data) return res.status(404).json({ error: "copia_no_encontrada" });
    const actual = await leerEstado();
    await guardarCopia("antes_de_restaurar", actual.estado, actual.version);
    await guardarEstado(prepararRestauracion(data));
    res.json({ ok: true });
  } catch (e) {
    console.error("[copias/restaurar]", e);
    res.status(500).json({ error: "error_servidor" });
  }
});

module.exports = router;
