@echo off
echo =====================================
echo Fix Missing Platforms
echo =====================================
echo.
echo This will add the default 9 platforms to any users
echo who don't have them yet.
echo.
echo Press any key to continue...
pause >nul

echo.
echo Running migration...
docker-compose exec backend npm run add-platforms

echo.
echo =====================================
echo Done!
echo =====================================
echo.
echo Users should now:
echo 1. Logout from the app
echo 2. Login again
echo 3. Check the Plattformen section
echo.
pause
