-- ============================================================
--  PHYSIOBOOK v2 — COMPLETE PRODUCTION SCHEMA
--  PostgreSQL 14+
--  Run: psql $DATABASE_URL -f 002_physiobook_schema.sql
-- ============================================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ────────────────────────────────────────────────────────────
--  DROP EXISTING TABLES (clean rebuild)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS clinic_subscriptions   CASCADE;
DROP TABLE IF EXISTS support_tickets        CASCADE;
DROP TABLE IF EXISTS clinical_notes         CASCADE;
DROP TABLE IF EXISTS notifications          CASCADE;
DROP TABLE IF EXISTS messages               CASCADE;
DROP TABLE IF EXISTS feedback               CASCADE;
DROP TABLE IF EXISTS payments               CASCADE;
DROP TABLE IF EXISTS bookings               CASCADE;
DROP TABLE IF EXISTS packages               CASCADE;
DROP TABLE IF EXISTS services               CASCADE;
DROP TABLE IF EXISTS equipment              CASCADE;
DROP TABLE IF EXISTS staff_availability     CASCADE;
DROP TABLE IF EXISTS clinic_staff           CASCADE;
DROP TABLE IF EXISTS refresh_tokens         CASCADE;
DROP TABLE IF EXISTS clinics                CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;
-- Legacy tables from v1
DROP TABLE IF EXISTS audit_logs             CASCADE;
DROP TABLE IF EXISTS clinical_notes         CASCADE;
DROP TABLE IF EXISTS conversations          CASCADE;
DROP TABLE IF EXISTS appointments           CASCADE;
DROP TABLE IF EXISTS payments               CASCADE;
DROP TABLE IF EXISTS clinic_services        CASCADE;
DROP TABLE IF EXISTS resources              CASCADE;
DROP TABLE IF EXISTS clinic_hours           CASCADE;
DROP TABLE IF EXISTS therapist_availability CASCADE;
DROP TABLE IF EXISTS therapist_weekly_schedule CASCADE;
DROP TABLE IF EXISTS therapist_profiles     CASCADE;

-- ────────────────────────────────────────────────────────────
--  DROP ENUMS (clean rebuild)
-- ────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS user_role          CASCADE;
DROP TYPE IF EXISTS clinic_plan        CASCADE;
DROP TYPE IF EXISTS staff_status       CASCADE;
DROP TYPE IF EXISTS visit_mode         CASCADE;
DROP TYPE IF EXISTS booking_status     CASCADE;
DROP TYPE IF EXISTS payment_status     CASCADE;
DROP TYPE IF EXISTS payment_method     CASCADE;
DROP TYPE IF EXISTS ticket_priority    CASCADE;
DROP TYPE IF EXISTS ticket_status      CASCADE;
DROP TYPE IF EXISTS billing_cycle      CASCADE;
-- Legacy
DROP TYPE IF EXISTS appt_status        CASCADE;
DROP TYPE IF EXISTS msg_type           CASCADE;
DROP TYPE IF EXISTS resource_type      CASCADE;
DROP TYPE IF EXISTS gender_type        CASCADE;

-- ────────────────────────────────────────────────────────────
--  ENUMS
-- ────────────────────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('patient', 'clinic_admin', 'therapist', 'super_admin');
CREATE TYPE clinic_plan    AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE staff_status   AS ENUM ('available', 'in_session', 'on_leave');
CREATE TYPE visit_mode     AS ENUM ('clinic', 'home', 'online');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refund_requested');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'partial');
CREATE TYPE payment_method AS ENUM ('card', 'cash', 'bank_transfer');
CREATE TYPE pay_txn_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ticket_status  AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE billing_cycle  AS ENUM ('monthly', 'annual');

-- ────────────────────────────────────────────────────────────
--  USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          VARCHAR(100)  NOT NULL,
  last_name           VARCHAR(100)  NOT NULL,
  email               CITEXT        NOT NULL UNIQUE,
  password_hash       VARCHAR(255)  NOT NULL,
  role                user_role     NOT NULL DEFAULT 'patient',
  phone               VARCHAR(30),
  avatar_url          VARCHAR(500),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  is_email_verified   BOOLEAN       NOT NULL DEFAULT false,
  two_fa_enabled      BOOLEAN       NOT NULL DEFAULT false,
  two_fa_secret       VARCHAR(255),
  notification_prefs  JSONB         NOT NULL DEFAULT '{"email":true,"sms":true,"push":true}',
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);

-- ────────────────────────────────────────────────────────────
--  REFRESH TOKENS
-- ────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_user    ON refresh_tokens(user_id);
CREATE INDEX idx_rt_hash    ON refresh_tokens(token_hash);

-- ────────────────────────────────────────────────────────────
--  CLINICS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinics (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255)  NOT NULL,
  slug                VARCHAR(100)  NOT NULL UNIQUE,
  address             TEXT          NOT NULL,
  city                VARCHAR(100)  NOT NULL,
  phone               VARCHAR(30)   NOT NULL,
  email               CITEXT        NOT NULL UNIQUE,
  logo_url            VARCHAR(500),
  operating_hours     JSONB         NOT NULL DEFAULT '{}',
  portal_config       JSONB         NOT NULL DEFAULT '{"primaryColor":"#2563eb","tagline":"","showFeedback":true}',
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  subscription_plan   clinic_plan   NOT NULL DEFAULT 'free',
  owner_id            UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_slug    ON clinics(slug);
CREATE INDEX idx_clinics_owner   ON clinics(owner_id);
CREATE INDEX idx_clinics_city    ON clinics(city);

-- ────────────────────────────────────────────────────────────
--  CLINIC STAFF  (join table: user <-> clinic)
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinic_staff (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_clinic      VARCHAR(100)  NOT NULL DEFAULT 'therapist',
  specialization      VARCHAR(255),
  experience_years    INT           NOT NULL DEFAULT 0,
  rating              DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
  auto_rank           VARCHAR(50),
  status              staff_status  NOT NULL DEFAULT 'available',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, user_id)
);

CREATE INDEX idx_cs_clinic  ON clinic_staff(clinic_id);
CREATE INDEX idx_cs_user    ON clinic_staff(user_id);

-- ────────────────────────────────────────────────────────────
--  STAFF AVAILABILITY  (recurring weekly schedule)
-- ────────────────────────────────────────────────────────────
CREATE TABLE staff_availability (
  id           UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID       NOT NULL REFERENCES clinic_staff(id) ON DELETE CASCADE,
  day_of_week  SMALLINT   NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME       NOT NULL,
  end_time     TIME       NOT NULL,
  is_active    BOOLEAN    NOT NULL DEFAULT true,
  UNIQUE (staff_id, day_of_week)
);

CREATE INDEX idx_sa_staff ON staff_availability(staff_id);

-- ────────────────────────────────────────────────────────────
--  EQUIPMENT
-- ────────────────────────────────────────────────────────────
CREATE TABLE equipment (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name         VARCHAR(200)  NOT NULL,
  quantity     INT           NOT NULL DEFAULT 1,
  is_portable  BOOLEAN       NOT NULL DEFAULT false,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equip_clinic ON equipment(clinic_id);

-- ────────────────────────────────────────────────────────────
--  SERVICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE services (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                VARCHAR(200)  NOT NULL,
  description         TEXT,
  duration_minutes    INT           NOT NULL DEFAULT 60,
  price               DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency            VARCHAR(3)    NOT NULL DEFAULT 'LKR',
  requires_equipment  VARCHAR(200),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_svc_clinic ON services(clinic_id);

-- ────────────────────────────────────────────────────────────
--  PACKAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name             VARCHAR(200)  NOT NULL,
  description      TEXT,
  session_count    INT           NOT NULL DEFAULT 1,
  price            DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0,
  is_fast_track    BOOLEAN       NOT NULL DEFAULT false,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pkg_clinic ON packages(clinic_id);

-- ────────────────────────────────────────────────────────────
--  BOOKINGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  reference                   VARCHAR(20)     NOT NULL UNIQUE,
  clinic_id                   UUID            NOT NULL REFERENCES clinics(id),
  patient_id                  UUID            NOT NULL REFERENCES users(id),
  therapist_id                UUID            REFERENCES clinic_staff(id),
  service_id                  UUID            NOT NULL REFERENCES services(id),
  package_id                  UUID            REFERENCES packages(id),
  visit_mode                  visit_mode      NOT NULL DEFAULT 'clinic',
  booked_date                 DATE            NOT NULL,
  booked_time                 TIME            NOT NULL,
  duration_minutes            INT             NOT NULL DEFAULT 60,
  status                      booking_status  NOT NULL DEFAULT 'pending',
  assigned_equipment          VARCHAR(200),
  notes                       TEXT,
  patient_confirmed_equipment BOOLEAN         NOT NULL DEFAULT false,
  payment_status              payment_status  NOT NULL DEFAULT 'unpaid',
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bk_clinic      ON bookings(clinic_id);
CREATE INDEX idx_bk_patient     ON bookings(patient_id);
CREATE INDEX idx_bk_therapist   ON bookings(therapist_id);
CREATE INDEX idx_bk_date        ON bookings(booked_date);
CREATE INDEX idx_bk_status      ON bookings(status);
CREATE INDEX idx_bk_reference   ON bookings(reference);

-- Sequence for PB-YYYY-NNNN reference generation
CREATE SEQUENCE IF NOT EXISTS booking_seq START 1;

-- ────────────────────────────────────────────────────────────
--  PAYMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                UUID          NOT NULL REFERENCES bookings(id),
  clinic_id                 UUID          NOT NULL REFERENCES clinics(id),
  patient_id                UUID          NOT NULL REFERENCES users(id),
  amount                    DECIMAL(10,2) NOT NULL,
  currency                  VARCHAR(3)    NOT NULL DEFAULT 'LKR',
  method                    payment_method NOT NULL DEFAULT 'cash',
  status                    pay_txn_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id  VARCHAR(255),
  stripe_charge_id          VARCHAR(255),
  paid_at                   TIMESTAMPTZ,
  refunded_at               TIMESTAMPTZ,
  refund_reason             TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_booking  ON payments(booking_id);
CREATE INDEX idx_pay_clinic   ON payments(clinic_id);
CREATE INDEX idx_pay_patient  ON payments(patient_id);
CREATE INDEX idx_pay_status   ON payments(status);

-- ────────────────────────────────────────────────────────────
--  FEEDBACK
-- ────────────────────────────────────────────────────────────
CREATE TABLE feedback (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        NOT NULL UNIQUE REFERENCES bookings(id),
  patient_id   UUID        NOT NULL REFERENCES users(id),
  therapist_id UUID        REFERENCES clinic_staff(id),
  clinic_id    UUID        NOT NULL REFERENCES clinics(id),
  rating       SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  is_public    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fb_clinic     ON feedback(clinic_id);
CREATE INDEX idx_fb_therapist  ON feedback(therapist_id);
CREATE INDEX idx_fb_patient    ON feedback(patient_id);

-- ────────────────────────────────────────────────────────────
--  MESSAGES  (booking-scoped chat)
-- ────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES users(id),
  content     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_booking ON messages(booking_id, created_at);
CREATE INDEX idx_msg_sender  ON messages(sender_id);

-- ────────────────────────────────────────────────────────────
--  CLINICAL NOTES
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinical_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID        NOT NULL REFERENCES bookings(id),
  therapist_id    UUID        NOT NULL REFERENCES clinic_staff(id),
  patient_id      UUID        NOT NULL REFERENCES users(id),
  note_text       TEXT        NOT NULL,
  attachment_url  VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cn_patient    ON clinical_notes(patient_id);
CREATE INDEX idx_cn_therapist  ON clinical_notes(therapist_id);
CREATE INDEX idx_cn_booking    ON clinical_notes(booking_id);

-- ────────────────────────────────────────────────────────────
--  NOTIFICATIONS  (in-app)
-- ────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  message     TEXT        NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'general',
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user    ON notifications(user_id, is_read);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- ────────────────────────────────────────────────────────────
--  SUPPORT TICKETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE support_tickets (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID            REFERENCES clinics(id),
  submitted_by    UUID            NOT NULL REFERENCES users(id),
  subject         VARCHAR(255)    NOT NULL,
  description     TEXT            NOT NULL,
  priority        ticket_priority NOT NULL DEFAULT 'medium',
  status          ticket_status   NOT NULL DEFAULT 'open',
  response        TEXT,
  resolved_by     UUID            REFERENCES users(id),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tk_status   ON support_tickets(status);
CREATE INDEX idx_tk_priority ON support_tickets(priority);
CREATE INDEX idx_tk_clinic   ON support_tickets(clinic_id);

-- ────────────────────────────────────────────────────────────
--  CLINIC SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE clinic_subscriptions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan          clinic_plan   NOT NULL DEFAULT 'free',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  starts_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_clinic ON clinic_subscriptions(clinic_id);
CREATE INDEX idx_sub_active ON clinic_subscriptions(is_active, expires_at);
