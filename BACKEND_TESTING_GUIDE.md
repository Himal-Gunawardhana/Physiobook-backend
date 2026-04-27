# 🧪 Physiobook Backend Testing Guide

## Quick Start

### 1. Start the Backend Server
```bash
cd backend
npm start
```

Expected output:
```
23:50:07 [info] ✅  PostgreSQL connected
23:50:07 [info] ✅  Redis connected
23:50:07 [info] 🚀  Physiobook API running on port 4000 [production] (normal mode)
```

---

## ✅ Basic Health Check

### Health Endpoint (No Auth)
```bash
curl -s http://localhost:4000/health | jq .
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "physiobook-api",
  "version": "1.0.0",
  "timestamp": "2026-04-27T18:20:08.478Z"
}
```

---

## 🔐 Authentication Tests

### 1. Register a New User
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.com",
    "password": "TestPassword123",
    "phone": "+1234567890"
  }' | jq .
```

### 2. Login (Get Tokens)
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@test.com",
    "password": "TestPassword123"
  }' | jq .
```

**Save the `accessToken` and `refreshToken` from response:**
```bash
# Export for easy reuse in terminal
export TOKEN="your_access_token_here"
export REFRESH_TOKEN="your_refresh_token_here"
```

### 3. Refresh Token
```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }' | jq .
```

---

## 👤 User Endpoints (Requires Auth)

### Get Current User Profile
```bash
curl -X GET http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Update Profile
```bash
curl -X PUT http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jonathan",
    "phone": "+1987654321"
  }' | jq .
```

---

## 🏢 Clinic Endpoints

### List All Clinics
```bash
curl -X GET http://localhost:4000/api/v1/clinics \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Create a Clinic (Super Admin Only)
```bash
curl -X POST http://localhost:4000/api/v1/clinics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Central Physio Clinic",
    "addressLine1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA",
    "phone": "+12125551234",
    "email": "contact@centralphysio.com"
  }' | jq .
```

### Get Clinic Details
```bash
CLINIC_ID="550e8400-e29b-41d4-a716-446655440000"
curl -X GET http://localhost:4000/api/v1/clinics/$CLINIC_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Get Clinic Services
```bash
curl -X GET http://localhost:4000/api/v1/clinics/$CLINIC_ID/services \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 📅 Booking Endpoints

### Get Available Slots
```bash
THERAPIST_ID="550e8400-e29b-41d4-a716-446655440001"
curl -X GET "http://localhost:4000/api/v1/bookings/slots?therapistId=$THERAPIST_ID&date=2026-05-15&serviceDuration=45" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Create Booking
```bash
curl -X POST http://localhost:4000/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId": "'$CLINIC_ID'",
    "therapistId": "'$THERAPIST_ID'",
    "serviceId": "550e8400-e29b-41d4-a716-446655440002",
    "appointmentDate": "2026-05-15",
    "startTime": "10:00",
    "endTime": "10:45"
  }' | jq .
```

### List My Bookings
```bash
curl -X GET http://localhost:4000/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 💳 Payment Endpoints

### Create Payment Intent
```bash
BOOKING_ID="550e8400-e29b-41d4-a716-446655440003"
curl -X POST http://localhost:4000/api/v1/payments/intent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "amount": 100.00,
    "currency": "LKR"
  }' | jq .
```

### List Payments
```bash
curl -X GET http://localhost:4000/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 💬 Communication (Chat) Endpoints

### Create/Get Conversation
```bash
curl -X POST http://localhost:4000/api/v1/communications/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "therapistId": "'$THERAPIST_ID'"
  }' | jq .
```

### List My Conversations
```bash
curl -X GET http://localhost:4000/api/v1/communications/conversations \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Send Message
```bash
CONVERSATION_ID="550e8400-e29b-41d4-a716-446655440004"
curl -X POST http://localhost:4000/api/v1/communications/conversations/$CONVERSATION_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "I have a question about my treatment",
    "messageType": "text"
  }' | jq .
```

---

## ⚠️ Error Testing

### Test Invalid Email Validation
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "TestPassword123"
  }' | jq .
```

**Expected Error Response:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "type": "field",
      "value": "invalid-email",
      "msg": "Invalid value",
      "path": "email",
      "location": "body"
    }
  ]
}
```

### Test Missing Auth Token
```bash
curl -X GET http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer invalid_token" | jq .
```

**Expected Error:**
```json
{
  "success": false,
  "error": "AUTH_ERROR",
  "message": "Invalid or expired authentication token. Please login again."
}
```

### Test Duplicate Email
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "john@test.com",
    "password": "TestPassword123"
  }' | jq .
```

---

## 🔄 CORS Testing

### Test CORS Headers with Origin
```bash
curl -X OPTIONS http://localhost:4000/api/v1/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v 2>&1 | grep -i "access-control"
```

**Expected Headers:**
```
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Credentials: true
< Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization, X-Refresh-Token
< Access-Control-Max-Age: 86400
```

---

## 🧬 WebSocket Testing (Real-time Chat)

### Using wscat (Install first: `npm install -g wscat`)
```bash
wscat -c "ws://localhost:4000/ws/chat?token=$TOKEN"
```

### Send Message via WebSocket
```json
{
  "type": "SEND_MESSAGE",
  "payload": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440004",
    "body": "Hello from WebSocket!",
    "messageType": "text"
  }
}
```

### Typing Indicator
```json
{
  "type": "TYPING",
  "payload": {
    "conversationId": "550e8400-e29b-41d4-a716-446655440004"
  }
}
```

---

## 📊 Bulk Testing Script

Save this as `test-backend.sh`:

```bash
#!/bin/bash

API="http://localhost:4000/api/v1"
TOKEN=""

echo "🧪 Physiobook Backend Testing"
echo "=============================="
echo ""

# Test 1: Health Check
echo "✓ Test 1: Health Check"
curl -s http://localhost:4000/health | jq .
echo ""

# Test 2: Register User
echo "✓ Test 2: Register User"
REGISTER_RESPONSE=$(curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test'$(date +%s)'@test.com",
    "password": "TestPassword123"
  }')
echo "$REGISTER_RESPONSE" | jq .
echo ""

# Test 3: Login
echo "✓ Test 3: Login"
LOGIN_RESPONSE=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@physiobook.com",
    "password": "TestPassword123"
  }')
echo "$LOGIN_RESPONSE" | jq .
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Test 4: Get User Profile
echo "✓ Test 4: Get User Profile"
curl -s -X GET $API/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Test 5: List Clinics
echo "✓ Test 5: List Clinics"
curl -s -X GET $API/clinics \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "🎉 All tests completed!"
```

### Run the Script
```bash
chmod +x test-backend.sh
./test-backend.sh
```

---

## 🔥 Quick One-Liners

### Get Status of All Services
```bash
curl -s http://localhost:4000/health && echo " ✅ Backend OK"
```

### Test All 8 Route Modules
```bash
TOKEN="your_token_here"
for route in auth users clinics staff bookings payments communications admin; do
  echo "Testing /$route..."
  curl -s -w "\n%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
    http://localhost:4000/api/v1/$route | head -1
done
```

### Check Rate Limits
```bash
curl -w "\n\nRate Limit Info:\nLimit: %header{X-RateLimit-Limit}\nRemaining: %header{X-RateLimit-Remaining}\nReset: %header{X-RateLimit-Reset}\n" \
  -s http://localhost:4000/health
```

---

## 📝 Common Issues & Solutions

### "Cannot GET /health"
- Backend not running
- **Fix**: `npm start` in the backend directory

### "Invalid access token"
- Token expired or malformed
- **Fix**: Get a new token with `auth/login`

### CORS Error in Browser
- Origin not in CORS_ORIGINS
- **Fix**: Check `.env` file has your frontend URL

### Database Connection Error
- DB credentials wrong or DB down
- **Fix**: Check `.env` DB_HOST, DB_USER, DB_PASSWORD

### Rate Limited (429)
- Too many requests in 15 minutes
- **Fix**: Wait for rate limit window to reset

---

## 💡 Pro Tips

### Pretty Print JSON
```bash
curl -s http://localhost:4000/health | jq .
```

### Save Token to Variable (Linux/Mac)
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"TestPassword123"}' \
  | jq -r '.data.accessToken')
echo $TOKEN
```

### Test with Custom Headers
```bash
curl -s http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Custom-Header: value" | jq .
```

### Check Response Headers
```bash
curl -i http://localhost:4000/health
```

### Measure Response Time
```bash
curl -w "@-" -o /dev/null -s http://localhost:4000/health << 'EOF'
    time_namelookup:  %{time_namelookup}
       time_connect:  %{time_connect}
    time_appconnect:  %{time_appconnect}
   time_pretransfer:  %{time_pretransfer}
      time_redirect:  %{time_redirect}
 time_starttransfer:  %{time_starttransfer}
                    ----------
         time_total:  %{time_total}
EOF
```

---

## 🚀 Testing Workflow

1. **Start Backend**: `npm start`
2. **Health Check**: `curl -s http://localhost:4000/health`
3. **Register/Login**: Get access token
4. **Export Token**: `export TOKEN="..."`
5. **Test Endpoints**: Use commands above with `$TOKEN`
6. **Check Logs**: Watch server output for errors
7. **Test Error Cases**: Invalid data, missing auth, etc.

**You're all set! Start testing with:** 
```bash
curl -s http://localhost:4000/health | jq .
```
