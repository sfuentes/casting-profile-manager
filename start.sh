#!/bin/bash

echo "====================================="
echo "Casting Profile Manager - Startup"
echo "====================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if MongoDB is running
echo "[1/4] Checking MongoDB..."
if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}[OK]${NC} MongoDB is running"
elif systemctl is-active --quiet mongod; then
    echo -e "${GREEN}[OK]${NC} MongoDB service is running"
else
    echo -e "${YELLOW}[WARNING]${NC} MongoDB is not running!"
    echo ""
    echo "Please start MongoDB first:"
    echo "  Ubuntu/Debian: sudo systemctl start mongod"
    echo "  macOS: brew services start mongodb-community"
    echo "  Or run manually: mongod --dbpath /path/to/data"
    echo ""
    read -p "Press Enter to continue anyway (backend will fail)..."
fi

echo ""
echo "[2/4] Starting Backend Server..."
cd backend && npm run dev &
BACKEND_PID=$!

echo ""
echo "[3/4] Waiting for backend to initialize..."
sleep 3

echo ""
echo "[4/4] Starting Frontend Development Server..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "====================================="
echo "All services started!"
echo "====================================="
echo ""
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait
