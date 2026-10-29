-- Migración 003: membresía familiar
CREATE TABLE IF NOT EXISTS family_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_family  TEXT NOT NULL CHECK (role_in_family IN ('parent','child')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members (family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members (user_id);
