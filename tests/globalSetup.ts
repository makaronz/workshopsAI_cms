export default async function globalSetup() {
  console.log('🧪 Test environment setup started');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key';
  process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
  process.env.SALT_ROUNDS = '10';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '3306';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  process.env.DB_NAME = 'test_workshopsai_cms';
  process.env.PORT = '3001';
  process.env.CORS_ORIGIN = 'http://localhost:3001';

  // Initialize test database if needed
  console.log('✅ Test environment setup completed');
};