-- Migración 001: usuarios y perfiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name         TEXT NOT NULL,
  role                 TEXT CHECK (role IN ('parent','child')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  avatar_color         TEXT NOT NULL DEFAULT '#ff7a59',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
