# Scripts Directory

Utility scripts for the Casting Profile Manager project.

---

## 📋 Available Scripts

### 1. `validate-coolify-env.js`

**Node.js version of environment validation script**

Validates that all required environment variables are properly set before deploying to Coolify. Performs comprehensive checks including:
- Required variables presence and validity
- Optional variables with defaults
- Platform API key configuration
- Security checks (password strength, HTTPS usage, etc.)

**Usage:**
```bash
# Validate current environment
node scripts/validate-coolify-env.js

# Validate specific .env file
node scripts/validate-coolify-env.js .env.coolify.example

# Or use npm script
npm run validate:coolify
```

**Features:**
- ✅ Colored terminal output
- ✅ Detailed error messages with suggestions
- ✅ Security warnings for weak passwords
- ✅ URL format validation
- ✅ Helpful next steps guide

---

### 2. `validate-coolify-env.sh`

**Bash version of environment validation script**

Simpler bash implementation of the validation script for Unix/Linux environments or CI/CD pipelines.

**Usage:**
```bash
# Make executable (first time only)
chmod +x scripts/validate-coolify-env.sh

# Validate current environment
./scripts/validate-coolify-env.sh

# Validate specific .env file
./scripts/validate-coolify-env.sh .env.coolify.example
```

**Features:**
- ✅ No dependencies (pure bash)
- ✅ Fast execution
- ✅ CI/CD friendly (exit codes)
- ✅ Colored output

---

## 🔧 NPM Script Integration

Add to `package.json`:

```json
{
  "scripts": {
    "validate:coolify": "node scripts/validate-coolify-env.js",
    "validate:coolify:file": "node scripts/validate-coolify-env.js",
    "prevalidate:coolify": "echo 'Validating Coolify environment...'"
  }
}
```

**Then run:**
```bash
npm run validate:coolify
```

---

## 📝 Validation Checklist

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_ROOT_PASSWORD` | MongoDB root password (12+ chars) | `openssl rand -hex 32` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `openssl rand -hex 64` |
| `VITE_API_URL` | Backend API URL (must end with `/api`) | `https://api.yourdomain.com/api` |
| `FRONTEND_URL` | Frontend URL (no trailing slash) | `https://app.yourdomain.com` |

### Optional Variables (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_ROOT_USERNAME` | `admin` | MongoDB root username |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiration |
| `JWT_COOKIE_EXPIRE` | `7` | Cookie expiration in days |
| `MAX_FILE_SIZE` | `10` | Max upload size in MB |
| `RATE_LIMIT_WINDOW_MS` | `600000` | Rate limit window (10 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

---

## 🚨 Exit Codes

The validation scripts use standard exit codes:

- `0` - All checks passed, ready to deploy
- `1` - Validation failed, fix errors before deploying

**Use in CI/CD:**
```bash
# In GitHub Actions, GitLab CI, etc.
./scripts/validate-coolify-env.sh || exit 1
```

---

## 🔍 Example Output

### ✅ Success
```
═══════════════════════════════════════════════════════════
  REQUIRED ENVIRONMENT VARIABLES
═══════════════════════════════════════════════════════════

✓ MONGO_ROOT_PASSWORD
  MongoDB root password
  Value: bXk5Zm9v... (32 chars)

✓ JWT_SECRET
  JWT signing secret
  Value: a3b2c1d4... (64 chars)

✓ VITE_API_URL
  Public backend API URL
  Value: https://api.example.com/api

✓ FRONTEND_URL
  Public frontend URL
  Value: https://app.example.com

═══════════════════════════════════════════════════════════
  VALIDATION SUMMARY
═══════════════════════════════════════════════════════════

✓ All checks passed!
  Your environment is ready for Coolify deployment.
```

### ❌ Failure
```
═══════════════════════════════════════════════════════════
  REQUIRED ENVIRONMENT VARIABLES
═══════════════════════════════════════════════════════════

✗ MONGO_ROOT_PASSWORD
  Missing or empty
  Generate with: openssl rand -hex 32

⚠ JWT_SECRET
  Set but invalid
  Error: Must be at least 32 characters long for security
  Current value: weak-secret...
  Example: openssl rand -hex 64

═══════════════════════════════════════════════════════════
  VALIDATION SUMMARY
═══════════════════════════════════════════════════════════

✗ 1 required variable(s) missing or invalid:
  - MONGO_ROOT_PASSWORD

⚠ 1 variable(s) need attention:
  - JWT_SECRET

✗ Environment is NOT ready for deployment
  Fix the issues above before deploying to Coolify
```

---

## 🛠️ Creating New Scripts

When adding new scripts to this directory:

1. **Make them executable:**
   ```bash
   chmod +x scripts/your-script.sh
   ```

2. **Add shebang line:**
   ```bash
   #!/bin/bash
   # or
   #!/usr/bin/env node
   ```

3. **Document in this README**

4. **Add to package.json scripts** (if relevant)

5. **Use consistent exit codes:**
   - `0` for success
   - `1` for failure
   - `2` for warnings/partial success

---

## 📚 Additional Resources

- [Coolify Deployment Guide](../COOLIFY-DEPLOYMENT.md)
- [Environment Variables Example](../.env.coolify.example)
- [Docker Compose for Coolify](../docker-compose.coolify.yml)

---

## 🤝 Contributing

When adding new validation checks:

1. Add the variable to the appropriate section (required/optional)
2. Implement validation logic
3. Provide clear error messages
4. Include example values
5. Update this README

---

**Last Updated**: 2026-02-23
