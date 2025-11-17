/**
 * Authentication Token Constants
 * Centralized token management for consistent authentication across the application
 */
// Token storage keys - these must be consistent across all services
export const ACCESS_TOKEN_KEY = 'workshopsai-access-token';
export const REFRESH_TOKEN_KEY = 'workshopsai-refresh-token';
// Token storage strategies
export const TOKEN_STORAGE = {
    LOCAL_STORAGE: 'localStorage',
    SESSION_STORAGE: 'sessionStorage'
};
// Token management utilities
export class TokenManager {
    /**
     * Get access token from storage (localStorage first, then sessionStorage)
     */
    static getAccessToken() {
        return (localStorage.getItem(ACCESS_TOKEN_KEY) ||
            sessionStorage.getItem(ACCESS_TOKEN_KEY));
    }
    /**
     * Get refresh token from localStorage only
     */
    static getRefreshToken() {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    /**
     * Set access token with storage strategy
     * @param token - The access token to store
     * @param rememberMe - If true, use localStorage only; if false, use both storages
     */
    static setAccessToken(token, rememberMe = false) {
        // Always save to localStorage for persistence
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        if (!rememberMe) {
            // Also save to sessionStorage for non-persistent sessions
            sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
        }
        else {
            // Remove from sessionStorage if using persistent storage
            sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        }
    }
    /**
     * Set refresh token (always in localStorage for persistence)
     */
    static setRefreshToken(token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
    /**
     * Clear all authentication tokens from all storage
     */
    static clearTokens() {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
    /**
     * Check if user has a valid access token
     */
    static hasValidToken() {
        return !!this.getAccessToken();
    }
    /**
     * Get Authorization header value for API requests
     */
    static getAuthHeader() {
        const token = this.getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    /**
     * Handle 401 unauthorized response - clear tokens and redirect
     */
    static handleUnauthorized() {
        this.clearTokens();
        // Only redirect if we're in a browser environment
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }
    /**
     * Setup token change listener for cross-tab synchronization
     */
    static setupTokenListener(callback) {
        const handleStorageChange = (event) => {
            if (event.key === ACCESS_TOKEN_KEY) {
                callback(event.newValue);
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', handleStorageChange);
            return () => {
                window.removeEventListener('storage', handleStorageChange);
            };
        }
        return () => { }; // No-op for non-browser environments
    }
}
/**
 * Axios interceptor helper for automatic token injection
 */
export const createAuthInterceptor = () => {
    return (config) => {
        const token = TokenManager.getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    };
};
/**
 * Axios response interceptor for handling 401 errors
 */
export const createAuthErrorHandler = () => {
    return (error) => {
        if (error.response?.status === 401) {
            TokenManager.handleUnauthorized();
        }
        return Promise.reject(error);
    };
};
export default TokenManager;
//# sourceMappingURL=authTokens.js.map