import { Config } from 'jest';

export default async function globalSetup(_: Config) {
  console.log('🚀 Setting up test environment...');

  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.TEST_MODE = 'true';

  // Initialize test database (if needed)
  try {
    // Here you could initialize a test database
    console.log('✅ Test environment setup complete');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error);
    throw error;
  }
}