# Physiobook Backend API - Complete Documentation

**Version:** 1.0.0  
**Last Updated:** April 27, 2026  
**Status:** Production Ready  
**Repository:** https://github.com/Himal-Gunawardhana/Physiobook-backend

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [API Configuration](#api-configuration)
4. [Authentication](#authentication)
5. [Response Format](#response-format)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Security](#security)
9. [Rate Limiting](#rate-limiting)
10. [WebSocket (Real-time)](#websocket-real-time)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Physiobook Backend is a **Node.js/Express REST API** for a physiotherapy clinic booking platform. It provides comprehensive endpoints for:

- 👥 User management and authentication
- 🏥 Clinic operations
- 👨‍⚕️ Staff/therapist management
- 📅 Booking and scheduling
- 💳 Payment processing (Stripe)
- 💬 Real-time chat and communications
- 🛡️ Admin control panel

### **Tech Stack**
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.19
- **Database:** PostgreSQL 16 (Supabase)
- **Cache:** Redis (Upstash)
- **Authentication:** JWT (RS256)
- **Payments:** Stripe
- **Real-time:** WebSocket (Socket.io)
- **Deployment:** Render

### **API Base URL**
```
https://physiobook-api-jvye.onrender.com/api/v1
```

---

## 🚀 Quick Start

### **1. Backend Health Check**
```bash
curl https://physiobook-api-jvye.onrender.com/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "physiobook-api",
  "version": "1.0.0",
  "timestamp": "2026-04-27T20:30:00.000Z"
}
```

### **2. Register a User**
```bash
curl -X POST https://physiobook-api-jvye.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### **3. Login**
```bash
curl -X POST https://physiobook-api-jvye.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-here",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "patient",
      "isActive": true
    }
  },
  "message": "Login successful"
}
```

---

## 🔧 API Configuration

### **Environment Variables Required**

```env
# ── App Settings ──────────────────────────
NODE_ENV=production
PORT=4000
API_VERSION=v1

# ── CORS ─────────────────────────────────
# Comma-separated list of allowed frontend URLs
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://your-frontend.com

# ── Database (PostgreSQL via Supabase) ────
DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.oxjhzyzyewbzwqqndfho
DB_PASSWORD=your-password
DB_SSL=true

# ── Redis (Upstash) ──────────────────────
REDIS_HOST=nice-bulldog-106944.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_TLS=true

# ── JWT Authentication ──────────────────
JWT_ACCESS_SECRET=your-long-random-string-min-64-chars
JWT_REFRESH_SECRET=your-long-random-string-min-64-chars

# ── Stripe Payments ────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=LKR

# ── Email Configuration ──────────────
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_ADDRESS=noreply@physiobook.com
EMAIL_FROM_NAME=Physiobook
```

### **Frontend Configuration**

Add this to your frontend `.env.local`:

```env
VITE_BACKEND_URL=https://physiobook-api-jvye.onrender.com
VITE_API_VERSION=v1
```

---

## 🔐 Authentication

### **JWT Token Flow**

1. **Register/Login** → Get `accessToken` + `refreshToken`
2. **Use accessToken** in all API requests (expires in 15 minutes)
3. **When expired** → Call refresh endpoint to get new token
4. **Refresh token** valid for 7 days (stored securely)

### **Token Storage**

```javascript
// Store token in localStorage
localStorage.setItem('physiobook_auth_token', accessToken);
localStorage.setItem('physiobook_refresh_token', refreshToken);
```

### **Authorization Header**

```bash
Authorization: Bearer <accessToken>
```

### **Example: Get Current User**

```bash
curl -X GET https://physiobook-api-jvye.onrender.com/api/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### **Refresh Token**

```bash
curl -X POST https://physiobook-api-jvye.onrender.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-token-here"
  }
}
```

---

## 📦 Response Format

### **Success Response** (Status: 200, 201)

```json
{
  "success": true,
  "data": {
    /* actual response data */
  },
  "message": "Operation successful"
}
```

**Example:**
```json
{
  "success": true,
  "data": {
    "id": "clinic-uuid",
    "name": "Main Clinic",
    "address": "123 Main St",
    "city": "New York",
    "phone": "+1234567890"
  },
  "message": "Clinic retrieved successfully"
}
```

### **List Response** (Status: 200)

```json
{
  "success": true,
  "data": [
    { /* item 1 */ },
    { /* item 2 */ }
  ],
  "total": 2,
  "page": 1,
  "limit": 10
}
```

### **Error Response** (Status: 400-500)

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "User-friendly error message"
}
```

**Examples:**

```json
// Validation Error (400)
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

```json
// Duplicate Resource (409)
{
  "success": false,
  "error": "DUPLICATE_RESOURCE",
  "message": "Email already registered"
}
```

```json
// Not Found (404)
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Clinic not found"
}
```

```json
// Unauthorized (401)
{
  "success": false,
  "error": "AUTH_ERROR",
  "message": "Invalid or expired authentication token. Please login again."
}
```

---

## 📡 API Endpoints

### **🔑 Authentication Endpoints** (`/auth`)

#### **POST /auth/register**
Register a new user.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "SecurePass123"
}
```

**Requirements:**
- Email must be valid and unique
- Password must be 8+ chars, contain uppercase, lowercase, and number
- First/Last name required

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "patient",
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

#### **GET /auth/verify-email?token={token}**
Verify user email address.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

#### **POST /auth/login**
Authenticate user and get tokens.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { /* user object */ }
  }
}
```

---

#### **POST /auth/refresh**
Refresh expired access token.

**Request:**
```json
{
  "refreshToken": "..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "new-token-here"
  }
}
```

---

#### **POST /auth/logout** ⭐ (Protected)
Logout and invalidate tokens.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### **POST /auth/forgot-password**
Request password reset.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset link sent to email"
}
```

---

#### **POST /auth/reset-password**
Reset password with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

#### **POST /auth/2fa/setup** ⭐ (Protected)
Setup two-factor authentication.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCode": "data:image/png;base64,..."
  },
  "message": "Scan QR code with authenticator app"
}
```

---

#### **POST /auth/2fa/confirm** ⭐ (Protected)
Confirm 2FA setup with code.

**Request:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

---

#### **POST /auth/2fa/verify**
Verify 2FA code during login.

**Request:**
```json
{
  "partialToken": "partial-token-from-login",
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

#### **DELETE /auth/2fa** ⭐ (Protected)
Disable two-factor authentication.

**Request:**
```json
{
  "code": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "2FA disabled"
}
```

---

### **👤 User Endpoints** (`/users`)

#### **GET /users/me** ⭐ (Protected)
Get current user profile.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "role": "patient",
    "avatarUrl": "https://...",
    "isActive": true,
    "createdAt": "2026-04-27T...",
    "updatedAt": "2026-04-27T..."
  }
}
```

---

#### **PUT /users/me** ⭐ (Protected)
Update current user profile.

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+9876543210",
  "dateOfBirth": "1990-01-15",
  "gender": "female"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { /* updated user */ }
}
```

---

#### **POST /users/me/avatar** ⭐ (Protected)
Upload user avatar image.

**Request:** Multipart form data
```
avatar: <file> (max 5MB, image only)
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://..."
  }
}
```

---

#### **PUT /users/me/password** ⭐ (Protected)
Change user password.

**Request:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

#### **GET /users** ⭐ (Protected - Admin only)
List all users (pagination supported).

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [ /* array of users */ ],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

---

#### **GET /users/:id** ⭐ (Protected)
Get specific user by ID.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { /* user object */ }
}
```

---

#### **PATCH /users/:id/status** ⭐ (Protected - Admin only)
Activate or deactivate user.

**Request:**
```json
{
  "isActive": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User status updated"
}
```

---

#### **DELETE /users/:id** ⭐ (Protected - Admin only)
Delete user (soft delete).

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User deleted"
}
```

---

### **🏥 Clinic Endpoints** (`/clinics`)

#### **GET /clinics** ⭐ (Protected)
List all clinics (public browsing).

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `search` - Search by name
- `city` - Filter by city

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "clinic-uuid",
      "name": "Main Clinic",
      "address": "123 Main St",
      "city": "New York",
      "country": "USA",
      "phone": "+1234567890",
      "email": "info@clinic.com",
      "isActive": true,
      "services": [ /* array of services */ ]
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10
}
```

---

#### **GET /clinics/:clinicId** ⭐ (Protected)
Get clinic details.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "clinic-uuid",
    "name": "Main Clinic",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "phone": "+1234567890",
    "email": "info@clinic.com",
    "operatingHours": [
      { "day": "Monday", "open": "09:00", "close": "17:00" }
    ],
    "services": [
      {
        "id": "service-uuid",
        "name": "Physical Therapy",
        "durationMinutes": 60,
        "price": 100
      }
    ],
    "staff": [
      {
        "id": "staff-uuid",
        "firstName": "Dr. Jane",
        "lastName": "Smith",
        "role": "therapist",
        "specializations": ["Back pain", "Injury recovery"]
      }
    ]
  }
}
```

---

#### **POST /clinics** ⭐ (Protected - Super Admin only)
Create new clinic.

**Request:**
```json
{
  "name": "New Clinic",
  "addressLine1": "123 Main St",
  "city": "New York",
  "country": "USA",
  "phone": "+1234567890",
  "email": "info@clinic.com"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": { /* clinic object */ }
}
```

---

#### **PUT /clinics/:clinicId** ⭐ (Protected - Clinic Admin+)
Update clinic details.

**Request:**
```json
{
  "name": "Updated Name",
  "phone": "+9876543210"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { /* updated clinic */ }
}
```

---

#### **GET /clinics/:clinicId/hours** ⭐ (Protected)
Get clinic operating hours.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "day": "Monday",
      "open": "09:00",
      "close": "17:00",
      "isClosed": false
    },
    {
      "day": "Sunday",
      "isClosed": true
    }
  ]
}
```

---

#### **PUT /clinics/:clinicId/hours** ⭐ (Protected - Clinic Admin+)
Set clinic operating hours.

**Request:**
```json
{
  "hours": [
    { "day": "Monday", "open": "08:00", "close": "18:00" },
    { "day": "Saturday", "isClosed": true }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Operating hours updated"
}
```

---

#### **GET /clinics/:clinicId/services** ⭐ (Protected)
Get clinic services.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "service-uuid",
      "name": "Physical Therapy",
      "description": "General PT",
      "durationMinutes": 60,
      "price": 100
    }
  ]
}
```

---

#### **POST /clinics/:clinicId/services** ⭐ (Protected - Clinic Admin+)
Add new service.

**Request:**
```json
{
  "name": "Sports Injury Recovery",
  "description": "Specialized recovery for athletes",
  "durationMinutes": 90,
  "price": 150
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": { /* service object */ }
}
```

---

#### **PUT /clinics/:clinicId/services/:serviceId** ⭐ (Protected - Clinic Admin+)
Update service.

**Request:**
```json
{
  "price": 120
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { /* updated service */ }
}
```

---

### **👨‍⚕️ Staff Endpoints** (`/staff`)

#### **GET /staff** ⭐ (Protected - Clinic staff+)
List clinic staff.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "staff-uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@clinic.com",
      "role": "therapist",
      "specializations": ["Back pain", "Sports injury"],
      "licenseNumber": "PT123456",
      "isActive": true
    }
  ]
}
```

---

#### **POST /staff** ⭐ (Protected - Clinic Admin+)
Create staff member.

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@clinic.com",
  "role": "therapist"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": { /* staff object */ }
}
```

---

#### **GET /staff/therapists/:therapistId** ⭐ (Protected)
Get therapist profile.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "therapist-uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "specializations": ["Back pain", "Sports injury"],
    "bio": "10+ years of experience",
    "rating": 4.8,
    "totalReviews": 45
  }
}
```

---

#### **GET /staff/therapists/:therapistId/availability** ⭐ (Protected)
Get therapist availability for specific date.

**Query Parameters:**
- `date` - Date in YYYY-MM-DD format (required)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "therapistId": "therapist-uuid",
    "date": "2026-05-10",
    "slots": [
      { "startTime": "09:00", "endTime": "10:00", "isAvailable": true },
      { "startTime": "10:00", "endTime": "11:00", "isAvailable": false },
      { "startTime": "14:00", "endTime": "15:00", "isAvailable": true }
    ]
  }
}
```

---

#### **PUT /staff/therapists/:therapistId/schedule** ⭐ (Protected - Therapist+)
Set therapist weekly schedule.

**Request:**
```json
{
  "schedule": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 2, "startTime": "09:00", "endTime": "17:00" },
    { "dayOfWeek": 6, "isOff": true }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Schedule updated"
}
```

---

#### **POST /staff/therapists/:therapistId/block** ⭐ (Protected - Therapist+)
Block time slot (vacation, lunch, etc).

**Request:**
```json
{
  "date": "2026-05-15",
  "startTime": "12:00",
  "endTime": "13:00",
  "reason": "Lunch break"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Time slot blocked"
}
```

---

#### **GET /staff/resources** ⭐ (Protected)
List clinic resources (rooms, equipment).

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "resource-uuid",
      "name": "Treatment Room 1",
      "type": "room",
      "isAvailable": true
    },
    {
      "id": "resource-uuid",
      "name": "Ultrasound Machine",
      "type": "equipment",
      "isAvailable": true
    }
  ]
}
```

---

#### **POST /staff/resources** ⭐ (Protected - Clinic Admin+)
Create resource.

**Request:**
```json
{
  "name": "Traction Table",
  "type": "equipment"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": { /* resource object */ }
}
```

---

### **📅 Booking Endpoints** (`/bookings`)

#### **GET /bookings/slots** ⭐ (Protected)
Get available appointment slots.

**Query Parameters:**
- `therapistId` - Therapist UUID (required)
- `date` - Date YYYY-MM-DD (required)
- `serviceDuration` - Duration in minutes (required)

**Example:**
```
GET /api/v1/bookings/slots?therapistId=uuid&date=2026-05-10&serviceDuration=60
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "therapistId": "therapist-uuid",
    "date": "2026-05-10",
    "slots": [
      { "startTime": "09:00", "endTime": "10:00" },
      { "startTime": "10:30", "endTime": "11:30" },
      { "startTime": "14:00", "endTime": "15:00" }
    ]
  }
}
```

---

#### **GET /bookings** ⭐ (Protected)
List user's bookings.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status (confirmed, cancelled, completed, no_show)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "booking-uuid",
      "clinicId": "clinic-uuid",
      "therapistId": "therapist-uuid",
      "serviceId": "service-uuid",
      "appointmentDate": "2026-05-10",
      "startTime": "10:00",
      "endTime": "11:00",
      "status": "confirmed",
      "notes": "Back pain treatment",
      "createdAt": "2026-04-27T..."
    }
  ],
  "total": 5,
  "page": 1
}
```

---

#### **POST /bookings** ⭐ (Protected)
Create new booking.

**Request:**
```json
{
  "clinicId": "clinic-uuid",
  "therapistId": "therapist-uuid",
  "serviceId": "service-uuid",
  "appointmentDate": "2026-05-10",
  "startTime": "10:00",
  "endTime": "11:00",
  "notes": "Back pain treatment"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "appointmentDate": "2026-05-10",
    "startTime": "10:00",
    "status": "confirmed",
    "confirmationEmail": "sent"
  }
}
```

---

#### **GET /bookings/:bookingId** ⭐ (Protected)
Get booking details.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "booking-uuid",
    "clinic": { /* clinic data */ },
    "therapist": { /* therapist data */ },
    "service": { /* service data */ },
    "appointmentDate": "2026-05-10",
    "startTime": "10:00",
    "endTime": "11:00",
    "status": "confirmed",
    "notes": "Back pain treatment"
  }
}
```

---

#### **PATCH /bookings/:bookingId/status** ⭐ (Protected - Admin/Therapist+)
Update booking status.

**Request:**
```json
{
  "status": "completed"
}
```

**Valid statuses:** `confirmed`, `cancelled`, `completed`, `no_show`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Booking status updated to completed"
}
```

---

#### **PUT /bookings/:bookingId/reschedule** ⭐ (Protected)
Reschedule booking.

**Request:**
```json
{
  "appointmentDate": "2026-05-12",
  "startTime": "14:00",
  "endTime": "15:00"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Booking rescheduled"
}
```

---

#### **POST /bookings/:bookingId/cancel** ⭐ (Protected)
Cancel booking.

**Request:**
```json
{
  "reason": "Schedule conflict"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Booking cancelled"
}
```

---

### **💳 Payment Endpoints** (`/payments`)

#### **POST /payments/intent** ⭐ (Protected)
Create Stripe payment intent.

**Request:**
```json
{
  "bookingId": "booking-uuid",
  "amount": 100,
  "currency": "USD"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_1234567890_secret_xxx",
    "amount": 100,
    "currency": "USD"
  }
}
```

---

#### **GET /payments** ⭐ (Protected)
List user's payments.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-uuid",
      "bookingId": "booking-uuid",
      "amount": 100,
      "currency": "USD",
      "status": "succeeded",
      "stripePaymentId": "pi_xxx",
      "createdAt": "2026-04-27T..."
    }
  ]
}
```

---

#### **GET /payments/:paymentId** ⭐ (Protected)
Get payment details.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": { /* payment object */ }
}
```

---

#### **GET /payments/revenue** ⭐ (Protected - Admin+)
Get revenue summary.

**Query Parameters:**
- `dateFrom` - Start date (YYYY-MM-DD)
- `dateTo` - End date (YYYY-MM-DD)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalRevenue": 5000,
    "totalPayments": 50,
    "averagePayment": 100,
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30"
  }
}
```

---

#### **POST /payments/:paymentId/refund** ⭐ (Protected - Admin+)
Refund payment.

**Request:**
```json
{
  "amount": 100,
  "reason": "customer_request"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Refund processed"
}
```

---

#### **POST /payments/webhook** (No Auth)
Stripe webhook handler (called by Stripe servers).

**Note:** Signature verification required. Raw body must be used.

---

### **💬 Communication Endpoints** (`/communications`)

#### **GET /communications/conversations** ⭐ (Protected)
List user's conversations.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "conversation-uuid",
      "participantId": "user-uuid",
      "participantName": "Dr. Jane Smith",
      "lastMessage": "See you next week",
      "lastMessageTime": "2026-04-27T15:30:00Z",
      "unreadCount": 2
    }
  ]
}
```

---

#### **POST /communications/conversations** ⭐ (Protected)
Get or create conversation.

**Request:**
```json
{
  "therapistId": "therapist-uuid"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "conversation-uuid",
    "participantId": "therapist-uuid"
  }
}
```

---

#### **GET /communications/conversations/:conversationId/messages** ⭐ (Protected)
Get conversation messages.

**Query Parameters:**
- `limit` - Number of messages to fetch (default: 50)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "message-uuid",
      "senderId": "user-uuid",
      "body": "I have a question about my therapy",
      "type": "text",
      "createdAt": "2026-04-27T15:30:00Z"
    }
  ]
}
```

---

#### **POST /communications/conversations/:conversationId/messages** ⭐ (Protected)
Send message.

**Request:**
```json
{
  "body": "Thanks for the advice!",
  "messageType": "text"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "message-uuid",
    "body": "Thanks for the advice!",
    "createdAt": "2026-04-27T15:30:00Z"
  }
}
```

---

#### **PUT /communications/bookings/:bookingId/notes** ⭐ (Protected - Therapist+)
Save clinical notes (SOAP format).

**Request:**
```json
{
  "subjective": "Patient reports pain level 6/10",
  "objective": "ROM: 0-90 degrees, Strength: 4/5",
  "assessment": "Acute lower back strain",
  "plan": "Continue PT, prescribe exercises"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Clinical notes saved"
}
```

---

#### **GET /communications/bookings/:bookingId/notes** ⭐ (Protected - Therapist+)
Get clinical notes.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "bookingId": "booking-uuid",
    "subjective": "Patient reports...",
    "objective": "ROM:...",
    "assessment": "...",
    "plan": "...",
    "savedAt": "2026-04-27T..."
  }
}
```

---

### **⚙️ Admin Endpoints** (`/admin`)

#### **GET /admin/stats** ⭐ (Protected - Super Admin only)
Get platform statistics.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalClinics": 12,
    "totalBookings": 500,
    "totalRevenue": 25000,
    "activeBookings": 45,
    "completedBookings": 455
  }
}
```

---

#### **GET /admin/clinics** ⭐ (Protected - Super Admin only)
List all clinics.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [ /* array of all clinics */ ]
}
```

---

#### **PATCH /admin/clinics/:clinicId/status** ⭐ (Protected - Super Admin only)
Activate or deactivate clinic.

**Request:**
```json
{
  "isActive": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Clinic status updated"
}
```

---

#### **GET /admin/audit-logs** ⭐ (Protected - Super Admin only)
Get audit logs.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "userId": "user-uuid",
      "action": "create_booking",
      "entityType": "booking",
      "entityId": "booking-uuid",
      "timestamp": "2026-04-27T15:30:00Z"
    }
  ]
}
```

---

## ⚠️ Error Handling

### **HTTP Status Codes**

| Code | Meaning | When Used |
|------|---------|-----------|
| **200** | OK | Successful GET, PUT, PATCH, DELETE |
| **201** | Created | Successful POST (resource created) |
| **400** | Bad Request | Invalid input, validation error |
| **401** | Unauthorized | Missing/invalid authentication token |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource (email exists, etc) |
| **413** | Payload Too Large | File upload exceeds size limit |
| **422** | Unprocessable Entity | Validation failed |
| **500** | Server Error | Internal server error |

### **Common Error Codes**

```javascript
{
  "VALIDATION_ERROR": "Request validation failed",
  "AUTH_ERROR": "Invalid or expired token",
  "DUPLICATE_RESOURCE": "Email already registered",
  "INVALID_REFERENCE": "Referenced resource not found",
  "NOT_FOUND": "Resource not found",
  "PAYMENT_ERROR": "Payment processing failed",
  "INSUFFICIENT_PERMISSIONS": "You don't have permission",
  "CORS_ERROR": "Origin not allowed",
  "FILE_TOO_LARGE": "File exceeds 5MB limit",
  "INTERNAL_ERROR": "Unexpected server error"
}
```

### **Error Response Examples**

**Validation Error:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

**Duplicate Resource:**
```json
{
  "success": false,
  "error": "DUPLICATE_RESOURCE",
  "message": "Email already registered"
}
```

**Not Found:**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Clinic not found"
}
```

---

## 🔒 Security

### **Security Features**

- ✅ **HTTPS/TLS** - All traffic encrypted
- ✅ **Helmet.js** - Security headers
- ✅ **CORS** - Origin whitelisting
- ✅ **JWT** - Token-based authentication (RS256)
- ✅ **Password Hashing** - bcryptjs
- ✅ **Input Validation** - Express-validator
- ✅ **SQL Injection Protection** - Parameterized queries
- ✅ **Rate Limiting** - Redis-based
- ✅ **RBAC** - Role-based access control
- ✅ **2FA** - Two-factor authentication support

### **Authentication Best Practices**

1. **Always use HTTPS** - Never transmit tokens over HTTP
2. **Store tokens securely** - Use localStorage or secure cookies
3. **Add token to headers** - `Authorization: Bearer <token>`
4. **Handle token expiry** - Refresh when expired
5. **Clear on logout** - Remove tokens from storage
6. **Use HTTPS only cookies** - For refresh tokens (HttpOnly flag)

### **Password Requirements**

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- No dictionary words

---

## 🚦 Rate Limiting

### **Limits**

| Endpoint | Limit | Window |
|----------|-------|--------|
| **/auth (register/login)** | 10 requests | 15 minutes |
| **/auth/2fa/verify** | 5 attempts | 15 minutes |
| **All API routes** | 100 requests | 15 minutes |

### **Rate Limit Headers**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1609459200
```

### **Rate Limit Exceeded**

```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later"
}
```

---

## 🔌 WebSocket (Real-time Chat)

### **Connection**

```javascript
import io from 'socket.io-client';

const socket = io('https://physiobook-api-jvye.onrender.com', {
  auth: {
    token: accessToken
  }
});
```

### **Events**

**Send Message:**
```javascript
socket.emit('send_message', {
  conversationId: 'conversation-uuid',
  message: 'Hello!'
});
```

**Receive Message:**
```javascript
socket.on('receive_message', (data) => {
  console.log('New message:', data.message);
});
```

**User Online:**
```javascript
socket.on('user_online', (data) => {
  console.log('User is online:', data.userId);
});
```

**User Offline:**
```javascript
socket.on('user_offline', (data) => {
  console.log('User went offline:', data.userId);
});
```

---

## 🧪 Testing

### **Using Postman**

1. Create new collection "Physiobook API"
2. Set base URL: `https://physiobook-api-jvye.onrender.com/api/v1`
3. Add environment variable: `token` = access token from login
4. Use `{{token}}` in Authorization header

### **Using cURL**

```bash
# Register
curl -X POST https://physiobook-api-jvye.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# Login
curl -X POST https://physiobook-api-jvye.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# Get current user (with token)
curl -X GET https://physiobook-api-jvye.onrender.com/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **Health Check**

```bash
curl https://physiobook-api-jvye.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "physiobook-api",
  "version": "1.0.0"
}
```

---

## 🐛 Troubleshooting

### **CORS Error**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**
1. Verify frontend URL in `CORS_ORIGINS` environment variable
2. Check that backend is running
3. Clear browser cache
4. Ensure correct request headers

### **401 Unauthorized**
```json
{ "error": "AUTH_ERROR", "message": "Invalid or expired token" }
```

**Solutions:**
1. Verify token is included in Authorization header
2. Check token format: `Bearer <token>`
3. Refresh token if expired
4. Re-login if token is invalid

### **400 Bad Request**
```json
{ "error": "VALIDATION_ERROR", "message": "Request validation failed" }
```

**Solutions:**
1. Check request body matches schema
2. Verify all required fields are provided
3. Ensure data types are correct
4. Check email format, password requirements

### **404 Not Found**
```json
{ "error": "NOT_FOUND", "message": "Clinic not found" }
```

**Solutions:**
1. Verify resource ID is correct
2. Check that resource exists in database
3. Confirm you have permission to access

### **429 Too Many Requests**
```json
{ "message": "Too many requests, please try again later" }
```

**Solutions:**
1. Wait for rate limit window to reset
2. Reduce request frequency
3. Implement exponential backoff

### **Backend Connection Failed**

**Check:**
```bash
# Test health endpoint
curl https://physiobook-api-jvye.onrender.com/health

# Test CORS
curl -X OPTIONS https://physiobook-api-jvye.onrender.com/api/v1/users/me \
  -H "Origin: http://localhost:5173"
```

**If fails:**
1. Verify backend is deployed and running
2. Check database connection
3. Review Render logs for errors
4. Verify environment variables are set correctly

---

## 📞 Support

For issues or questions:

1. **Check documentation** - This guide covers 99% of use cases
2. **Check logs** - Review browser console and server logs
3. **Check GitHub** - Repository: https://github.com/Himal-Gunawardhana/Physiobook-backend
4. **Health check** - Verify backend is running: `/health`

---

## 📦 API Summary

- **Total Endpoints:** 59+
- **Authentication:** JWT (RS256)
- **Response Format:** JSON
- **Rate Limiting:** Yes (100 req/min)
- **CORS:** Enabled
- **WebSocket:** Real-time chat
- **Database:** PostgreSQL (Supabase)
- **Cache:** Redis (Upstash)
- **Payments:** Stripe
- **Hosting:** Render

---

**API Documentation v1.0.0**  
**Last Updated:** April 27, 2026  
**Status:** Production Ready ✅

---

## 🎯 Quick Links

- **GitHub Repository:** https://github.com/Himal-Gunawardhana/Physiobook-backend
- **API Base URL:** https://physiobook-api-jvye.onrender.com/api/v1
- **Health Check:** https://physiobook-api-jvye.onrender.com/health
- **Frontend Repo:** [Your frontend repo URL]

