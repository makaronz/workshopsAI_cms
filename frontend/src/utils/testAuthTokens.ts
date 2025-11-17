/**
 * Test Suite for Token Management
 * Simple verification that centralized token management works correctly
 */

import { TokenManager, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './authTokens';

/**
 * Test token management functionality
 */
export function testTokenManagement(): boolean {
  console.log('🧪 Starting Token Management Tests');

  // Clear any existing tokens
  TokenManager.clearTokens();

  try {
    // Test 1: Initial state should have no tokens
    console.log('Test 1: Initial state');
    const initialToken = TokenManager.getAccessToken();
    const initialRefreshToken = TokenManager.getRefreshToken();
    const hasValidToken = TokenManager.hasValidToken();

    if (initialToken !== null || initialRefreshToken !== null || hasValidToken !== false) {
      console.error('❌ Initial state test failed');
      return false;
    }
    console.log('✅ Initial state test passed');

    // Test 2: Setting access token with rememberMe=false
    console.log('Test 2: Setting access token (session storage)');
    const testToken = 'test-access-token-123';
    TokenManager.setAccessToken(testToken, false);

    const retrievedToken = TokenManager.getAccessToken();
    const localStorageToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const sessionStorageToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);

    if (retrievedToken !== testToken || localStorageToken !== testToken || sessionStorageToken !== testToken) {
      console.error('❌ Session storage token test failed');
      console.error({ retrievedToken, localStorageToken, sessionStorageToken, expected: testToken });
      return false;
    }
    console.log('✅ Session storage token test passed');

    // Test 3: Setting refresh token
    console.log('Test 3: Setting refresh token');
    const testRefreshToken = 'test-refresh-token-456';
    TokenManager.setRefreshToken(testRefreshToken);

    const retrievedRefreshToken = TokenManager.getRefreshToken();
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (retrievedRefreshToken !== testRefreshToken || storedRefreshToken !== testRefreshToken) {
      console.error('❌ Refresh token test failed');
      console.error({ retrievedRefreshToken, storedRefreshToken, expected: testRefreshToken });
      return false;
    }
    console.log('✅ Refresh token test passed');

    // Test 4: Auth header generation
    console.log('Test 4: Auth header generation');
    const authHeader = TokenManager.getAuthHeader();
    const expectedHeader = { Authorization: `Bearer ${testToken}` };

    if (JSON.stringify(authHeader) !== JSON.stringify(expectedHeader)) {
      console.error('❌ Auth header test failed');
      console.error({ authHeader, expectedHeader });
      return false;
    }
    console.log('✅ Auth header test passed');

    // Test 5: Setting access token with rememberMe=true
    console.log('Test 5: Setting access token (local storage only)');
    const testToken2 = 'test-access-token-789';
    TokenManager.setAccessToken(testToken2, true);

    const retrievedToken2 = TokenManager.getAccessToken();
    const localStorageToken2 = localStorage.getItem(ACCESS_TOKEN_KEY);
    const sessionStorageToken2 = sessionStorage.getItem(ACCESS_TOKEN_KEY);

    if (retrievedToken2 !== testToken2 || localStorageToken2 !== testToken2 || sessionStorageToken2 !== null) {
      console.error('❌ Local storage only token test failed');
      console.error({ retrievedToken2, localStorageToken2, sessionStorageToken2, expected: testToken2 });
      return false;
    }
    console.log('✅ Local storage only token test passed');

    // Test 6: Clear tokens
    console.log('Test 6: Clear tokens');
    TokenManager.clearTokens();

    const finalToken = TokenManager.getAccessToken();
    const finalRefreshToken = TokenManager.getRefreshToken();
    const finalLocalStorageToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const finalSessionStorageToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const finalRefreshStorageToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (finalToken !== null || finalRefreshToken !== null ||
        finalLocalStorageToken !== null || finalSessionStorageToken !== null ||
        finalRefreshStorageToken !== null) {
      console.error('❌ Clear tokens test failed');
      return false;
    }
    console.log('✅ Clear tokens test passed');

    console.log('🎉 All Token Management Tests Passed!');
    return true;

  } catch (error) {
    console.error('❌ Token Management Tests Failed:', error);
    return false;
  }
}

/**
 * Test token consistency across services
 */
export function testTokenConsistency(): boolean {
  console.log('🧪 Testing Token Consistency Across Services');

  // Clear any existing tokens first
  TokenManager.clearTokens();

  try {
    // Set a test token
    const testToken = 'consistency-test-token-123';
    TokenManager.setAccessToken(testToken, false);

    // Test that the token is accessible from multiple storage locations
    const tokenFromManager = TokenManager.getAccessToken();
    const tokenFromLocalStorage = localStorage.getItem(ACCESS_TOKEN_KEY);
    const tokenFromSessionStorage = sessionStorage.getItem(ACCESS_TOKEN_KEY);

    // All should be the same
    const allTokensSame = tokenFromManager === testToken &&
                         tokenFromLocalStorage === testToken &&
                         tokenFromSessionStorage === testToken;

    if (!allTokensSame) {
      console.error('❌ Token consistency test failed');
      console.error({
        testToken,
        tokenFromManager,
        tokenFromLocalStorage,
        tokenFromSessionStorage
      });
      return false;
    }

    console.log('✅ Token consistency test passed');
    return true;

  } catch (error) {
    console.error('❌ Token consistency test failed:', error);
    return false;
  }
}

// Auto-run tests when loaded (only in development)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('🔧 Development mode detected - running token tests');

  // Run tests after a short delay to ensure DOM is ready
  setTimeout(() => {
    const testsPassed = testTokenManagement() && testTokenConsistency();

    if (!testsPassed) {
      console.error('🚨 TOKEN MANAGEMENT TESTS FAILED - Authentication may not work correctly!');
    } else {
      console.log('✅ All token tests passed - Authentication should work correctly');
    }
  }, 1000);
}

export default { testTokenManagement, testTokenConsistency };