#!/bin/bash

##
## Coolify Environment Variables Validation Script (Bash Version)
##
## Usage: ./scripts/validate-coolify-env.sh [path/to/.env.coolify]
##

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Load environment file if provided
if [ -n "$1" ]; then
    if [ -f "$1" ]; then
        echo -e "${BLUE}Reading environment from: $1${NC}\n"
        set -a
        source "$1"
        set +a
    else
        echo -e "${RED}✗ Could not read environment file: $1${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}Reading environment from current shell${NC}\n"
fi

# Track errors
ERRORS=0
WARNINGS=0

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  REQUIRED ENVIRONMENT VARIABLES${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

# Check MONGO_ROOT_PASSWORD
if [ -z "$MONGO_ROOT_PASSWORD" ]; then
    echo -e "${RED}✗ MONGO_ROOT_PASSWORD${NC}"
    echo -e "  ${RED}Missing or empty${NC}"
    echo -e "  Generate with: ${CYAN}openssl rand -base64 32${NC}\n"
    ERRORS=$((ERRORS + 1))
elif [ ${#MONGO_ROOT_PASSWORD} -lt 12 ]; then
    echo -e "${YELLOW}⚠ MONGO_ROOT_PASSWORD${NC}"
    echo -e "  ${YELLOW}Too short (${#MONGO_ROOT_PASSWORD} chars, need 12+)${NC}\n"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ MONGO_ROOT_PASSWORD${NC}"
    echo -e "  Length: ${#MONGO_ROOT_PASSWORD} characters\n"
fi

# Check JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}✗ JWT_SECRET${NC}"
    echo -e "  ${RED}Missing or empty${NC}"
    echo -e "  Generate with: ${CYAN}openssl rand -hex 64${NC}\n"
    ERRORS=$((ERRORS + 1))
elif [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${YELLOW}⚠ JWT_SECRET${NC}"
    echo -e "  ${YELLOW}Too short (${#JWT_SECRET} chars, need 32+)${NC}\n"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ JWT_SECRET${NC}"
    echo -e "  Length: ${#JWT_SECRET} characters\n"
fi

# Check VITE_API_URL
if [ -z "$VITE_API_URL" ]; then
    echo -e "${RED}✗ VITE_API_URL${NC}"
    echo -e "  ${RED}Missing or empty${NC}"
    echo -e "  Example: ${CYAN}https://api.yourdomain.com/api${NC}\n"
    ERRORS=$((ERRORS + 1))
elif [[ ! "$VITE_API_URL" =~ ^https?:// ]]; then
    echo -e "${YELLOW}⚠ VITE_API_URL${NC}"
    echo -e "  ${YELLOW}Must start with http:// or https://${NC}"
    echo -e "  Current: $VITE_API_URL\n"
    WARNINGS=$((WARNINGS + 1))
elif [[ ! "$VITE_API_URL" =~ /api$ ]]; then
    echo -e "${YELLOW}⚠ VITE_API_URL${NC}"
    echo -e "  ${YELLOW}Must end with /api${NC}"
    echo -e "  Current: $VITE_API_URL\n"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ VITE_API_URL${NC}"
    echo -e "  Value: $VITE_API_URL\n"
fi

# Check FRONTEND_URL
if [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}✗ FRONTEND_URL${NC}"
    echo -e "  ${RED}Missing or empty${NC}"
    echo -e "  Example: ${CYAN}https://app.yourdomain.com${NC}\n"
    ERRORS=$((ERRORS + 1))
elif [[ ! "$FRONTEND_URL" =~ ^https?:// ]]; then
    echo -e "${YELLOW}⚠ FRONTEND_URL${NC}"
    echo -e "  ${YELLOW}Must start with http:// or https://${NC}"
    echo -e "  Current: $FRONTEND_URL\n"
    WARNINGS=$((WARNINGS + 1))
elif [[ "$FRONTEND_URL" =~ /$ ]]; then
    echo -e "${YELLOW}⚠ FRONTEND_URL${NC}"
    echo -e "  ${YELLOW}Must not end with trailing slash${NC}"
    echo -e "  Current: $FRONTEND_URL\n"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ FRONTEND_URL${NC}"
    echo -e "  Value: $FRONTEND_URL\n"
fi

# Summary
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  VALIDATION SUMMARY${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}\n"

TOTAL=$((ERRORS + WARNINGS))

if [ $TOTAL -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ All checks passed!${NC}"
    echo -e "${GREEN}  Your environment is ready for Coolify deployment.${NC}\n"
    exit 0
else
    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}✗ $ERRORS required variable(s) missing or invalid${NC}"
    fi
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS variable(s) need attention${NC}"
    fi
    echo -e "\n${RED}${BOLD}✗ Environment is NOT ready for deployment${NC}"
    echo -e "${RED}  Fix the issues above before deploying to Coolify${NC}\n"
    exit 1
fi
