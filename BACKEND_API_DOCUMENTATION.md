# 🏥 Physiobook Backend API Documentation

**Version:** 1.0.0  
**API Base URL:** `https://physiobook-api.onrender.com/api/v1` (Production) | `http://localhost:4000/api/v1` (Development)  
**Status:** Production Ready  
**Last Updated:** April 2026

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [API Overview](#api-overview)
4. [Error Handling](#error-handling)
5. [CORS Configuration](#cors-configuration)
6. [Rate Limiting](#rate-limiting)
7. [API Endpoints](#api-endpoints)
   - [Authentication](#-auth-endpoints)
   - [Users](#-user-endpoints)
   - [Clinics](#-clinic-endpoints)
   - [Staff](#-staff-endpoints)
   - [Bookings](#-booking-endpoints)
   - [Payments](#-payment-endpoints)
   - [Communications](#-communication-endpoints)
   - [Admin](#-admin-endpoints)
8. [WebSocket (Real-time Chat)](#websocket-real-time-chat)
9. [Database Schema Overview](#database-schema-overview)
10. [Common Integration Flows](#common-integration-flows)
11. [Environment Configuration](#environment-configuration)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js:** ≥ 18.0.0
- **Frontend Framework:** React, Vue, Angular, or any framework with HTTP client
- **HTTP Client:** fetch API, axios, or equivalent

### Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Himal-Gunawardhana/Physiobook-backend.git

# 2. Install dependencies (in backend directory)
cd backend
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database, Redis, Stripe, and email credentials

# 4. Run database migrations
node migrations/run.js

# 5. Start the server (development)
npm run dev

# Server will be available at http://localhost:4000
```

### Quick Test

```bash
# Test the health endpoint (no auth required)
curl http://localhost:4000/health
# Response: { "status": "ok", "service": "physiobook-api", "version": "1.0.0" }
```

---

## Authentication

### Overview

Physiobook uses **JWT (JSON Web Token)** authentication with:
- **Access Token:** Short-lived token for API requests (15 minutes default)
- **Refresh Token:** Long-lived token to obtain new access tokens (7 days default)
- **2FA/TOTP:** Optional two-factor authentication for enhanced security
- **Roles:** 5 role levels for permission management

### Authentication Flow

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │ POST /auth/login
       ├─→ { email, password }
       │
┌──────▼───────────────┐
│   Backend            │
│ 1. Verify credentials│
│ 2. Check 2FA status  │
└──────┬───────────────┘
       │
       ├─ If 2FA enabled:
       │  ├─→ { partialToken } (temp token)
       │  ├─ User enters TOTP code
       │  └─→ POST /auth/2fa/verify with code
       │
       └─ If 2FA disabled:
          └─→ { accessToken, refreshToken, user }
```

### Token Management

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "patient",
      "isActive": true,
      "requiresTwoFa": false
    }
  }
}
```

#### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### 2FA Setup & Verification

```http
POST /api/v1/auth/2fa/setup
Authorization: Bearer <accessToken>
```

**Response:** Returns TOTP secret and QR code URL for authenticator app.

```http
POST /api/v1/auth/2fa/confirm
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "code": "123456"
}
```

### Headers for Authenticated Requests

All protected endpoints require these headers:

```http
Authorization: Bearer <accessToken>
X-Refresh-Token: <refreshToken>  (optional, for token rotation)
```

### Role-Based Access Control (RBAC)

| Role | Level | Permissions |
|------|-------|-------------|
| **super_admin** | 0 | All operations, manage platforms, all clinics |
| **clinic_admin** | 1 | Manage own clinic, staff, bookings, payments |
| **therapist** | 2 | View own bookings, set schedule, write clinical notes |
| **receptionist** | 3 | View clinic bookings, manage clinic operations, create bookings |
| **patient** | 4 | Browse clinics, make bookings, pay, chat with therapist |

---

## API Overview

### Base Information

- **API Version:** v1
- **Protocol:** HTTP/HTTPS
- **Data Format:** JSON
- **Charset:** UTF-8
- **Port:** 4000 (development) | Standard HTTP ports (production)

### Response Format

All responses follow a standardized format:

**Success (2xx):**
```json
{
  "success": true,
  "data": {
    // Response payload
  }
}
```

**Error (4xx, 5xx):**
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "User-friendly error description",
  "details": {}  // Optional: additional error info
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Missing or invalid parameters |
| 401 | Unauthorized | Invalid or expired token |
| 402 | Payment Required | Stripe payment failed |
| 403 | Forbidden | Not authorized for this action |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource (email exists) |
| 413 | Payload Too Large | File upload exceeds 5MB |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server error |

### Standard Error Codes

| Error Code | HTTP | Meaning | Solution |
|-----------|------|---------|----------|
| `VALIDATION_ERROR` | 422 | Request validation failed | Check input format |
| `AUTH_ERROR` | 401 | Invalid/expired token | Re-login to get new token |
| `DUPLICATE_RESOURCE` | 409 | Email/resource already exists | Use different value |
| `INVALID_REFERENCE` | 400 | Referenced resource missing | Ensure ID exists |
| `NOT_FOUND` | 404 | Endpoint/resource not found | Check URL spelling |
| `PAYMENT_ERROR` | 402 | Stripe operation failed | Check payment details |
| `CORS_ERROR` | 403 | Origin not allowed | Check CORS_ORIGINS env var |
| `FILE_TOO_LARGE` | 413 | Upload > 5MB | Reduce file size |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Contact support |

### Example Error Response

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "email",
      "message": "Valid email required"
    },
    {
      "field": "password",
      "message": "Password must contain uppercase, lowercase, and a number"
    }
  ]
}
```

---

## CORS Configuration

### Allowed Origins

The backend accepts requests from configured origins. Default origins (development):

- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (React dev server)
- `http://localhost:5174` (Alternative Vite port)
- `http://127.0.0.1:5173` (Localhost variant)

### Production Configuration

In production, set `CORS_ORIGINS` environment variable:

```bash
CORS_ORIGINS=https://app.physiobook.com,https://www.physiobook.com,https://admin.physiobook.com
```

### Allowed Methods

```
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### Allowed Headers

```
Content-Type, Authorization, X-Refresh-Token
```

### Important Notes

- **Mobile/Native Apps:** Apps with no origin are automatically allowed (safe due to authentication)
- **Preflight Caching:** 24 hours (86400 seconds)
- **Credentials:** Cookies and Authorization headers supported

---

## Rate Limiting

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| Auth endpoints | 10 requests | 15 minutes |
| OTP/2FA | 5 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

### Example Rate Limit Response

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please retry after 15 minutes"
}
```

---

## 🔐 AUTH Endpoints

### 1. Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "SecurePassword123"
}
```

**Validations:**
- Email must be unique
- Password minimum 8 chars, must include uppercase, lowercase, number
- Phone must be valid (optional)

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "patient",
    "message": "Registration successful. Please verify your email."
  }
}
```

### 2. Verify Email

```http
GET /api/v1/auth/verify-email?token=eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 3. Login

See [Token Management](#token-management) section above.

### 4. 2FA Setup

```http
POST /api/v1/auth/2fa/setup
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQQQ====",
    "qrCodeUrl": "otpauth://totp/Physiobook:user@example.com?...",
    "message": "Scan QR code with authenticator app (Google Authenticator, Authy, etc.)"
  }
}
```

### 5. Verify 2FA Code (Login)

```http
POST /api/v1/auth/2fa/verify
Content-Type: application/json

{
  "partialToken": "eyJhbGciOiJIUzI1NiIs...",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": { /* user object */ }
  }
}
```

### 6. Confirm 2FA Setup

```http
POST /api/v1/auth/2fa/confirm
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled"
}
```

### 7. Disable 2FA

```http
DELETE /api/v1/auth/2fa
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Two-factor authentication disabled"
}
```

### 8. Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 9. Forgot Password

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent. Check your inbox."
}
```

### 10. Reset Password

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "newPassword": "NewSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### 11. Refresh Token

See [Token Management](#token-management) section above.

---

## 👤 USER Endpoints

All user endpoints require authentication.

### 1. Get Current User Profile

```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "avatar": "https://s3.amazonaws.com/physiobook/avatars/...",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "role": "patient",
    "isActive": true,
    "createdAt": "2026-04-01T10:30:00Z",
    "updatedAt": "2026-04-27T15:45:00Z"
  }
}
```

### 2. Update Profile

```http
PUT /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "male"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* updated user */ }
}
```

### 3. Upload Avatar

```http
POST /api/v1/users/me/avatar
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

[File: avatar.jpg (max 5MB)]
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "avatar": "https://s3.amazonaws.com/physiobook/avatars/550e8400-e29b-41d4-a716-446655440000-avatar.jpg"
  }
}
```

### 4. Change Password

```http
PUT /api/v1/users/me/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### 5. List Users (Admin/Clinic Admin/Receptionist)

```http
GET /api/v1/users?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [ /* array of users */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

### 6. Get User by ID

```http
GET /api/v1/users/:id
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* user object */ }
}
```

### 7. Set User Active/Inactive (Admin)

```http
PATCH /api/v1/users/:id/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User status updated"
}
```

### 8. Delete User (Admin, Soft Delete)

```http
DELETE /api/v1/users/:id
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🏢 CLINIC Endpoints

### 1. List Clinics

```http
GET /api/v1/clinics
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "clinics": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Central Physio Clinic",
        "addressLine1": "123 Main Street",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "USA",
        "phone": "+12125551234",
        "email": "info@centralphysio.com",
        "isActive": true,
        "createdAt": "2026-01-15T08:00:00Z"
      }
    ]
  }
}
```

### 2. Create Clinic (Super Admin)

```http
POST /api/v1/clinics
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "New Physio Clinic",
  "addressLine1": "456 Oak Avenue",
  "addressLine2": "Suite 200",
  "city": "Boston",
  "state": "MA",
  "postalCode": "02101",
  "country": "USA",
  "phone": "+16175551234",
  "email": "contact@newphysio.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "New Physio Clinic",
    /* ... clinic details ... */
  }
}
```

### 3. Get Clinic Details

```http
GET /api/v1/clinics/:clinicId
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* clinic object */ }
}
```

### 4. Update Clinic

```http
PUT /api/v1/clinics/:clinicId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Updated Clinic Name",
  "phone": "+16175559999",
  "email": "newemail@clinic.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* updated clinic */ }
}
```

### 5. Get Operating Hours

```http
GET /api/v1/clinics/:clinicId/hours
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hours": [
      {
        "dayOfWeek": 0,
        "dayName": "Sunday",
        "isOpen": false,
        "openTime": null,
        "closeTime": null
      },
      {
        "dayOfWeek": 1,
        "dayName": "Monday",
        "isOpen": true,
        "openTime": "09:00",
        "closeTime": "18:00"
      },
      /* ... other days ... */
    ]
  }
}
```

### 6. Set Operating Hours

```http
PUT /api/v1/clinics/:clinicId/hours
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "hours": [
    { "dayOfWeek": 1, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 2, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 3, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 4, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 5, "isOpen": true, "openTime": "09:00", "closeTime": "18:00" },
    { "dayOfWeek": 6, "isOpen": false, "openTime": null, "closeTime": null },
    { "dayOfWeek": 0, "isOpen": false, "openTime": null, "closeTime": null }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* updated hours */ }
}
```

### 7. Get Services (Treatment Catalogue)

```http
GET /api/v1/clinics/:clinicId/services
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "clinicId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Physical Therapy - Initial Consultation",
        "description": "Comprehensive initial assessment",
        "durationMinutes": 60,
        "price": 150.00,
        "currency": "LKR",
        "isActive": true
      }
    ]
  }
}
```

### 8. Add Service

```http
POST /api/v1/clinics/:clinicId/services
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Physical Therapy Session",
  "description": "Standard 45-minute therapy session",
  "durationMinutes": 45,
  "price": 100.00,
  "currency": "LKR"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    /* ... service details ... */
  }
}
```

### 9. Update Service

```http
PUT /api/v1/clinics/:clinicId/services/:serviceId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "price": 120.00,
  "durationMinutes": 50
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* updated service */ }
}
```

---

## 👨‍⚕️ STAFF Endpoints

### 1. List Staff

```http
GET /api/v1/staff
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "firstName": "Sarah",
        "lastName": "Smith",
        "email": "sarah@clinic.com",
        "role": "therapist",
        "clinicId": "550e8400-e29b-41d4-a716-446655440000",
        "specialization": "Sports Injury",
        "isActive": true
      }
    ]
  }
}
```

### 2. Create Staff Member

```http
POST /api/v1/staff
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "firstName": "Mike",
  "lastName": "Johnson",
  "email": "mike@clinic.com",
  "phone": "+12025551234",
  "role": "therapist",
  "specialization": "Back Pain Treatment"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    /* ... staff details ... */
  }
}
```

### 3. Get Therapist Profile

```http
GET /api/v1/staff/therapists/:therapistId
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "firstName": "Sarah",
    "lastName": "Smith",
    "email": "sarah@clinic.com",
    "specialization": "Sports Injury",
    "bio": "Experienced physical therapist...",
    "clinicId": "550e8400-e29b-41d4-a716-446655440000",
    "rating": 4.8,
    "reviewCount": 45,
    "hourlyRate": 100.00
  }
}
```

### 4. Get Therapist Availability

```http
GET /api/v1/staff/therapists/:therapistId/availability?date=2026-05-15
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "date": "2026-05-15",
    "therapistId": "550e8400-e29b-41d4-a716-446655440004",
    "availableSlots": [
      { "startTime": "09:00", "endTime": "09:45" },
      { "startTime": "10:00", "endTime": "10:45" },
      { "startTime": "11:00", "endTime": "11:45" },
      /* ... more slots ... */
    ]
  }
}
```

### 5. Set Weekly Schedule

```http
PUT /api/v1/staff/therapists/:therapistId/schedule
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "schedule": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "17:00",
      "slotDuration": 45
    },
    {
      "dayOfWeek": 2,
      "startTime": "09:00",
      "endTime": "17:00",
      "slotDuration": 45
    },
    /* ... other days ... */
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Schedule updated successfully"
}
```

### 6. Block Time Slot

```http
POST /api/v1/staff/therapists/:therapistId/block
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "date": "2026-05-15",
  "startTime": "12:00",
  "endTime": "13:00",
  "reason": "Lunch break"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Time slot blocked successfully"
}
```

### 7. List Resources (Rooms/Equipment)

```http
GET /api/v1/staff/resources
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "resources": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440006",
        "name": "Treatment Room A",
        "type": "room",
        "clinicId": "550e8400-e29b-41d4-a716-446655440000",
        "description": "Equipped with massage table and equipment"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440007",
        "name": "Ultrasound Machine",
        "type": "equipment",
        "clinicId": "550e8400-e29b-41d4-a716-446655440000"
      }
    ]
  }
}
```

### 8. Create Resource

```http
POST /api/v1/staff/resources
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "New Treatment Room",
  "type": "room",
  "description": "Newly renovated room with modern equipment"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440008",
    /* ... resource details ... */
  }
}
```

---

## 📅 BOOKING Endpoints

### 1. Get Available Slots

```http
GET /api/v1/bookings/slots?therapistId=550e8400-e29b-41d4-a716-446655440004&date=2026-05-15&serviceDuration=45
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "availableSlots": [
      { "startTime": "09:00", "endTime": "09:45" },
      { "startTime": "10:00", "endTime": "10:45" },
      { "startTime": "11:00", "endTime": "11:45" }
    ]
  }
}
```

### 2. Create Booking

```http
POST /api/v1/bookings
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "clinicId": "550e8400-e29b-41d4-a716-446655440000",
  "therapistId": "550e8400-e29b-41d4-a716-446655440004",
  "serviceId": "550e8400-e29b-41d4-a716-446655440003",
  "appointmentDate": "2026-05-15",
  "startTime": "10:00",
  "endTime": "10:45",
  "notes": "First time patient, knee pain"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440009",
    "patientId": "550e8400-e29b-41d4-a716-446655440000",
    "therapistId": "550e8400-e29b-41d4-a716-446655440004",
    "clinicId": "550e8400-e29b-41d4-a716-446655440000",
    "appointmentDate": "2026-05-15",
    "startTime": "10:00",
    "endTime": "10:45",
    "status": "confirmed",
    "totalAmount": 100.00,
    "currency": "LKR"
  }
}
```

### 3. List Bookings

```http
GET /api/v1/bookings?status=confirmed&limit=10
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bookings": [ /* array of bookings */ ]
  }
}
```

### 4. Get Booking Details

```http
GET /api/v1/bookings/:bookingId
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440009",
    /* ... booking details ... */
  }
}
```

### 5. Update Booking Status

```http
PATCH /api/v1/bookings/:bookingId/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "completed"
}
```

**Status Options:** `confirmed`, `cancelled`, `completed`, `no_show`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking status updated"
}
```

### 6. Reschedule Booking

```http
PUT /api/v1/bookings/:bookingId/reschedule
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "appointmentDate": "2026-05-16",
  "startTime": "14:00",
  "endTime": "14:45"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking rescheduled successfully"
}
```

### 7. Cancel Booking

```http
POST /api/v1/bookings/:bookingId/cancel
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "reason": "Doctor advised rest"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

---

## 💳 PAYMENT Endpoints

### 1. Create Payment Intent

```http
POST /api/v1/payments/intent
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "bookingId": "550e8400-e29b-41d4-a716-446655440009",
  "amount": 100.00,
  "currency": "LKR"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_1234567890_secret_abcdefgh",
    "amount": 100.00,
    "currency": "LKR",
    "bookingId": "550e8400-e29b-41d4-a716-446655440009"
  }
}
```

### 2. List Payments

```http
GET /api/v1/payments
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "bookingId": "550e8400-e29b-41d4-a716-446655440009",
        "amount": 100.00,
        "currency": "LKR",
        "status": "succeeded",
        "stripePaymentId": "pi_1234567890",
        "createdAt": "2026-05-15T10:30:00Z"
      }
    ]
  }
}
```

### 3. Get Payment Details

```http
GET /api/v1/payments/:paymentId
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* payment object */ }
}
```

### 4. Get Revenue Summary (Admin)

```http
GET /api/v1/payments/revenue?dateFrom=2026-04-01&dateTo=2026-04-30
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 15000.00,
    "totalPayments": 45,
    "currency": "LKR",
    "dateRange": {
      "from": "2026-04-01",
      "to": "2026-04-30"
    }
  }
}
```

### 5. Refund Payment (Admin)

```http
POST /api/v1/payments/:paymentId/refund
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amount": 100.00,
  "reason": "requested_by_customer"
}
```

**Reason Options:** `duplicate`, `fraudulent`, `requested_by_customer`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund processed successfully"
}
```

### 6. Stripe Webhook (No Auth)

```http
POST /api/v1/payments/webhook
Content-Type: application/json
Stripe-Signature: t=timestamp,v1=signature

{
  "id": "evt_1234567890",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": { ... }
}
```

**Automatically handled by Stripe libraries. No response needed.**

---

## 💬 COMMUNICATION Endpoints

### 1. Get or Create Conversation

```http
POST /api/v1/communications/conversations
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "therapistId": "550e8400-e29b-41d4-a716-446655440004"
}
```

**Response (201 Created or 200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440011",
    "participantIds": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440004"
    ],
    "createdAt": "2026-05-15T10:30:00Z"
  }
}
```

### 2. List Conversations

```http
GET /api/v1/communications/conversations
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "participantIds": [ /* ... */ ],
        "lastMessage": "Thanks for the guidance!",
        "lastMessageAt": "2026-05-15T14:22:00Z"
      }
    ]
  }
}
```

### 3. Get Messages

```http
GET /api/v1/communications/conversations/:conversationId/messages
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440012",
        "conversationId": "550e8400-e29b-41d4-a716-446655440011",
        "senderId": "550e8400-e29b-41d4-a716-446655440000",
        "body": "I have a question about my exercises",
        "messageType": "text",
        "createdAt": "2026-05-15T10:30:00Z"
      }
    ]
  }
}
```

### 4. Send Message

```http
POST /api/v1/communications/conversations/:conversationId/messages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "body": "Thanks for the guidance!",
  "messageType": "text"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440013",
    "conversationId": "550e8400-e29b-41d4-a716-446655440011",
    "senderId": "550e8400-e29b-41d4-a716-446655440000",
    "body": "Thanks for the guidance!",
    "messageType": "text",
    "createdAt": "2026-05-15T14:22:00Z"
  }
}
```

### 5. Save Clinical Note

```http
PUT /api/v1/communications/bookings/:bookingId/notes
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "subjective": "Patient reports knee pain since last week",
  "objective": "Range of motion limited, slight swelling",
  "assessment": "Likely ACL strain",
  "plan": "Rest, ice, compression, elevation. Follow-up in 1 week"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Clinical note saved successfully"
}
```

### 6. Get Clinical Note

```http
GET /api/v1/communications/bookings/:bookingId/notes
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "bookingId": "550e8400-e29b-41d4-a716-446655440009",
    "therapistId": "550e8400-e29b-41d4-a716-446655440004",
    "subjective": "Patient reports knee pain...",
    "objective": "Range of motion limited...",
    "assessment": "Likely ACL strain",
    "plan": "Rest, ice, compression...",
    "createdAt": "2026-05-15T10:30:00Z",
    "updatedAt": "2026-05-15T10:30:00Z"
  }
}
```

---

## 👨‍💼 ADMIN Endpoints

All admin endpoints require `super_admin` role.

### 1. Get Platform Statistics

```http
GET /api/v1/admin/stats
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "totalClinics": 15,
    "totalTherapists": 45,
    "totalBookings": 3500,
    "totalRevenue": 125000.00,
    "activeBookings": 120,
    "revenueThisMonth": 18500.00
  }
}
```

### 2. List All Clinics

```http
GET /api/v1/admin/clinics
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "clinics": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Central Physio Clinic",
        "city": "New York",
        "phone": "+12125551234",
        "isActive": true,
        "staffCount": 8,
        "bookingCount": 250
      }
    ]
  }
}
```

### 3. Set Clinic Active/Inactive

```http
PATCH /api/v1/admin/clinics/:clinicId/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Clinic status updated"
}
```

### 4. Get Audit Logs

```http
GET /api/v1/admin/audit-logs?page=1&limit=50
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440014",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "action": "CREATE_BOOKING",
        "resourceType": "booking",
        "resourceId": "550e8400-e29b-41d4-a716-446655440009",
        "changes": { /* ... */ },
        "timestamp": "2026-05-15T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 500 }
  }
}
```

---

## WebSocket (Real-time Chat)

### Connection

```javascript
const socket = io('https://physiobook-api.onrender.com', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIs...'  // JWT access token
  }
});
```

### Events

#### Subscribe to Conversation

```javascript
// Client → Server
socket.emit('subscribe', {
  conversationId: '550e8400-e29b-41d4-a716-446655440011'
});
```

#### Send Message (Real-time)

```javascript
// Client → Server
socket.emit('message', {
  conversationId: '550e8400-e29b-41d4-a716-446655440011',
  body: 'Hello!',
  messageType: 'text'
});

// Server → All participants
socket.on('message', (data) => {
  console.log('New message:', data);
  // {
  //   id: '...',
  //   conversationId: '...',
  //   senderId: '...',
  //   body: 'Hello!',
  //   messageType: 'text',
  //   createdAt: '2026-05-15T14:22:00Z'
  // }
});
```

#### Typing Indicator

```javascript
// Client → Server
socket.emit('typing', {
  conversationId: '550e8400-e29b-41d4-a716-446655440011',
  isTyping: true
});

// Server → Other participants
socket.on('user_typing', (data) => {
  console.log('User is typing:', data);
  // { userId: '...', conversationId: '...', isTyping: true }
});
```

#### Online Status

```javascript
// Server → Client (automatic on connection)
socket.on('online', (data) => {
  console.log('User online:', data);
  // { userId: '...', status: 'online' }
});

// Server → Client (automatic on disconnect)
socket.on('offline', (data) => {
  console.log('User offline:', data);
  // { userId: '...', status: 'offline' }
});
```

---

## Database Schema Overview

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | id, email, password_hash, role, is_active |
| `clinics` | Clinic locations | id, name, address, phone, is_active |
| `staff` | Therapists, receptionists | id, user_id, clinic_id, role, specialization |
| `services` | Treatment offerings | id, clinic_id, name, duration_minutes, price |
| `bookings` | Appointments | id, patient_id, therapist_id, clinic_id, status |
| `payments` | Payment records | id, booking_id, amount, currency, stripe_id, status |
| `conversations` | Chat threads | id, clinic_id, participant_ids |
| `messages` | Chat messages | id, conversation_id, sender_id, body |
| `clinical_notes` | SOAP notes | id, booking_id, therapist_id, subjective, objective, assessment, plan |
| `staff_schedules` | Therapist availability | id, staff_id, day_of_week, start_time, end_time |
| `time_blocks` | Blocked slots | id, staff_id, date, start_time, end_time |
| `resources` | Rooms/equipment | id, clinic_id, name, type |
| `audit_logs` | Activity tracking | id, user_id, action, resource_type, changes |

### Relationships

```
users (1) ─── (M) clinic_admins
users (1) ─── (M) staff
users (1) ─── (1) therapist_profiles
users (1) ─── (M) bookings (as patient)
users (1) ─── (M) payments (as payer)
users (1) ─── (M) conversations (as participant)
users (1) ─── (M) messages (as sender)

clinics (1) ─── (M) staff
clinics (1) ─── (M) services
clinics (1) ─── (M) bookings
clinics (1) ─── (M) resources
clinics (1) ─── (M) conversations

staff (1) ─── (M) bookings (as therapist)
staff (1) ─── (M) staff_schedules
staff (1) ─── (M) time_blocks
staff (1) ─── (M) clinical_notes

services (1) ─── (M) bookings
bookings (1) ─── (1) payments
bookings (1) ─── (M) clinical_notes

conversations (M) ─── (M) messages
```

---

## Common Integration Flows

### 1. User Registration & Login Flow

```javascript
// Step 1: Register
const registerRes = await fetch('https://api.physiobook.com/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'SecurePassword123'
  })
});

// Step 2: Verify email (check email inbox for verification link)
// User clicks link from email

// Step 3: Login
const loginRes = await fetch('https://api.physiobook.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'SecurePassword123'
  })
});

const { data } = await loginRes.json();
const { accessToken, refreshToken } = data;

// Step 4: Store tokens in localStorage or session
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### 2. Get Profile & Update Details

```javascript
// Get profile
const meRes = await fetch('https://api.physiobook.com/api/v1/users/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const { data: user } = await meRes.json();

// Update profile
const updateRes = await fetch('https://api.physiobook.com/api/v1/users/me', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    firstName: 'Jonathan',
    phone: '+12025551234',
    dateOfBirth: '1990-01-01'
  })
});
```

### 3. Browse Clinics & Services

```javascript
// List clinics
const clinicsRes = await fetch('https://api.physiobook.com/api/v1/clinics', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const { data } = await clinicsRes.json();

// Get clinic details
const clinicRes = await fetch(
  `https://api.physiobook.com/api/v1/clinics/${clinicId}`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);

// Get clinic services
const servicesRes = await fetch(
  `https://api.physiobook.com/api/v1/clinics/${clinicId}/services`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
```

### 4. Book an Appointment

```javascript
// Step 1: Get therapist availability
const slotsRes = await fetch(
  `https://api.physiobook.com/api/v1/bookings/slots?therapistId=${therapistId}&date=2026-05-15&serviceDuration=45`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
const { data: { availableSlots } } = await slotsRes.json();

// Step 2: Create booking
const bookingRes = await fetch('https://api.physiobook.com/api/v1/bookings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    clinicId: clinicId,
    therapistId: therapistId,
    serviceId: serviceId,
    appointmentDate: '2026-05-15',
    startTime: '10:00',
    endTime: '10:45'
  })
});

const { data: booking } = await bookingRes.json();
```

### 5. Process Payment with Stripe

```javascript
// Step 1: Create payment intent
const intentRes = await fetch('https://api.physiobook.com/api/v1/payments/intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    bookingId: bookingId,
    amount: 100.00,
    currency: 'LKR'
  })
});

const { data: { clientSecret } } = await intentRes.json();

// Step 2: Use Stripe.js to confirm payment
const stripe = Stripe('STRIPE_PUBLISHABLE_KEY');
const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: 'John Doe' }
  }
});

// Step 3: Webhook automatically updates payment status
```

### 6. Chat with Therapist

```javascript
// Step 1: Connect WebSocket with JWT token
const socket = io('https://physiobook-api.onrender.com', {
  auth: { token: accessToken }
});

// Step 2: Get or create conversation
const convRes = await fetch('https://api.physiobook.com/api/v1/communications/conversations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ therapistId })
});
const { data: { id: conversationId } } = await convRes.json();

// Step 3: Subscribe to conversation
socket.emit('subscribe', { conversationId });

// Step 4: Listen for messages
socket.on('message', (msg) => {
  console.log('New message:', msg);
});

// Step 5: Send message
socket.emit('message', {
  conversationId,
  body: 'I have a question',
  messageType: 'text'
});
```

### 7. Handle Token Expiration

```javascript
// When access token expires (401 response)
const refreshRes = await fetch('https://api.physiobook.com/api/v1/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

if (refreshRes.ok) {
  const { data } = await refreshRes.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  // Retry original request with new token
} else {
  // Refresh failed, redirect to login
  window.location.href = '/login';
}
```

---

## Environment Configuration

### Production Variables

Create a `.env` file in the `backend/` directory with these variables:

```bash
# ── App ──────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000
API_VERSION=v1

# ── CORS (comma-separated) ───────────────────────────────────
CORS_ORIGINS=https://app.physiobook.com,https://www.physiobook.com

# ── JWT ──────────────────────────────────────────────────────
JWT_ACCESS_SECRET=<64+ random characters>
JWT_REFRESH_SECRET=<64+ random characters>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Database (Supabase with Connection Pooler) ───────────────
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<your-password>
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10

# ── Redis (Upstash) ──────────────────────────────────────────
REDIS_HOST=nice-bulldog-106944.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=<your-password>
REDIS_TLS=true

# ── Stripe ────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_<your-key>
STRIPE_PUBLISHABLE_KEY=pk_live_<your-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-key>
STRIPE_CURRENCY=LKR

# ── Email (AWS SES) ──────────────────────────────────────────
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
EMAIL_FROM_ADDRESS=noreply@physiobook.com
EMAIL_FROM_NAME=Physiobook

# ── AWS S3 (File Storage) ────────────────────────────────────
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET=physiobook-uploads
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>

# ── Twilio (SMS) ──────────────────────────────────────────────
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=+1234567890

# ── 2FA/TOTP ──────────────────────────────────────────────────
TOTP_WINDOW=2
TOTP_ISSUER=Physiobook

# ── Logging ───────────────────────────────────────────────────
LOG_LEVEL=info
LOG_FORMAT=json
```

### Required Services

1. **Database:** Supabase PostgreSQL (recommended: Connection Pooler for better performance)
2. **Cache:** Redis (Upstash for serverless deployment)
3. **Payments:** Stripe account with API keys
4. **Email:** AWS SES or SendGrid
5. **Storage:** AWS S3 bucket
6. **SMS:** Twilio (optional)
7. **Deployment:** Render.com (or any Node.js host)

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause:** Invalid or expired access token

**Solution:**
1. Check if token is included in `Authorization` header
2. Verify token format: `Bearer <token>`
3. Use refresh token to get new access token
4. Re-login if refresh fails

```javascript
// Check token expiration
const token = localStorage.getItem('accessToken');
const decoded = jwt_decode(token);
console.log('Expires at:', new Date(decoded.exp * 1000));
```

### Issue: CORS Error

**Cause:** Frontend origin not in `CORS_ORIGINS` list

**Solution:**
1. Check `CORS_ORIGINS` environment variable
2. Add your frontend URL to the list (comma-separated)
3. Restart the backend server
4. For development, ensure `http://localhost:XXXX` matches exactly

### Issue: 422 Validation Error

**Cause:** Request data doesn't meet validation rules

**Solution:**
1. Check the `details` array in error response
2. Validate each field according to error messages
3. Common issues:
   - Email format: must be valid email
   - Password: min 8 chars, uppercase, lowercase, number
   - Phone: must match E.164 format (+1234567890)
   - UUID: 36-character UUID format

### Issue: Payment Fails

**Cause:** Stripe configuration or payment method issue

**Solution:**
1. Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are correct
2. Check payment method is valid
3. Ensure amount > $0.50 (or currency equivalent)
4. Check Stripe dashboard for webhook delivery status

### Issue: Database Connection Timeout

**Cause:** Network connectivity, wrong credentials, or pooler issues

**Solution:**
1. Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`
2. Use Connection Pooler for reliability: `aws-1-ap-southeast-1.pooler.supabase.com:6543`
3. Check database is running and accessible
4. For production, use VPC or firewall rules correctly
5. Check server logs for connection error details

### Issue: WebSocket Connection Failed

**Cause:** Auth token missing or invalid

**Solution:**
```javascript
// Ensure token is passed correctly
const socket = io('https://api.physiobook.com', {
  auth: {
    token: localStorage.getItem('accessToken')  // Include valid JWT
  }
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
});
```

### Issue: Avatar Upload Fails

**Cause:** File too large or not an image

**Solution:**
1. File must be < 5MB
2. File must be image type (image/jpeg, image/png, etc.)
3. Use multipart/form-data, not JSON
4. In production, ensure S3 bucket has correct permissions

### Issue: Rate Limited

**Cause:** Too many requests in short time

**Solution:**
1. Implement exponential backoff in client
2. Wait for `X-RateLimit-Reset` header (seconds since epoch)
3. General API: max 100 req/15min
4. Auth: max 10 req/15min
5. OTP: max 5 req/15min

---

## Support & Contact

- **GitHub:** https://github.com/Himal-Gunawardhana/Physiobook-backend
- **Issues:** Report bugs via GitHub Issues
- **Status:** Check deployment status at https://physiobook-api.onrender.com/health

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Apr 2026 | Initial release with 59+ endpoints |

---

**Last Updated:** April 27, 2026  
**Maintained by:** Physiobook Backend Team
