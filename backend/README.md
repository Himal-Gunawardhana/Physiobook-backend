# Physiobook v1 — Backend API

> Production-ready Node.js REST + WebSocket API for the Physiobook physiotherapy clinic booking platform.

---

## 🏗️ Project Structure

```
backend/
├── server.js                      # Entry point — HTTP + WebSocket server
├── src/
│   ├── app.js                     # Express app, middleware, route mounting
│   ├── config/
│   │   ├── index.js               # Centralised env-var config
│   │   ├── database.js            # PostgreSQL pool + transaction helper
│   │   ├── redis.js               # Redis (ioredis) client
│   │   ├── stripe.js              # Stripe client (PLACEHOLDER key)
│   │   └── mail.js                # Email transport (SMTP / SES / SendGrid)
│   ├── middleware/
│   │   ├── auth.js                # JWT Bearer + Redis blacklist check
│   │   ├── rbac.js                # Role / clinic scope guards
│   │   ├── rateLimiter.js         # API / Auth / OTP rate limiters
│   │   ├── errorHandler.js        # Global error handler
│   │   └── validate.js            # express-validator result middleware
│   ├── routes/
│   │   ├── index.js               # Master router
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── clinic.routes.js
│   │   ├── staff.routes.js
│   │   ├── booking.routes.js
│   │   ├── payment.routes.js
│   │   ├── communication.routes.js
│   │   └── admin.routes.js
│   ├── controllers/               # HTTP request / response only
│   ├── services/                  # All business logic lives here
│   ├── websocket/
│   │   └── chatHandler.js         # Real-time chat via ws
│   └── utils/
│       ├── jwt.js
│       ├── logger.js
│       └── response.js
├── migrations/
│   ├── 001_initial_schema.sql     # Full PostgreSQL schema
│   └── run.js                     # Migration runner
├── nginx/
│   └── nginx.conf                 # Production Nginx reverse proxy
├── Dockerfile                     # Multi-stage production image
├── docker-compose.yml             # Local dev stack
├── .env.example                   # All env variables documented
└── README.md
```

---

## 🔐 Roles & Permissions

| Role            | Description                        |
|-----------------|------------------------------------|
| `super_admin`   | Full platform access               |
| `clinic_admin`  | Manage own clinic, staff, bookings |
| `receptionist`  | View/manage bookings within clinic |
| `therapist`     | Own schedule, notes, availability  |
| `patient`       | Self-registration, own bookings    |

---

## 📡 API Endpoints Summary

### Auth  `/api/v1/auth`
| Method | Path                    | Description                        |
|--------|-------------------------|------------------------------------|
| POST   | `/register`             | Patient self-registration          |
| GET    | `/verify-email`         | Email verification via token       |
| POST   | `/login`                | Login (returns JWT pair)           |
| POST   | `/2fa/verify`           | Verify TOTP after login            |
| POST   | `/2fa/setup`            | Get QR code for authenticator app  |
| POST   | `/2fa/confirm`          | Enable 2FA after scanning QR       |
| DELETE | `/2fa`                  | Disable 2FA                        |
| POST   | `/refresh`              | Refresh access token               |
| POST   | `/logout`               | Revoke tokens                      |
| POST   | `/forgot-password`      | Send reset email                   |
| POST   | `/reset-password`       | Reset password via token           |

### Users  `/api/v1/users`
| Method | Path              | Description           |
|--------|-------------------|-----------------------|
| GET    | `/me`             | Get own profile       |
| PUT    | `/me`             | Update profile        |
| POST   | `/me/avatar`      | Upload avatar (S3)    |
| PUT    | `/me/password`    | Change password       |
| GET    | `/`               | List users (admin)    |
| GET    | `/:id`            | Get user by ID        |
| PATCH  | `/:id/status`     | Activate/deactivate   |
| DELETE | `/:id`            | Soft delete           |

### Clinics  `/api/v1/clinics`
| Method | Path                             | Description               |
|--------|----------------------------------|---------------------------|
| GET    | `/`                              | List clinics              |
| POST   | `/`                              | Create clinic (super_admin)|
| GET    | `/:clinicId`                     | Get clinic details        |
| PUT    | `/:clinicId`                     | Update clinic             |
| GET    | `/:clinicId/hours`               | Get operating hours       |
| PUT    | `/:clinicId/hours`               | Set operating hours       |
| GET    | `/:clinicId/services`            | Get treatment catalogue   |
| POST   | `/:clinicId/services`            | Add service               |
| PUT    | `/:clinicId/services/:serviceId` | Update service            |

### Staff  `/api/v1/staff`
| Method | Path                                    | Description              |
|--------|-----------------------------------------|--------------------------|
| GET    | `/`                                     | List staff               |
| POST   | `/`                                     | Create staff member      |
| GET    | `/therapists/:therapistId`              | Therapist profile        |
| GET    | `/therapists/:therapistId/availability` | Daily availability       |
| PUT    | `/therapists/:therapistId/schedule`     | Set weekly schedule      |
| POST   | `/therapists/:therapistId/block`        | Block a time slot        |
| GET    | `/resources`                            | List rooms/equipment     |
| POST   | `/resources`                            | Create resource          |

### Bookings  `/api/v1/bookings`
| Method | Path                          | Description              |
|--------|-------------------------------|--------------------------|
| GET    | `/slots`                      | Available time slots     |
| GET    | `/`                           | List bookings (filtered) |
| POST   | `/`                           | Create booking           |
| GET    | `/:bookingId`                 | Get booking details      |
| PATCH  | `/:bookingId/status`          | Update status            |
| PUT    | `/:bookingId/reschedule`      | Reschedule               |
| POST   | `/:bookingId/cancel`          | Cancel with reason       |

### Payments  `/api/v1/payments`
| Method | Path                      | Description              |
|--------|---------------------------|--------------------------|
| POST   | `/intent`                 | Create Stripe PaymentIntent |
| POST   | `/webhook`                | Stripe webhook receiver  |
| GET    | `/`                       | List payments            |
| GET    | `/revenue`                | Revenue summary (admin)  |
| GET    | `/:paymentId`             | Get payment              |
| POST   | `/:paymentId/refund`      | Issue refund             |

### Communications  `/api/v1/communications`
| Method | Path                                       | Description          |
|--------|--------------------------------------------|----------------------|
| POST   | `/conversations`                           | Get/create thread    |
| GET    | `/conversations`                           | List my threads      |
| GET    | `/conversations/:conversationId/messages`  | Get messages         |
| POST   | `/conversations/:conversationId/messages`  | Send message (REST)  |
| PUT    | `/bookings/:bookingId/notes`               | Save SOAP notes      |
| GET    | `/bookings/:bookingId/notes`               | Get SOAP notes       |

### Admin  `/api/v1/admin`  *(super_admin only)*
| Method | Path                           | Description          |
|--------|--------------------------------|----------------------|
| GET    | `/stats`                       | Platform KPIs        |
| GET    | `/clinics`                     | All clinics          |
| PATCH  | `/clinics/:clinicId/status`    | Activate/suspend     |
| GET    | `/audit-logs`                  | Audit trail          |

### WebSocket  `ws://host/ws/chat?token=<JWT>`
| Event (send)  | Payload                              |
|---------------|--------------------------------------|
| `SEND_MESSAGE`| `{ conversationId, body, messageType }` |
| `MARK_READ`   | `{ conversationId }`                 |
| `TYPING`      | `{ conversationId }`                 |

| Event (receive) | Payload                            |
|-----------------|------------------------------------|
| `CONNECTED`     | `{ userId }`                       |
| `NEW_MESSAGE`   | Message object                     |
| `TYPING`        | `{ conversationId, userId }`       |
| `READ_ACK`      | `{ conversationId }`               |

---

## ⚙️ Local Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill values
cp .env.example .env

# 3. Start all services (Postgres, Redis, Mailhog, Nginx)
docker compose up -d postgres redis mailhog

# 4. Run database migrations
npm run migrate

# 5. Start API in dev mode (hot reload)
npm run dev

# API:     http://localhost:4000
# Health:  http://localhost:4000/health
# Mailhog: http://localhost:8025
```

### Full Docker Stack
```bash
docker compose up -d --build
```

---

## ☁️ AWS Deployment Guide

### Architecture

```
Internet → Route 53 → ALB → ECS Fargate Containers
                                ↓
                  RDS PostgreSQL (Multi-AZ)
                  ElastiCache Redis (Cluster Mode)
                  S3 (avatar / file uploads)
                  SES (transactional email)
                  Secrets Manager (env vars)
```

### Step-by-Step

#### 1. RDS PostgreSQL
```bash
# Create in AWS Console: RDS → Create database → PostgreSQL 16
# Set: Multi-AZ, encryption at rest, VPC private subnets
# After creation, run migrations:
DB_HOST=<rds-endpoint> npm run migrate
```

#### 2. ElastiCache Redis
```bash
# AWS Console: ElastiCache → Create cluster → Redis OSS 7
# Enable: TLS, Auth token, private subnet group
# Set REDIS_HOST, REDIS_PASSWORD, REDIS_TLS=true in env
```

#### 3. AWS Secrets Manager (recommended for env vars)
```bash
aws secretsmanager create-secret \
  --name physiobook/production \
  --secret-string file://.env
```

#### 4. ECR (Container Registry)
```bash
aws ecr create-repository --repository-name physiobook-backend

docker build -t physiobook-backend .
docker tag physiobook-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/physiobook-backend:latest

aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/physiobook-backend:latest
```

#### 5. ECS Fargate
```bash
# Create: ECS → Clusters → Create cluster (Fargate)
# Task Definition:
#   Image: ECR URI above
#   Port mappings: 4000
#   Environment: inject from Secrets Manager
#   Health check: /health
# Service: 
#   Desired count: 2 (for HA)
#   Load balancer: Application Load Balancer
#   Target group: port 4000
```

#### 6. SSL / HTTPS
```bash
# Request cert in ACM (Certificate Manager) for your domain
# Attach to ALB HTTPS listener (port 443)
# ALB → redirect HTTP 80 → HTTPS 443
```

#### 7. Stripe Webhook
```bash
# In Stripe Dashboard → Webhooks → Add endpoint
# URL: https://api.physiobook.com/api/v1/payments/webhook
# Events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
# Copy signing secret → set STRIPE_WEBHOOK_SECRET in env
```

#### 8. S3 Avatar Uploads
```bash
# To enable real S3 uploads, install multer-s3:
npm install @aws-sdk/client-s3 multer-s3

# Then replace the multer instance in user.routes.js with multer-s3:
# const multerS3 = require('multer-s3');
# const { S3Client } = require('@aws-sdk/client-s3');
# const s3 = new S3Client({ region: config.aws.s3Region, credentials: { ... } });
# const upload = multer({ storage: multerS3({ s3, bucket: config.aws.s3Bucket, ... }) });
```

---

## 🔑 External Services Checklist

| Service      | Env Variable(s)                              | Where to get              |
|--------------|----------------------------------------------|---------------------------|
| PostgreSQL   | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`| AWS RDS / self-hosted     |
| Redis        | `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_TLS`  | AWS ElastiCache / Upstash |
| Stripe       | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com      |
| Email (SMTP) | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`        | AWS SES / SendGrid        |
| SMS (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`    | console.twilio.com        |
| S3           | `AWS_S3_BUCKET`, `AWS_S3_ACCESS_KEY_ID`      | AWS Console               |
| JWT Secrets  | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`    | Generate with `openssl rand -hex 64` |

---

## 🔒 Security Checklist

- [x] JWT access tokens (15 min TTL) + httpOnly refresh cookie (7 days)
- [x] Token blacklisting on logout via Redis
- [x] Password hashing with bcrypt (12 rounds)
- [x] 2FA with TOTP (Google Authenticator compatible)
- [x] Rate limiting on all auth endpoints
- [x] Helmet security headers
- [x] CORS allowlist
- [x] express-validator on all input
- [x] Non-root Docker user
- [x] Stripe webhook signature verification
- [x] RBAC + clinic scope guards on every protected route
- [ ] Enable `DB_SSL=true` in production
- [ ] Set `REDIS_TLS=true` in production
- [ ] Rotate all secrets immediately after first deploy

---

## 🚀 Default Super Admin

After migration, a default super_admin is seeded:

| Field    | Value                  |
|----------|------------------------|
| Email    | `admin@physiobook.com` |
| Password | `Admin@123`            |

> ⚠️ **Change this password immediately after first login.**
