#!/usr/bin/env node

/**
 * Coolify Environment Variables Validation Script
 *
 * This script validates that all required environment variables are set
 * before deploying to Coolify. It checks for common mistakes and provides
 * helpful error messages.
 *
 * Usage:
 *   node scripts/validate-coolify-env.js
 *
 * Or with environment variables file:
 *   node scripts/validate-coolify-env.js path/to/.env.coolify
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Required environment variables
const REQUIRED_VARS = [
  {
    name: 'MONGO_ROOT_PASSWORD',
    description: 'MongoDB root password',
    example: 'openssl rand -base64 32',
    critical: true,
    validate: (value) => value && value.length >= 12,
    errorMessage: 'Must be at least 12 characters long',
  },
  {
    name: 'JWT_SECRET',
    description: 'JWT signing secret',
    example: 'openssl rand -hex 64',
    critical: true,
    validate: (value) => value && value.length >= 32,
    errorMessage: 'Must be at least 32 characters long for security',
  },
  {
    name: 'VITE_API_URL',
    description: 'Public backend API URL (baked into frontend build)',
    example: 'https://api.yourdomain.com/api',
    critical: true,
    validate: (value) => {
      if (!value) return false;
      if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
      if (!value.endsWith('/api')) return false;
      return true;
    },
    errorMessage: 'Must be a full URL starting with https:// and ending with /api',
  },
  {
    name: 'FRONTEND_URL',
    description: 'Public frontend URL (for CORS configuration)',
    example: 'https://app.yourdomain.com',
    critical: true,
    validate: (value) => {
      if (!value) return false;
      if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
      if (value.endsWith('/')) return false; // No trailing slash
      return true;
    },
    errorMessage: 'Must be a full URL starting with https:// without trailing slash',
  },
];

// Optional but recommended variables
const OPTIONAL_VARS = [
  {
    name: 'MONGO_ROOT_USERNAME',
    description: 'MongoDB root username',
    default: 'admin',
  },
  {
    name: 'JWT_EXPIRES_IN',
    description: 'JWT token expiration time',
    default: '7d',
  },
  {
    name: 'JWT_COOKIE_EXPIRE',
    description: 'JWT cookie expiration in days',
    default: '7',
  },
  {
    name: 'MAX_FILE_SIZE',
    description: 'Maximum file upload size in MB',
    default: '10',
  },
  {
    name: 'RATE_LIMIT_WINDOW_MS',
    description: 'Rate limiting window in milliseconds',
    default: '600000',
  },
  {
    name: 'RATE_LIMIT_MAX',
    description: 'Maximum requests per rate limit window',
    default: '100',
  },
];

// Platform API keys (optional)
const PLATFORM_VARS = [
  'FILMMAKERS_CLIENT_ID',
  'FILMMAKERS_CLIENT_SECRET',
  'CASTING_NETWORK_API_KEY',
  'SCHAUSPIELERVIDEOS_API_KEY',
  'ETALENTA_API_KEY',
  'JOBWORK_CLIENT_ID',
  'JOBWORK_CLIENT_SECRET',
  'WANTED_CLIENT_ID',
  'WANTED_CLIENT_SECRET',
];

/**
 * Parse .env file
 */
function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};

    content.split('\n').forEach((line) => {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;

      // Parse KEY=VALUE
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    return null;
  }
}

/**
 * Load environment variables from file or process.env
 */
function loadEnvironment() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const envFile = args[0];
    console.log(`${colors.blue}Reading environment from: ${envFile}${colors.reset}\n`);
    const env = parseEnvFile(envFile);

    if (!env) {
      console.log(`${colors.red}✗ Could not read environment file: ${envFile}${colors.reset}`);
      console.log(`${colors.yellow}  Make sure the file exists and is readable${colors.reset}\n`);
      return null;
    }

    return env;
  }

  console.log(`${colors.blue}Reading environment from process.env${colors.reset}\n`);
  return process.env;
}

/**
 * Validate required variables
 */
function validateRequired(env) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  REQUIRED ENVIRONMENT VARIABLES${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  let hasErrors = false;
  const errors = [];
  const warnings = [];

  REQUIRED_VARS.forEach((varDef) => {
    const value = env[varDef.name];
    const isSet = value && value.length > 0;
    const isValid = isSet && varDef.validate(value);

    if (!isSet) {
      console.log(`${colors.red}✗ ${varDef.name}${colors.reset}`);
      console.log(`  ${colors.red}Missing or empty${colors.reset}`);
      console.log(`  Description: ${varDef.description}`);
      console.log(`  Generate with: ${colors.cyan}${varDef.example}${colors.reset}\n`);
      errors.push(varDef.name);
      hasErrors = true;
    } else if (!isValid) {
      console.log(`${colors.yellow}⚠ ${varDef.name}${colors.reset}`);
      console.log(`  ${colors.yellow}Set but invalid${colors.reset}`);
      console.log(`  Error: ${varDef.errorMessage}`);
      console.log(`  Current value: ${value.substring(0, 50)}...`);
      console.log(`  Example: ${colors.cyan}${varDef.example}${colors.reset}\n`);
      warnings.push(varDef.name);
      hasErrors = true;
    } else {
      console.log(`${colors.green}✓ ${varDef.name}${colors.reset}`);
      console.log(`  ${varDef.description}`);

      // Show partial value for verification (hide sensitive parts)
      if (varDef.name.includes('PASSWORD') || varDef.name.includes('SECRET')) {
        console.log(`  Value: ${value.substring(0, 8)}... (${value.length} chars)\n`);
      } else {
        console.log(`  Value: ${value}\n`);
      }
    }
  });

  return { hasErrors, errors, warnings };
}

/**
 * Check optional variables
 */
function checkOptional(env) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  OPTIONAL ENVIRONMENT VARIABLES${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  OPTIONAL_VARS.forEach((varDef) => {
    const value = env[varDef.name];
    const isSet = value && value.length > 0;

    if (isSet) {
      console.log(`${colors.green}✓ ${varDef.name}${colors.reset}`);
      console.log(`  ${varDef.description}`);
      console.log(`  Value: ${value}\n`);
    } else {
      console.log(`${colors.blue}○ ${varDef.name}${colors.reset}`);
      console.log(`  ${varDef.description}`);
      console.log(`  Default: ${colors.cyan}${varDef.default}${colors.reset}\n`);
    }
  });
}

/**
 * Check platform API keys
 */
function checkPlatforms(env) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  PLATFORM API KEYS (Optional)${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  let configuredCount = 0;

  PLATFORM_VARS.forEach((varName) => {
    const value = env[varName];
    const isSet = value && value.length > 0 && !value.includes('your-');

    if (isSet) {
      console.log(`${colors.green}✓ ${varName}${colors.reset}`);
      console.log(`  Value: ${value.substring(0, 12)}... (configured)\n`);
      configuredCount++;
    } else {
      console.log(`${colors.blue}○ ${varName}${colors.reset} (not configured)`);
    }
  });

  if (configuredCount === 0) {
    console.log(`\n${colors.yellow}Note: No platform API keys configured. Platform sync features will not work.${colors.reset}`);
    console.log(`${colors.yellow}      Add keys later when you need to sync with specific platforms.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.green}${configuredCount} platform(s) configured.${colors.reset}\n`);
  }
}

/**
 * Run security checks
 */
function runSecurityChecks(env) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  SECURITY CHECKS${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  const securityIssues = [];

  // Check JWT_SECRET strength
  const jwtSecret = env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.includes('your-') || jwtSecret.includes('change-me') || jwtSecret.includes('example')) {
      securityIssues.push('JWT_SECRET contains placeholder text - generate a new secure secret');
    }
    if (jwtSecret.length < 64) {
      securityIssues.push('JWT_SECRET should be at least 64 characters for production');
    }
  }

  // Check MONGO_ROOT_PASSWORD strength
  const mongoPassword = env.MONGO_ROOT_PASSWORD;
  if (mongoPassword) {
    if (mongoPassword.includes('password') || mongoPassword.includes('admin')) {
      securityIssues.push('MONGO_ROOT_PASSWORD contains common words - use a random string');
    }
    if (mongoPassword.length < 20) {
      securityIssues.push('MONGO_ROOT_PASSWORD should be at least 20 characters for production');
    }
  }

  // Check if URLs use HTTPS (production requirement)
  const frontendUrl = env.FRONTEND_URL;
  const apiUrl = env.VITE_API_URL;

  if (frontendUrl && frontendUrl.startsWith('http://') && !frontendUrl.includes('localhost')) {
    securityIssues.push('FRONTEND_URL uses HTTP instead of HTTPS for production domain');
  }

  if (apiUrl && apiUrl.startsWith('http://') && !apiUrl.includes('localhost')) {
    securityIssues.push('VITE_API_URL uses HTTP instead of HTTPS for production domain');
  }

  // Display results
  if (securityIssues.length === 0) {
    console.log(`${colors.green}✓ All security checks passed${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Security warnings:${colors.reset}\n`);
    securityIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${colors.yellow}${issue}${colors.reset}`);
    });
    console.log();
  }

  return securityIssues;
}

/**
 * Print summary
 */
function printSummary(errors, warnings, securityIssues) {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  VALIDATION SUMMARY${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  const totalIssues = errors.length + warnings.length;

  if (totalIssues === 0 && securityIssues.length === 0) {
    console.log(`${colors.green}${colors.bright}✓ All checks passed!${colors.reset}`);
    console.log(`${colors.green}  Your environment is ready for Coolify deployment.${colors.reset}\n`);
    return true;
  }

  if (errors.length > 0) {
    console.log(`${colors.red}✗ ${errors.length} required variable(s) missing or invalid:${colors.reset}`);
    errors.forEach((varName) => {
      console.log(`  - ${varName}`);
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`${colors.yellow}⚠ ${warnings.length} variable(s) need attention:${colors.reset}`);
    warnings.forEach((varName) => {
      console.log(`  - ${varName}`);
    });
    console.log();
  }

  if (securityIssues.length > 0) {
    console.log(`${colors.yellow}⚠ ${securityIssues.length} security warning(s)${colors.reset}`);
    console.log(`${colors.yellow}  Review the security checks section above${colors.reset}\n`);
  }

  console.log(`${colors.red}${colors.bright}✗ Environment is NOT ready for deployment${colors.reset}`);
  console.log(`${colors.red}  Fix the issues above before deploying to Coolify${colors.reset}\n`);

  return false;
}

/**
 * Print helpful next steps
 */
function printNextSteps() {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  NEXT STEPS${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`1. ${colors.bright}Generate secure secrets:${colors.reset}`);
  console.log(`   ${colors.cyan}openssl rand -hex 64${colors.reset}  # For JWT_SECRET`);
  console.log(`   ${colors.cyan}openssl rand -base64 32${colors.reset}  # For MONGO_ROOT_PASSWORD\n`);

  console.log(`2. ${colors.bright}Set environment variables in Coolify:${colors.reset}`);
  console.log(`   - Go to your Coolify resource`);
  console.log(`   - Navigate to "Environment Variables"`);
  console.log(`   - Add all required variables\n`);

  console.log(`3. ${colors.bright}Configure domains:${colors.reset}`);
  console.log(`   - Frontend: app.yourdomain.com`);
  console.log(`   - Backend: api.yourdomain.com\n`);

  console.log(`4. ${colors.bright}Deploy:${colors.reset}`);
  console.log(`   - Click "Deploy" in Coolify`);
  console.log(`   - Monitor build logs for errors\n`);

  console.log(`5. ${colors.bright}Verify deployment:${colors.reset}`);
  console.log(`   ${colors.cyan}curl https://api.yourdomain.com/health${colors.reset}\n`);

  console.log(`${colors.bright}For detailed instructions, see:${colors.reset} ${colors.cyan}COOLIFY-DEPLOYMENT.md${colors.reset}\n`);
}

/**
 * Main function
 */
function main() {
  console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║   Coolify Environment Variables Validation               ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Load environment
  const env = loadEnvironment();
  if (!env) {
    process.exit(1);
  }

  // Run validations
  const { hasErrors, errors, warnings } = validateRequired(env);
  checkOptional(env);
  checkPlatforms(env);
  const securityIssues = runSecurityChecks(env);

  // Print summary
  const isReady = printSummary(errors, warnings, securityIssues);

  // Print next steps if not ready
  if (!isReady) {
    printNextSteps();
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
main();
