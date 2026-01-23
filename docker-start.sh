#!/bin/bash

echo "====================================="
echo "Docker Startup - Casting Profile Manager"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker is not running!"
    echo "Please start Docker first."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Docker is running"
echo ""

# Get mode from argument (default to prod)
MODE=${1:-prod}

if [ "$MODE" = "dev" ]; then
    echo "Starting in DEVELOPMENT mode..."
    echo "- Hot reload enabled"
    echo "- MongoDB Express UI available at http://localhost:8081"
    echo ""
    docker-compose -f docker-compose.dev.yml up --build
elif [ "$MODE" = "prod" ]; then
    echo "Starting in PRODUCTION mode..."
    echo ""
    docker-compose up --build -d
    echo ""
    echo "====================================="
    echo "Services started in background!"
    echo "====================================="
    echo ""
    echo "Backend API: http://localhost:5000"
    echo "Health Check: http://localhost:5000/health"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop: docker-compose down"
    echo ""
else
    echo "Invalid mode: $MODE"
    echo "Usage: ./docker-start.sh [prod|dev]"
    echo "  prod - Production mode (detached)"
    echo "  dev  - Development mode (with hot reload and Mongo Express)"
    exit 1
fi
