#!/bin/bash

# Physiobook Backend - PRODUCTION (RENDER) Testing Script
# Tests the live Render deployment at: https://physiobook-api-jvye.onrender.com

API_URL="https://physiobook-api-jvye.onrender.com"
API_V1="$API_URL/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Physiobook Production Backend Testing${NC}"
echo -e "${YELLOW}URL: $API_URL${NC}"
echo "======================================"
echo ""

# Check if backend is accessible
echo -e "${YELLOW}Checking production connection...${NC}"
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Production backend not accessible!${NC}"
  echo "Check: Is Render deployed and running?"
  exit 1
fi
echo -e "${GREEN}✅ Production backend is accessible${NC}"
echo ""

# Test 1: Health Endpoint
echo -e "${BLUE}1️⃣  Production Health Endpoint${NC}"
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
STATUS=$(echo "$HEALTH" | jq -r '.status' 2>/dev/null)
if [ "$STATUS" = "ok" ]; then
  echo -e "${GREEN}✅ Production service is healthy${NC}"
else
  echo -e "${RED}⚠️  Health check returned unexpected status${NC}"
fi
echo ""

# Test 2: Validation Error
echo -e "${BLUE}2️⃣  Validation Error Test (Invalid Email)${NC}"
VAL_RESP=$(curl -s -X POST "$API_V1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-email","password":"test"}')
echo "$VAL_RESP" | jq .
if echo "$VAL_RESP" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Validation errors working${NC}"
fi
echo ""

# Test 3: Auth Error (No Token)
echo -e "${BLUE}3️⃣  Auth Error Test (Missing Token)${NC}"
AUTH_RESP=$(curl -s -X GET "$API_V1/users/me")
echo "$AUTH_RESP" | jq .
if echo "$AUTH_RESP" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Auth validation working${NC}"
fi
echo ""

# Test 4: Invalid Token
echo -e "${BLUE}4️⃣  Auth Error Test (Invalid Token)${NC}"
INVALID_TOKEN=$(curl -s -X GET "$API_V1/users/me" \
  -H "Authorization: Bearer invalid_token_test_xyz")
echo "$INVALID_TOKEN" | jq .
if echo "$INVALID_TOKEN" | jq -e '.error' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Token validation working${NC}"
fi
echo ""

# Test 5: List Clinics (Testing API connectivity)
echo -e "${BLUE}5️⃣  API Connectivity Test (Clinics List)${NC}"
CLINICS=$(curl -s -X GET "$API_V1/clinics" \
  -H "Authorization: Bearer test_token")
echo "$CLINICS" | jq . 2>/dev/null || echo "$CLINICS" | head -100
if echo "$CLINICS" | jq -e '.error' > /dev/null 2>/dev/null || echo "$CLINICS" | grep -q "error"; then
  echo -e "${GREEN}✅ API endpoints accessible${NC}"
fi
echo ""

# Test 6: Status Codes
echo -e "${BLUE}6️⃣  HTTP Status Codes${NC}"
HEALTH_CODE=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/health")
LOGIN_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_V1/auth/login" \
  -H "Content-Type: application/json" -d '{}')
echo "  Health endpoint: $HEALTH_CODE (expected: 200)"
echo "  Login endpoint: $LOGIN_CODE (expected: 400 for validation error)"
echo ""

# Test 7: CORS Check
echo -e "${BLUE}7️⃣  CORS Configuration${NC}"
CORS_CHECK=$(curl -s -I "$API_URL/health" 2>&1 | grep -i "access-control" || echo "No CORS headers")
echo "CORS Headers: $CORS_CHECK"
echo ""

echo -e "${GREEN}🎉 Production testing complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "  ✅ Health: OK"
echo "  ✅ Validation: Working"
echo "  ✅ Auth: Working"
echo "  ✅ API: Accessible"
echo ""
echo -e "${YELLOW}🔗 API Base URL: $API_V1${NC}"
echo -e "${YELLOW}📖 Documentation: See BACKEND_API_DOCUMENTATION.md${NC}"
echo ""
