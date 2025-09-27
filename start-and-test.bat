@echo off
echo 🚀 Starting Vendplug Ad Management System Test
echo =============================================

echo.
echo 1. Starting the server...
cd backend
start "Vendplug Server" cmd /k "npm start"

echo.
echo 2. Waiting for server to start...
timeout /t 5 /nobreak > nul

echo.
echo 3. Running API tests...
cd ..
powershell -ExecutionPolicy Bypass -File "test-ad-api.ps1"

echo.
echo 4. Opening test page...
start http://localhost:5000/test-ad-system.html

echo.
echo 5. Opening Cloudinary test page...
start http://localhost:5000/test-cloudinary-integration.html

echo.
echo 6. Opening admin dashboard...
start http://localhost:5000/frontend/admin-dashboard.html

echo.
echo ✅ Test setup complete!
echo.
echo The following are now available:
echo - Server: http://localhost:5000
echo - Test Page: http://localhost:5000/test-ad-system.html
echo - Cloudinary Test: http://localhost:5000/test-cloudinary-integration.html
echo - Admin Dashboard: http://localhost:5000/frontend/admin-dashboard.html
echo.
pause
