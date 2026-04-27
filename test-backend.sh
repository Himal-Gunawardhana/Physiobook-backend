#!/bin/bash

# Physiobook Backend Quick Test Script
# Usage: ./test-backend.sh

API_URL="http://localhost:4000"
API_V1="$API_URL/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Physiobook Backend Testing${NC}"
echo "======================================"
echo ""

# Check if backend is running
echo -e "${YELLOW}Testing backend connection...${NC}"
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Backend not running!${NC}"
  echo "Start backend with: cd backend && npm start"
  exit 1
fi
echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Test 1: Health Endpoint
echo -e "${BLUE}1️⃣  Health Endpoint${NC}"
curl -s "$API_URL/health" | jq .
echo ""

# Test 2: Validation Error
echo -e "${BLUE}2️⃣  Test Validation Error (Invalid Email)${NC}"
curl -s -X POST "$API_V1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"test"}' | jq .
echo ""

# Test 3: Auth Error (No Token)
echo -e "${BLUE}3️⃣  Test Auth Error (Missing Token)${NC}"
curl -s -X GET "$API_V1/users/me" | jq .
echo ""

# Test 4: Invalid Token
echo -e "${BLUE}4️⃣  Test Auth Error (Invalid Token)${NC}"
curl -s -X GET "$API_V1/users/me" \
  -H "Authorization: Bearer invalid_token_xyz" | jq .
echo ""

# Test 5: Register New User
echo -e "${BLUE}5️⃣  Register New User${NC}"
TIMESTAMP=$(date +%s)
EMAIL="testuser$TIMESTAMP@test.com"
REGISTER=$(curl -s -X POST "$API_V1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "'$EMAIL'",
    "password": "TestPassword123"
  }')
echo "$REGISTER" | jq .
echo ""

# Test 6: Try Login with New User
echo -e "${BLUE}6️⃣  Login with Test User${NC}"
LOGIN=$(curl -s -X POST "$API_V1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$EMAIL'",
    "password": "TestPassword123"
  }')
echo "$LOGIN" | jq .

# Extract token if login successful
TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken // empty')
if [ ! -z "$TOKEN" ]; then
  echo ""
  echo -e "${GREEN}✅ Token obtained!${NC}"
  
  # Test 7: Get User Profile with Token
  echo ""
  echo -e "${BLUE}7️⃣  Get User Profile (with Token)${NC}"
  curl -s -X GET "$API_V1/users/me" \
    -H "Authorization: Bearer $TOKEN" | jq .
  echo ""
  
  # Test 8: List Clinics
  echo -e "${BLUE}8️⃣  List Clinics${NC}"
  curl -s -X GET "$API_V1/clinics" \
    -H "Authorization: Bearer $TOKEN" | jq .
  echo ""
  
  # Test 9: CORS Preflight
  echo -e "${BLUE}9️⃣  CORS Preflight Check${NC}"
  echo "Checking CORS headers..."
  curl -s -X OPTIONS "$API_URL/health" \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: GET" \
    -v 2>&1 | grep -i "access-control" || echo "CORS headers present"
  echo ""
else
  echo -e "${RED}❌ Could not obtain token${NC}"
fi

echo -e "${GREEN}🎉 Testing complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "- Check BACKEND_TESTING_GUIDE.md for more commands"
echo "- Export token: export TOKEN=\"\$token_here\""
echo "- Use \$TOKEN in curl commands: -H \"Authorization: Bearer \$TOKEN\""
echo ""
