-- Migración 010: idioma de los avisos de cada dispositivo.
--
-- Cada móvil elige su idioma (es una preferencia del dispositivo, como el
-- perfil). El servidor traduce los avisos push al idioma de cada suscripción
-- con el catálogo de public/i18n.js. Las suscripciones que ya existían siguen
-- en español, el idioma de origen de la app.
ALTER TABLE push_suscripciones ADD COLUMN IF NOT EXISTS idioma TEXT NOT NULL DEFAULT 'es';
