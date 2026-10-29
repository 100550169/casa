-- Migración 008: el estado de la casa deja de colgar de una cuenta de usuario.
--
-- POR QUÉ
-- La app pasa a ser privada y familiar: sin registro, sin contraseñas y sin
-- email. Los cuatro perfiles (Mateo, Pablo, Sara y el Dashboard de los Papás)
-- están fijados en el código (public/perfiles.js), así que ya no hace falta
-- que el estado cuelgue de `families`, y `families` a su vez de `users`.
--
-- Esta tabla guarda UNA sola fila: el estado de esta casa. El CHECK (id = 1)
-- lo garantiza a nivel de base de datos, para que no puedan aparecer dos
-- "casas" por un error de programación.
--
-- El contador `version` es el mismo mecanismo que traía family_state: si dos
-- dispositivos guardan a la vez, el segundo recibe un 409 y vuelve a aplicar
-- su cambio sobre el estado fresco en lugar de pisarlo en silencio.
CREATE TABLE IF NOT EXISTS casa_state (
  id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data       JSONB       NOT NULL,
  version    BIGINT      NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Traslado de los datos que ya existan.
--
-- Se copia el estado de la familia modificada más recientemente. NO se tocan
-- las tablas antiguas: quedan ahí, huérfanas pero intactas, por si hiciera
-- falta mirar algo. Borrarlas es una decisión aparte y a mano.
--
-- Los ids de miembro que vengan dentro del JSON siguen siendo los UUID
-- antiguos. No se traducen aquí: lo hace adoptarPerfiles() en
-- services/estadoService.js, que empareja por nombre y tiene el catálogo de
-- perfiles delante. En SQL saldría un cruce ilegible y frágil.
DO $$
BEGIN
  IF to_regclass('public.family_state') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM casa_state) THEN
    INSERT INTO casa_state (id, data, version, updated_at)
    SELECT 1, fs.data, COALESCE(fs.version, 1), fs.updated_at
      FROM family_state fs
     ORDER BY fs.updated_at DESC
     LIMIT 1;
  END IF;
END $$;
