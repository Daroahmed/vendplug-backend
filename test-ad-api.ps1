# Ad Management System API Test Script
# Run this script to test the ad management API endpoints

Write-Host "🧪 Testing Ad Management System API" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

$baseUrl = "http://localhost:5000/api"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer test-admin-token"
}

# Test 1: Check server connection
Write-Host "`n1. Testing server connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/ads" -Method GET -Headers $headers
    Write-Host "✅ Server is running! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Server connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure the server is running with: npm start" -ForegroundColor Yellow
    exit 1
}

# Test 2: Upload test image
Write-Host "`n2. Uploading test image..." -ForegroundColor Yellow
try {
    # Create a simple test image using PowerShell
    $imagePath = "test-ad-image.png"
    
    # Create a simple 800x300 PNG image with text
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap(800, 300)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(0, 204, 153))
    
    $font = New-Object System.Drawing.Font("Arial", 36, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawString("Welcome to Vendplug!", $font, $brush, 100, 100)
    
    $bitmap.Save($imagePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    
    # Upload image
    $imageResponse = Invoke-WebRequest -Uri "$baseUrl/admin-ads/upload-image" -Method POST -Headers $headers -InFile $imagePath
    $imageResult = $imageResponse.Content | ConvertFrom-Json
    
    if ($imageResult.success) {
        Write-Host "✅ Image uploaded successfully! URL: $($imageResult.image.url)" -ForegroundColor Green
        $imageUrl = $imageResult.image.url
    } else {
        Write-Host "❌ Failed to upload image: $($imageResult.message)" -ForegroundColor Red
        $imageUrl = "https://via.placeholder.com/800x300/00cc99/ffffff?text=Welcome+to+Vendplug"
    }
    
    # Clean up test image
    Remove-Item $imagePath -ErrorAction SilentlyContinue
} catch {
    Write-Host "❌ Image upload failed: $($_.Exception.Message)" -ForegroundColor Red
    $imageUrl = "https://via.placeholder.com/800x300/00cc99/ffffff?text=Welcome+to+Vendplug"
}

# Test 3: Create a test ad
Write-Host "`n3. Creating test ad..." -ForegroundColor Yellow
$adData = @{
    title = "🎉 Welcome to Vendplug!"
    type = "banner"
    status = "active"
    priority = "high"
    description = "Discover amazing products from trusted vendors and agents"
    imageUrl = $imageUrl
    clickUrl = "https://vendplug.com"
    targetPages = @("buyer-home", "vendor-shop", "agent-shop")
    targetUsers = @("buyer", "vendor", "agent")
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/ads" -Method POST -Headers $headers -Body $adData
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Ad created successfully! ID: $($result.ad._id)" -ForegroundColor Green
    $adId = $result.ad._id
} catch {
    Write-Host "❌ Failed to create ad: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorContent = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorContent)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

# Test 3: Create a test campaign
Write-Host "`n3. Creating test campaign..." -ForegroundColor Yellow
$campaignData = @{
    name = "Welcome Campaign"
    status = "active"
    priority = "high"
    targetAudience = "all"
    title = "Welcome to Vendplug!"
    message = "Thank you for joining Vendplug! Start exploring amazing products from our trusted vendors and agents."
    data = @{
        action = "view_products"
        url = "/products"
    }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/campaigns" -Method POST -Headers $headers -Body $campaignData
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Campaign created successfully! ID: $($result.campaign._id)" -ForegroundColor Green
    $campaignId = $result.campaign._id
} catch {
    Write-Host "❌ Failed to create campaign: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorContent = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorContent)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

# Test 4: List all ads
Write-Host "`n4. Listing all ads..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/ads" -Method GET -Headers $headers
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Found $($result.ads.Count) ads" -ForegroundColor Green
    foreach ($ad in $result.ads) {
        Write-Host "  - $($ad.title) ($($ad.type)) - Status: $($ad.status)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Failed to list ads: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: List all campaigns
Write-Host "`n5. Listing all campaigns..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/campaigns" -Method GET -Headers $headers
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Found $($result.campaigns.Count) campaigns" -ForegroundColor Green
    foreach ($campaign in $result.campaigns) {
        Write-Host "  - $($campaign.name) - Status: $($campaign.status)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Failed to list campaigns: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Test public ad endpoint
Write-Host "`n6. Testing public ad endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/public/ads?userType=buyer&page=buyer-home" -Method GET
    $result = $response.Content | ConvertFrom-Json
    Write-Host "✅ Public endpoint returned $($result.data.Count) ads" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to access public endpoint: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Test ad click tracking
if ($adId) {
    Write-Host "`n7. Testing ad click tracking..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/admin-ads/public/ads/$adId/click" -Method POST
        Write-Host "✅ Ad click tracked successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to track ad click: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 API Testing Complete!" -ForegroundColor Green
Write-Host "You can now open the admin dashboard at: http://localhost:5000/frontend/admin-dashboard.html" -ForegroundColor Cyan
Write-Host "Or open the test page at: http://localhost:5000/test-ad-system.html" -ForegroundColor Cyan
