-- ============================================================
--  PHYSIOBOOK v1 — INITIAL DATABASE SCHEMA
--  PostgreSQL 14+
--  Run: psql -U <user> -d physiobook -f 001_initial_schema.sql
-- ============================================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
--  ENUMS
-- ────────────────────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('super_admin', 'clinic_admin', 'receptionist', 'therapist', 'patient');
CREATE TYPE appt_status    AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE msg_type       AS ENUM ('text', 'file', 'image');
CREATE TYPE resource_type  AS ENUM ('room', 'equipment', 'other');
CREATE TYPE gender_type    AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- ────────────────────────────────────────────────────────────
--  CLINICS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinics (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255)  NOT NULL,
  address_line1   VARCHAR(255)  NOT NULL,
  address_line2   VARCHAR(255),
  city            VARCHAR(100)  NOT NULL,
  state           VARCHAR(100),
  postal_code     VARCHAR(20),
  country         VARCHAR(100)  NOT NULL DEFAULT 'Sri Lanka',
  phone           VARCHAR(30)   NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  website         VARCHAR(255),
  license_number  VARCHAR(100),
  description     TEXT,
  logo_url        VARCHAR(500),
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          VARCHAR(100)  NOT NULL,
  last_name           VARCHAR(100)  NOT NULL,
  email               VARCHAR(255)  NOT NULL UNIQUE,
  phone               VARCHAR(30),
  password_hash       VARCHAR(255)  NOT NULL,
  role                user_role     NOT NULL DEFAULT 'patient',
  clinic_id           UUID          REFERENCES clinics(id) ON DELETE SET NULL,
  avatar_url          VARCHAR(500),
  date_of_birth       DATE,
  gender              gender_type,
  address             TEXT,
  is_email_verified   BOOLEAN       NOT NULL DEFAULT false,
  two_fa_enabled      BOOLEAN       NOT NULL DEFAULT false,
  two_fa_secret       VARCHAR(255),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_clinic   ON users(clinic_id);
CREATE INDEX idx_users_role     ON users(role);

-- ────────────────────────────────────────────────────────────
--  THERAPIST PROFILES
-- ────────────────────────────────────────────────────────────
CREATE TABLE therapist_profiles (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  clinic_id           UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  specialisations     TEXT[]        NOT NULL DEFAULT '{}',
  qualifications      TEXT[]        NOT NULL DEFAULT '{}',
  bio                 TEXT,
  years_of_experience INT,
  consultation_fee    NUMERIC(10,2),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  THERAPIST WEEKLY SCHEDULE (recurring)
-- ────────────────────────────────────────────────────────────
CREATE TABLE therapist_weekly_schedule (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week   SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (therapist_id, day_of_week)
);

-- ────────────────────────────────────────────────────────────
--  THERAPIST AVAILABILITY (specific dates / blocks)
-- ────────────────────────────────────────────────────────────
CREATE TABLE therapist_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available_date  DATE        NOT NULL,
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  is_blocked      BOOLEAN     NOT NULL DEFAULT false,
  block_reason    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avail_therapist_date ON therapist_availability(therapist_id, available_date);

-- ────────────────────────────────────────────────────────────
--  CLINIC OPERATING HOURS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinic_hours (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME,
  close_time   TIME,
  is_closed    BOOLEAN     NOT NULL DEFAULT false,
  UNIQUE (clinic_id, day_of_week)
);

-- ────────────────────────────────────────────────────────────
--  CLINIC SERVICES (treatment catalogue)
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinic_services (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name              VARCHAR(200)  NOT NULL,
  description       TEXT,
  duration_minutes  INT           NOT NULL DEFAULT 60,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  color_hex         VARCHAR(7)    NOT NULL DEFAULT '#4A90D9',
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  RESOURCES (rooms / equipment)
-- ────────────────────────────────────────────────────────────
CREATE TABLE resources (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name         VARCHAR(200)  NOT NULL,
  type         resource_type NOT NULL DEFAULT 'room',
  description  TEXT,
  capacity     INT           NOT NULL DEFAULT 1,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  APPOINTMENTS (bookings)
-- ────────────────────────────────────────────────────────────
CREATE TABLE appointments (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref          VARCHAR(30)   NOT NULL UNIQUE,
  patient_id           UUID          NOT NULL REFERENCES users(id),
  clinic_id            UUID          NOT NULL REFERENCES clinics(id),
  therapist_id         UUID          NOT NULL REFERENCES users(id),
  service_id           UUID          NOT NULL REFERENCES clinic_services(id),
  resource_id          UUID          REFERENCES resources(id),
  appointment_date     DATE          NOT NULL,
  start_time           TIME          NOT NULL,
  end_time             TIME          NOT NULL,
  notes                TEXT,
  status               appt_status   NOT NULL DEFAULT 'pending',
  cancellation_reason  TEXT,
  updated_by           UUID          REFERENCES users(id),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_appt_patient    ON appointments(patient_id);
CREATE INDEX idx_appt_therapist  ON appointments(therapist_id);
CREATE INDEX idx_appt_clinic     ON appointments(clinic_id);
CREATE INDEX idx_appt_date       ON appointments(appointment_date);
CREATE INDEX idx_appt_status     ON appointments(status);

-- ────────────────────────────────────────────────────────────
--  PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                 UUID           NOT NULL REFERENCES appointments(id),
  patient_id                 UUID           NOT NULL REFERENCES users(id),
  amount                     NUMERIC(10,2)  NOT NULL,
  currency                   VARCHAR(3)     NOT NULL DEFAULT 'LKR',
  status                     payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id   VARCHAR(255)   UNIQUE,
  stripe_refund_id           VARCHAR(255),
  refund_reason              TEXT,
  paid_at                    TIMESTAMPTZ,
  refunded_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_payments_status  ON payments(status);

-- ────────────────────────────────────────────────────────────
--  CONVERSATIONS (chat threads)
-- ────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES users(id),
  therapist_id  UUID        NOT NULL REFERENCES users(id),
  clinic_id     UUID        REFERENCES clinics(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, therapist_id)
);

-- ────────────────────────────────────────────────────────────
--  MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID        NOT NULL REFERENCES users(id),
  body             TEXT,
  message_type     msg_type    NOT NULL DEFAULT 'text',
  file_url         VARCHAR(500),
  is_read          BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_convo ON messages(conversation_id, created_at);

-- ────────────────────────────────────────────────────────────
--  CLINICAL NOTES (SOAP)
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinical_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID        NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  therapist_id    UUID        NOT NULL REFERENCES users(id),
  subjective      TEXT,
  objective       TEXT,
  assessment      TEXT,
  plan            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  AUDIT LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID        REFERENCES users(id),
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(100),
  entity_id    UUID,
  details      JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor      ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────
--  DEFAULT SUPER ADMIN SEED
--  IMPORTANT: Change email and password immediately after deployment
-- ────────────────────────────────────────────────────────────
INSERT INTO users (first_name, last_name, email, password_hash, role, is_email_verified, is_active)
VALUES (
  'Super', 'Admin',
  'admin@physiobook.com',
  -- bcrypt hash of 'Admin@123' — CHANGE IMMEDIATELY
  '$2a$12$n.nEvn5ycTQK7rMqptqqQeumardKSv0g.770wbbgrws/fvMajyC.C',
  'super_admin', true, true
);
