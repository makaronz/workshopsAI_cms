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
console.log('📋 Database configuration:');
console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('  DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('  DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

// Validate critical environment variables
const requiredVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('❌ Please check your .env file');
  // Don't exit - let the app handle missing vars gracefully
}

export default result;

