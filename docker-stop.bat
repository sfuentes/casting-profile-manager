@echo off
echo =====================================
echo Stopping Docker Containers
echo =====================================
echo.

set MODE=%1
if "%MODE%"=="" set MODE=prod

if "%MODE%"=="dev" (
    echo Stopping development containers...
    docker-compose -f docker-compose.dev.yml down
) else (
    echo Stopping production containers...
    docker-compose down
)

echo.
echo [OK] Containers stopped
echo.

REM Ask if user wants to remove volumes
set /p REMOVE_VOLUMES="Remove database volumes? (y/N): "
if /i "%REMOVE_VOLUMES%"=="y" (
    if "%MODE%"=="dev" (
        docker-compose -f docker-compose.dev.yml down -v
    ) else (
        docker-compose down -v
    )
    echo [OK] Volumes removed
) else (
    echo Database volumes preserved
)

echo.
pause
