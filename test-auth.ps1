# PowerShell script to test Manufacturing ERP API
# Run: powershell -ExecutionPolicy Bypass -File test-auth.ps1

Write-Host "🧪 Testing Manufacturing ERP Authentication API" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Config
$apiUrl = "http://localhost:5000/api/auth"
$email = "salesmanager@erp.com"
$password = "sales123"

Write-Host "📍 API URL: $apiUrl" -ForegroundColor Cyan
Write-Host "📧 Test User: $email" -ForegroundColor Cyan
Write-Host "🔑 Test Password: $password" -ForegroundColor Cyan
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

# Test Login
Write-Host "🔓 Testing LOGIN endpoint..." -ForegroundColor Yellow
Write-Host ""

$loginPayload = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$apiUrl/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -ErrorAction Stop

    $loginResult = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor White
    Write-Host ($loginResult | ConvertTo-Json -Depth 10) -ForegroundColor Green

    if ($loginResult.success) {
        Write-Host ""
        Write-Host "✅ LOGIN SUCCESSFUL!" -ForegroundColor Green
        Write-Host ""
        
        $token = $loginResult.data.token
        Write-Host "JWT Token:" -ForegroundColor Yellow
        Write-Host $token -ForegroundColor Cyan
        Write-Host ""
        Write-Host "==================================================" -ForegroundColor Green
        Write-Host ""
        
        # Test Get Profile
        Write-Host "👤 Testing GET PROFILE endpoint..." -ForegroundColor Yellow
        Write-Host ""
        
        $profileResponse = Invoke-WebRequest -Uri "$apiUrl/profile" `
            -Method GET `
            -Headers @{Authorization = "Bearer $token"} `
            -ErrorAction Stop

        $profileResult = $profileResponse.Content | ConvertFrom-Json
        Write-Host "Response:" -ForegroundColor White
        Write-Host ($profileResult | ConvertTo-Json -Depth 10) -ForegroundColor Green
        
        if ($profileResult.success) {
            Write-Host ""
            Write-Host "✅ GET PROFILE SUCCESSFUL!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ GET PROFILE FAILED!" -ForegroundColor Red
        }
    } else {
        Write-Host ""
        Write-Host "❌ LOGIN FAILED!" -ForegroundColor Red
        Write-Host "Error: $($loginResult.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Is the server running? (npm start)" -ForegroundColor White
    Write-Host "2. Is the database connected?" -ForegroundColor White
    Write-Host "3. Are the credentials correct?" -ForegroundColor White
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
