#!/bin/bash
# Quick test script for Manufacturing ERP API

echo "🧪 Testing Manufacturing ERP Authentication API"
echo "=================================================="
echo ""

# Config
API_URL="http://localhost:5000/api/auth"
EMAIL="salesmanager@erp.com"
PASSWORD="sales123"

echo "📍 API URL: $API_URL"
echo "📧 Test User: $EMAIL"
echo "🔑 Test Password: $PASSWORD"
echo ""
echo "=================================================="
echo ""

# Test Login
echo "🔓 Testing LOGIN endpoint..."
echo ""

RESPONSE=$(curl -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  --silent \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Response:"
echo "$RESPONSE" | jq '.'

# Extract token from response
TOKEN=$(echo "$RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
    echo ""
    echo "✅ LOGIN SUCCESSFUL!"
    echo ""
    echo "JWT Token:"
    echo "$TOKEN"
    echo ""
    echo "=================================================="
    echo ""
    
    # Test Get Profile
    echo "👤 Testing GET PROFILE endpoint..."
    echo ""
    
    PROFILE=$(curl -X GET "$API_URL/profile" \
      -H "Authorization: Bearer $TOKEN" \
      --silent)
    
    echo "Response:"
    echo "$PROFILE" | jq '.'
    
    if echo "$PROFILE" | jq -e '.success' > /dev/null; then
        echo ""
        echo "✅ GET PROFILE SUCCESSFUL!"
    else
        echo ""
        echo "❌ GET PROFILE FAILED!"
    fi
else
    echo ""
    echo "❌ LOGIN FAILED!"
    echo "Check that:"
    echo "1. Server is running (npm start)"
    echo "2. Database is connected"
    echo "3. Credentials are correct"
fi

echo ""
echo "=================================================="
