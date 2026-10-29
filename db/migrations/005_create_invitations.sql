-- Migración 005: invitaciones familiares
CREATE TABLE IF NOT EXISTS family_invitations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_email      TEXT NOT NULL,
  invited_role       TEXT NOT NULL CHECK (invited_role IN ('parent','child')),
  token_hash         TEXT UNIQUE NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  accepted_at        TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_family ON family_invitations (family_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email_lower ON family_invitations (LOWER(invited_email));
CREATE INDEX IF NOT EXISTS idx_invitations_open
  ON family_invitations (family_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
