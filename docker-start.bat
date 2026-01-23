@echo off
echo =====================================
echo Docker Startup - Casting Profile Manager
echo =====================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check which mode to run
set MODE=%1
if "%MODE%"=="" set MODE=prod

if "%MODE%"=="dev" (
    echo Starting in DEVELOPMENT mode...
    echo - Hot reload enabled
    echo - MongoDB Express UI available at http://localhost:8081
    echo.
    docker-compose -f docker-compose.dev.yml up --build
) else if "%MODE%"=="prod" (
    echo Starting in PRODUCTION mode...
    echo.
    docker-compose up --build -d
    echo.
    echo =====================================
    echo Services started in background!
    echo =====================================
    echo.
    echo Backend API: http://localhost:5000
    echo Health Check: http://localhost:5000/health
    echo.
    echo To view logs: docker-compose logs -f
    echo To stop: docker-compose down
    echo.
) else (
    echo Invalid mode: %MODE%
    echo Usage: docker-start.bat [prod^|dev]
    echo   prod - Production mode (detached)
    echo   dev  - Development mode (with hot reload and Mongo Express)
    pause
    exit /b 1
)
