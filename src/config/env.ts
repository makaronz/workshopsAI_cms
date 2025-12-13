/**
 * Environment Configuration Loader
 * 
 * This file MUST be imported first before any other modules
 * to ensure environment variables are loaded before any configuration is read.
 */

import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
const result = config({ path: path.resolve(process.cwd(), '.env') });

if (result.error) {
  console.warn('⚠️  Failed to load .env file:', result.error.message);
  console.warn('⚠️  Using system environment variables only');
} else {
  console.log('✅ Environment variables loaded from .env');
}

// Log loaded database configuration (for debugging)
const isProduction = process.env.NODE_ENV === 'production';
console.log('📋 Database configuration:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('  DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('  DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Validate critical environment variables
// Most PaaS platforms (DigitalOcean, Render, Fly.io, etc.) provide DATABASE_URL instead of individual DB_* variables
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const requiredVars: string[] = [];

// Database configuration: prefer DATABASE_URL, fallback to individual DB_* variables
if (!hasDatabaseUrl) {
  // If DATABASE_URL is not set, require individual DB_* variables
  requiredVars.push('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME');
} else {
  // DATABASE_URL is set - individual DB_* variables are optional (for development fallback)
  if (!isProduction) {
    console.log('✅ DATABASE_URL is set - individual DB_* variables are optional');
  }
}

// JWT_SECRET is always required
requiredVars.push('JWT_SECRET');

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  if (isProduction && missingVars.includes('JWT_SECRET')) {
    // In production, JWT_SECRET is critical
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('❌ Please check your environment variables');
  } else if (!hasDatabaseUrl && missingVars.some(v => v.startsWith('DB_'))) {
    // Database variables missing and DATABASE_URL not set
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('❌ Please set DATABASE_URL or individual DB_* variables');
    console.error('❌ Most PaaS platforms automatically provide DATABASE_URL - check your platform settings');
  } else {
    // Other missing variables (non-critical in dev)
    console.warn('⚠️  Missing environment variables:', missingVars.join(', '));
    console.warn('⚠️  Some features may not work correctly');
  }
} else {
  console.log('✅ All required environment variables are set');
}

export default result;

