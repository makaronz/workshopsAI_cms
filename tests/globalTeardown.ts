export default async function globalTeardown() {
  console.log('🧹 Test environment teardown started');

  // Cleanup test database if needed
  // Close any open connections

  console.log('✅ Test environment teardown completed');
};