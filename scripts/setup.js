#!/usr/bin/env node

/**
 * workshopsAI CMS Setup Script
 *
 * This script sets up the development environment for the workshopsAI CMS project.
 * It validates environment configuration, creates necessary directories,
 * and performs initial setup tasks.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging utilities
const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.blue}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}=== ${msg} ===${colors.reset}\n`)
};

// Required directories for the project
const REQUIRED_DIRECTORIES = [
  'logs',
  'uploads',
  'backups',
  'temp',
  'coverage',
  'test-results',
  'playwright-report',
  'migrations'
];

// Required environment variables (basic validation)
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_NAME',
  'JWT_SECRET'
];

// Optional but recommended environment variables
const OPTIONAL_ENV_VARS = [
  'REDIS_HOST',
  'REDIS_PORT',
  'OPENAI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY'
];

/**
 * Validates Node.js and npm versions
 */
function validateNodeVersion() {
  log.header('Validating Node.js Environment');

  const nodeVersion = process.version;
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();

  log.info(`Node.js version: ${nodeVersion}`);
  log.info(`npm version: ${npmVersion}`);

  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  const npmMajor = parseInt(npmVersion.split('.')[0]);

  if (nodeMajor < 20) {
    log.error(`Node.js version ${nodeVersion} is too old. Required: >= 20.0.0`);
    process.exit(1);
  }

  if (npmMajor < 8) {
    log.error(`npm version ${npmVersion} is too old. Required: >= 8.0.0`);
    process.exit(1);
  }

  log.success('Node.js and npm versions are compatible');
}

/**
 * Creates necessary directories if they don't exist
 */
function createDirectories() {
  log.header('Creating Required Directories');

  REQUIRED_DIRECTORIES.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log.success(`Created directory: ${dir}`);
    } else {
      log.info(`Directory already exists: ${dir}`);
    }
  });
}

/**
 * Validates environment configuration
 */
function validateEnvironment() {
  log.header('Validating Environment Configuration');

  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      log.warning('.env file not found. You may want to copy .env.example to .env');
      log.step(`Run: cp .env.example .env`);
    } else {
      log.warning('.env.example file not found');
    }
  } else {
    log.success('.env file found');
  }

  // Load and validate environment variables
  require('dotenv').config();

  let missingVars = [];
  let optionalVars = [];

  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  OPTIONAL_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      optionalVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    log.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    log.warning('Please set these variables in your .env file');
    return false;
  }

  if (optionalVars.length > 0) {
    log.warning(`Optional environment variables not set: ${optionalVars.join(', ')}`);
    log.info('These are optional but may limit functionality');
  }

  log.success('Environment variables validation passed');
  return true;
}

/**
 * Validates database connection (basic check)
 */
function validateDatabase() {
  log.header('Validating Database Configuration');

  try {
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeoutMS: 5000,
    });

    client.connect();
    client.query('SELECT NOW()');
    client.end();

    log.success('Database connection successful');
    return true;
  } catch (error) {
    log.warning(`Database connection failed: ${error.message}`);
    log.info('Please ensure PostgreSQL is running and configured correctly');
    return false;
  }
}

/**
 * Runs basic validation commands
 */
function runValidationCommands() {
  log.header('Running Validation Commands');

  const commands = [
    { cmd: 'npm run typecheck', name: 'TypeScript type checking' },
    { cmd: 'npm run lint', name: 'ESLint validation' }
  ];

  commands.forEach(({ cmd, name }) => {
    try {
      log.step(`Running ${name}...`);
      execSync(cmd, { stdio: 'pipe', cwd: process.cwd() });
      log.success(`${name} passed`);
    } catch (error) {
      log.warning(`${name} failed: ${error.message}`);
      log.info('You can run this manually later with: ' + cmd);
    }
  });
}

/**
 * Creates basic .gitignore entries if needed
 */
function setupGitIgnore() {
  log.header('Setting Up .gitignore');

  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  const requiredEntries = [
    '# Dependencies',
    'node_modules/',
    '',
    '# Build outputs',
    'dist/',
    'dist-secure/',
    'build/',
    '',
    '# Environment files',
    '.env.local',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    '',
    '# Logs',
    'logs/',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '',
    '# Coverage reports',
    'coverage/',
    '.coverage/',
    '.nyc_output/',
    '',
    '# Test results',
    'test-results/',
    'playwright-report/',
    'test-results.xml',
    '',
    '# Runtime data',
    'pids/',
    '*.pid',
    '*.seed',
    '*.pid.lock',
    '',
    '# Uploads and temp files',
    'uploads/',
    'temp/',
    '*.tmp',
    '',
    '# Cache',
    '.eslintcache',
    '.jest-cache/',
    '.tsbuildinfo',
    '',
    '# IDE',
    '.vscode/',
    '.idea/',
    '*.swp',
    '*.swo',
    '',
    '# OS',
    '.DS_Store',
    'Thumbs.db',
    '',
    '# Database',
    '*.sqlite',
    '*.sqlite3',
    '',
    # Security
    '*.pem',
    '*.key',
    'secrets/',
    ''
  ];

  let missingEntries = [];
  requiredEntries.forEach(entry => {
    if (!gitignoreContent.includes(entry.trim())) {
      missingEntries.push(entry);
    }
  });

  if (missingEntries.length > 0) {
    fs.appendFileSync(gitignorePath, '\n' + missingEntries.join('\n'));
    log.success('Added missing entries to .gitignore');
  } else {
    log.info('.gitignore already contains required entries');
  }
}

/**
 * Displays next steps
 */
function showNextSteps() {
  log.header('Setup Complete!');

  console.log(`${colors.green}Your workshopsAI CMS development environment is ready.${colors.reset}\n`);

  console.log(`${colors.bright}Next steps:${colors.reset}`);
  console.log(`  ${colors.cyan}1.${colors.reset} Review and update your .env file with proper configuration`);
  console.log(`  ${colors.cyan}2.${colors.reset} Set up your database: ${colors.yellow}npm run db:generate && npm run db:migrate${colors.reset}`);
  console.log(`  ${colors.cyan}3.${colors.reset} Install Playwright browsers: ${colors.yellow}npm run playwright:install${colors.reset}`);
  console.log(`  ${colors.cyan}4.${colors.reset} Start development server: ${colors.yellow}npm run dev${colors.reset}`);
  console.log(`  ${colors.cyan}5.${colors.reset} Run tests: ${colors.yellow}npm run test${colors.reset}\n`);

  console.log(`${colors.bright}Useful commands:${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Development:         ${colors.yellow}npm run dev${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Type checking:       ${colors.yellow}npm run typecheck${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Linting:            ${colors.yellow}npm run lint${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Tests:              ${colors.yellow}npm run test${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} E2E Tests:          ${colors.yellow}npm run test:e2e${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Database studio:    ${colors.yellow}npm run db:studio${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Build:              ${colors.yellow}npm run build${colors.reset}\n`);

  console.log(`${colors.bright}Documentation:${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Check the README.md for detailed setup instructions`);
  console.log(`  ${colors.cyan}•${colors.reset} Review environment variables in .env.example`);
  console.log(`  ${colors.cyan}•${colors.reset} Check the docs/ directory for additional guides\n`);
}

/**
 * Main setup function
 */
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           workshopsAI CMS Development Setup              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  try {
    validateNodeVersion();
    createDirectories();

    const envValid = validateEnvironment();

    if (envValid) {
      validateDatabase();
    }

    setupGitIgnore();
    runValidationCommands();
    showNextSteps();

    log.success('Setup completed successfully!');
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    console.log('\n' + error.stack);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = {
  validateNodeVersion,
  createDirectories,
  validateEnvironment,
  validateDatabase,
  runValidationCommands,
  setupGitIgnore
};