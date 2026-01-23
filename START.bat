@echo off
echo =====================================
echo Casting Profile Manager - Startup
echo =====================================
echo.

REM Check if MongoDB is running
echo [1/4] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] MongoDB is running
) else (
    echo [WARNING] MongoDB is not running!
    echo.
    echo Please start MongoDB first:
    echo   1. Open a new terminal as Administrator
    echo   2. Run: net start MongoDB
    echo   OR
    echo   3. Start MongoDB manually from installation directory
    echo.
    echo Press any key to continue anyway (backend will fail)...
    pause >nul
)

echo.
echo [2/4] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm run dev"

echo.
echo [3/4] Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Starting Frontend Development Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo =====================================
echo All services started!
echo =====================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window...
echo (The servers will keep running)
pause >nul
