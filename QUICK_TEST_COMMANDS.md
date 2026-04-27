# 🚀 Quick Terminal Commands to Test Backend

## 🎯 FASTEST WAY TO TEST (Copy & Paste)

### Option 1: Run Automated Test Script
```bash
cd backend
npm start                    # In one terminal
```

In another terminal:
```bash
cd ..  # Go to project root
./test-backend.sh           # Run all tests automatically
```

---

### Option 2: Manual Testing (One Command at a Time)

#### Step 1: Start Backend
```bash
cd backend && npm start
```

#### Step 2: Test Health (in new terminal)
```bash
curl http://localhost:4000/health | jq .
```

**Expected:** Green `"status": "ok"` response ✅

#### Step 3: Register & Login
```bash
# Register
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@test.com",
    "password": "TestPassword123"
  }' | jq .

# Login (get token)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"TestPassword123"}' | jq .
```

#### Step 4: Save Token & Use It
```bash
# Copy token from login response, then:
export TOKEN="paste_your_token_here"

# Use token in requests:
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 📋 COPY-PASTE COMMANDS

### Health Check (No Auth)
```bash
curl http://localhost:4000/health | jq .
```

### List Clinics (Requires Auth)
```bash
curl http://localhost:4000/api/v1/clinics \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Get User Profile (Requires Auth)
```bash
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Update Profile (Requires Auth)
```bash
curl -X PUT http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jonathan"}' | jq .
```

### Create Booking
```bash
curl -X POST http://localhost:4000/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId": "550e8400-e29b-41d4-a716-446655440000",
    "therapistId": "550e8400-e29b-41d4-a716-446655440001",
    "serviceId": "550e8400-e29b-41d4-a716-446655440002",
    "appointmentDate": "2026-05-15",
    "startTime": "10:00",
    "endTime": "10:45"
  }' | jq .
```

### Send Message (Chat)
```bash
curl -X POST http://localhost:4000/api/v1/communications/conversations/{CONV_ID}/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Hello!","messageType":"text"}' | jq .
```

---

## ⚡ SUPER QUICK ONE-LINERS

```bash
# Just check if it's running
curl -s http://localhost:4000/health

# Check all endpoints are accessible (use stored token)
for route in users clinics staff bookings payments communications; do
  echo "Testing /$route..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    http://localhost:4000/api/v1/$route | head -1
done

# Watch logs in real-time (if using dev mode)
npm run dev 2>&1 | grep -E "info|error|warn"
```

---

## 📖 HELPFUL SETUP

### Create a Reusable Testing Setup

**File: `.env.test`** (in backend directory)
```bash
# One-time setup - copy and save this for quick reference
export API="http://localhost:4000/api/v1"
export TEST_EMAIL="test$(date +%s)@test.com"
export TEST_PASS="TestPassword123"
```

**Then use in commands:**
```bash
source .env.test

# Register
curl -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"Test",
    "lastName":"User",
    "email":"'$TEST_EMAIL'",
    "password":"'$TEST_PASS'"
  }' | jq .
```

---

## 🔍 DEBUGGING COMMANDS

### Check Backend Logs
```bash
# If backend crashed, check the last error
tail -50 backend/logs/*.log 2>/dev/null || echo "No logs yet"
```

### Check if Backend is Actually Running
```bash
ps aux | grep "node server.js"
lsof -i :4000          # See what's on port 4000
```

### Test Database Connection
```bash
curl -X GET http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" | jq '.error'
```

### Check CORS is Working
```bash
curl -X OPTIONS http://localhost:4000/health \
  -H "Origin: http://localhost:5173" \
  -v 2>&1 | grep "Access-Control"
```

---

## 📚 FILES TO READ

- **Full API Documentation**: `BACKEND_API_DOCUMENTATION.md`
- **Detailed Testing Guide**: `BACKEND_TESTING_GUIDE.md`
- **Backend Code**: `backend/src/`

---

## ✨ TIPS

1. **Always export token for reuse:**
   ```bash
   export TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"TestPassword123"}' \
     | jq -r '.data.accessToken')
   ```

2. **Use `jq` for pretty printing:**
   ```bash
   curl ... | jq .
   ```

3. **Use `jq` to extract specific fields:**
   ```bash
   curl ... | jq '.data.accessToken'  # Get just the token
   ```

4. **Test error handling:**
   ```bash
   # Missing fields
   curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{}'  # Empty body
   
   # Invalid email
   curl -X POST http://localhost:4000/api/v1/auth/login \
     -d '{"email":"bad","password":"bad"}'
   ```

---

## 🎯 START HERE

### In Terminal 1 (Backend):
```bash
cd backend && npm start
```

### In Terminal 2 (Testing):
```bash
./test-backend.sh
```

**That's it!** 🚀 The script will:
- ✅ Check if backend is running
- ✅ Test all major endpoints
- ✅ Show you proper request/response format
- ✅ Give you a working token to use

---

## 💡 COMMON PROBLEMS

| Problem | Solution |
|---------|----------|
| "Cannot GET /health" | Backend not running: `npm start` in backend dir |
| "Invalid token" | Token expired, get new one with login |
| CORS error | Check `CORS_ORIGINS` in `.env` file |
| "Connection refused" | Backend on wrong port or not started |
| jq not found | Install: `brew install jq` (Mac) or `apt-get install jq` (Linux) |

---

**Ready to test? Run:** `./test-backend.sh` ✅
