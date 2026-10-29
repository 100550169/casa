-- Migración 009: avisos en el móvil y copias de seguridad automáticas.
--
-- Nada de esto va dentro del estado compartido (casa_state.data):
--   - las suscripciones a avisos son de cada dispositivo, no de la casa; si
--     viajaran en el estado, cada móvil recibiría las de los demás cada 4 s,
--   - las copias son fotos del estado; meterlas dentro de él no tendría sentido.

-- Ajustes internos del servidor que tienen que sobrevivir a un reinicio:
-- las claves de los avisos y la fecha del último recordatorio enviado.
CREATE TABLE IF NOT EXISTS casa_meta (
  clave      TEXT        PRIMARY KEY,
  valor      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un dispositivo que ha aceptado recibir avisos. El endpoint lo da el
-- navegador (Apple, Google, Mozilla) y es único por dispositivo y app.
-- `perfil` es quién usa ese móvil ahora mismo: si cambia de perfil, se
-- actualiza y los avisos pasan a ser los del perfil nuevo.
CREATE TABLE IF NOT EXISTS push_suscripciones (
  endpoint   TEXT        PRIMARY KEY,
  perfil     TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  creada     TIMESTAMPTZ NOT NULL DEFAULT now(),
  usada      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_perfil ON push_suscripciones (perfil);

-- Copias del estado. Se guarda una al día de forma automática y otra justo
-- antes de cualquier operación que lo sobrescribe entero (reiniciar,
-- restaurar), para poder volver atrás con un clic desde el Dashboard.
CREATE TABLE IF NOT EXISTS casa_copias (
  id         BIGSERIAL   PRIMARY KEY,
  dia        DATE        NOT NULL,
  motivo     TEXT        NOT NULL CHECK (motivo IN ('diaria', 'antes_de_reiniciar', 'antes_de_restaurar')),
  data       JSONB       NOT NULL,
  version    BIGINT      NOT NULL,
  creada     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Como mucho una copia diaria por día, aunque dos peticiones lleguen a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_copias_diaria_unica
  ON casa_copias (dia) WHERE motivo = 'diaria';
CREATE INDEX IF NOT EXISTS idx_copias_creada ON casa_copias (creada DESC);
