-- Migración 007: número de versión del estado familiar.
--
-- Hasta ahora cada guardado mandaba el estado ENTERO y el último que escribía
-- ganaba: si dos dispositivos editaban con pocos segundos de diferencia, uno
-- pisaba al otro sin que nadie se enterara. Un hijo marcaba una tarea, su
-- padre cambiaba la paga a la vez, y uno de los dos cambios desaparecía.
--
-- Con este contador el servidor puede detectarlo: si el cliente escribe
-- diciendo que venía de la versión 7 y el estado guardado ya va por la 8, es
-- que alguien escribió en medio. Se rechaza (409), el cliente recarga y vuelve
-- a aplicar su cambio sobre el estado fresco.

ALTER TABLE family_state
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
