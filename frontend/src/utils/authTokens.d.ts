/**
 * Authentication Token Constants
 * Centralized token management for consistent authentication across the application
 */
export declare const ACCESS_TOKEN_KEY = "workshopsai-access-token";
export declare const REFRESH_TOKEN_KEY = "workshopsai-refresh-token";
export declare const TOKEN_STORAGE: {
    readonly LOCAL_STORAGE: "localStorage";
    readonly SESSION_STORAGE: "sessionStorage";
};
export declare class TokenManager {
    /**
     * Get access token from storage (localStorage first, then sessionStorage)
     */
    static getAccessToken(): string | null;
    /**
     * Get refresh token from localStorage only
     */
    static getRefreshToken(): string | null;
    /**
     * Set access token with storage strategy
     * @param token - The access token to store
     * @param rememberMe - If true, use localStorage only; if false, use both storages
     */
    static setAccessToken(token: string, rememberMe?: boolean): void;
    /**
     * Set refresh token (always in localStorage for persistence)
     */
    static setRefreshToken(token: string): void;
    /**
     * Clear all authentication tokens from all storage
     */
    static clearTokens(): void;
    /**
     * Check if user has a valid access token
     */
    static hasValidToken(): boolean;
    /**
     * Get Authorization header value for API requests
     */
    static getAuthHeader(): {
        Authorization: string;
    } | {};
    /**
     * Handle 401 unauthorized response - clear tokens and redirect
     */
    static handleUnauthorized(): void;
    /**
     * Setup token change listener for cross-tab synchronization
     */
    static setupTokenListener(callback: (token: string | null) => void): () => void;
}
/**
 * Axios interceptor helper for automatic token injection
 */
export declare const createAuthInterceptor: () => (config: any) => any;
/**
 * Axios response interceptor for handling 401 errors
 */
export declare const createAuthErrorHandler: () => (error: any) => Promise<never>;
export default TokenManager;
//# sourceMappingURL=authTokens.d.ts.map