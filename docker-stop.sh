#!/bin/bash

echo "====================================="
echo "Stopping Docker Containers"
echo "====================================="
echo ""

# Get mode from argument (default to prod)
MODE=${1:-prod}

if [ "$MODE" = "dev" ]; then
    echo "Stopping development containers..."
    docker-compose -f docker-compose.dev.yml down
else
    echo "Stopping production containers..."
    docker-compose down
fi

echo ""
echo "[OK] Containers stopped"
echo ""

# Ask if user wants to remove volumes
read -p "Remove database volumes? (y/N): " REMOVE_VOLUMES
if [[ "$REMOVE_VOLUMES" =~ ^[Yy]$ ]]; then
    if [ "$MODE" = "dev" ]; then
        docker-compose -f docker-compose.dev.yml down -v
    else
        docker-compose down -v
    fi
    echo "[OK] Volumes removed"
else
    echo "Database volumes preserved"
fi

echo ""
