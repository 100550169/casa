-- Migración 004: estado familiar (reemplaza app_state monolítica)
CREATE TABLE IF NOT EXISTS family_state (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID UNIQUE NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_state_family ON family_state (family_id);
