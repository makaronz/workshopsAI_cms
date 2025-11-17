/**
 * Simplified Main Entry Point with Live Dashboard
 * No complex routing, just show login form directly
 */

// Import global styles
import './styles/global.css';

// Import auth components
import './components/auth/login-form';
import './components/auth/register-form';

// Import dashboard components
import './components/layout/app-shell';
import './components/layout/app-header';
import './components/layout/app-footer';

// Import questionnaire components
import './components/questionnaires/questionnaire-builder-page';
import './components/questionnaire/questionnaire-manager';

// Import workshop components
import './components/workshop/WorkshopEditor';

// Import dashboard components
import './components/dashboard/dashboard-overview';

// Import auth service
import authService from './services/auth';
import { TokenManager } from './utils/authTokens';

// Remove loading screen and show login form
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM Content Loaded');

  const loadingElement = document.getElementById('app-loading');
  const appElement = document.getElementById('app');

  if (loadingElement) {
    loadingElement.style.display = 'none';
    console.log('✅ Loading screen hidden');
  }

  if (appElement) {
    // Check current route and authentication
    const currentPath = window.location.pathname;

    // Initialize routing based on path and auth status
    initializeRouting(appElement, currentPath);
  }
});

// Initialize routing based on path and authentication
export async function initializeRouting(appElement: HTMLElement, path: string) {
  console.log('🔄 Initializing routing for path:', path);

  // Check if tokens exist in storage first (faster check)
  const hasToken = !!(localStorage.getItem('workshopsai-access-token') ||
                     sessionStorage.getItem('workshopsai-access-token'));

  console.log('🔑 Token check:', { hasToken, path });

  // Check authentication status
  let isAuthenticated = false;
  try {
    isAuthenticated = await authService.isAuthenticated();
    console.log('🔐 Authentication status:', isAuthenticated);
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
    // If auth check fails but we have a token, assume authenticated
    isAuthenticated = hasToken;
  }

  if (path === '/register') {
    appElement.innerHTML = '<register-form></register-form>';
    console.log('✅ Register form rendered');
  } else if (path === '/dashboard' || path.startsWith('/dashboard')) {
    if (isAuthenticated || hasToken) {
      // Handle different dashboard sub-routes
      if (path === '/dashboard/questionnaires/new') {
        appElement.innerHTML = '<questionnaire-builder-page></questionnaire-builder-page>';
        console.log('✅ Questionnaire builder page rendered');
      } else if (path === '/dashboard/workshops/new') {
        // NEW: Workshop creation route
        appElement.innerHTML = '<app-shell><workshop-editor></workshop-editor></app-shell>';
        console.log('✅ Workshop editor page rendered');
      } else if (path === '/dashboard') {
        // Main dashboard - use live data component
        appElement.innerHTML = '<app-shell><dashboard-overview></dashboard-overview></app-shell>';
        console.log('✅ Dashboard with live data rendered');
      } else {
        // Other dashboard sub-routes - show dashboard with message
        appElement.innerHTML = `
          <app-shell>
            <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
              <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937;">
                Dashboard
              </h1>
              <p style="color: #6b7280; margin-bottom: 2rem;">
                Route: ${path}
              </p>
              <p style="color: #dc2626;">
                This route is not yet implemented. Please use the navigation menu.
              </p>
              <a href="/dashboard" class="dashboard-link" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">
                ← Back to Dashboard
              </a>
            </div>
          </app-shell>
        `;
        console.log('⚠️ Dashboard sub-route not fully implemented:', path);
      }
    } else {
      // Not authenticated, redirect to login
      console.log('⚠️ Not authenticated, redirecting to login');
      window.location.href = '/login';
      return;
    }
  } else {
    // Default to login form
    if ((isAuthenticated || hasToken) && path === '/login') {
      // Already logged in, redirect to dashboard
      console.log('✅ Already authenticated, redirecting to dashboard');
      window.location.href = '/dashboard';
      return;
    }
    appElement.innerHTML = '<login-form></login-form>';
    console.log('✅ Login form rendered');
  }

  appElement.style.display = 'block';
}

// Set up event listeners for navigation between login and register
document.addEventListener('navigate-to-register', (async (e: CustomEvent) => {
  e.preventDefault();
  window.history.pushState({}, '', '/register');
  const appElement = document.getElementById('app');
  if (appElement) {
    await initializeRouting(appElement, '/register');
  }
}) as EventListener);

document.addEventListener('navigate-to-login', (async (e: CustomEvent) => {
  e.preventDefault();
  window.history.pushState({}, '', '/login');
  const appElement = document.getElementById('app');
  if (appElement) {
    await initializeRouting(appElement, '/login');
  }
}) as EventListener);

document.addEventListener('forgot-password', ((e: CustomEvent) => {
  e.preventDefault();
  // Show alert or navigate to forgot password page
  alert('Please contact the administrator to reset your password.');
  // Alternatively, you could navigate to a forgot password page:
  // window.location.href = '/forgot-password';
}) as EventListener);

// Handle browser back/forward buttons
window.addEventListener('popstate', async () => {
  const currentPath = window.location.pathname;
  const appElement = document.getElementById('app');
  if (appElement) {
    await initializeRouting(appElement, currentPath);
  }
});

// Handle custom navigate events from components
window.addEventListener('navigate', async (e: CustomEvent) => {
  const path = e.detail?.path || window.location.pathname;
  const appElement = document.getElementById('app');
  if (appElement) {
    window.history.pushState({}, '', path);
    await initializeRouting(appElement, path);
  }
});

// Handle clicks on internal links (prevent full page reload)
document.addEventListener('click', async (e: MouseEvent) => {
  const target = e.target as HTMLElement;

  // Find the closest anchor element
  const link = target.closest('a') as HTMLAnchorElement;

  if (!link || !link.href) return;

  // Skip external links, links with target, download links, and mailto/tel links
  if (link.target || link.hasAttribute('download') ||
      link.href.startsWith('mailto:') || link.href.startsWith('tel:') ||
      link.href.startsWith('http://') || link.href.startsWith('https://')) {
    // Only skip if it's a full external URL (not relative)
    if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
      const linkUrl = new URL(link.href);
      const currentUrl = new URL(window.location.href);
      if (linkUrl.origin !== currentUrl.origin) {
        return; // External link, let browser handle it
      }
    } else {
      return; // mailto, tel, or other non-navigation links
    }
  }

  // Check if it's an internal navigation link
  const href = link.getAttribute('href');
  if (!href) return;

  // Handle relative paths
  if (href.startsWith('/dashboard') || href.startsWith('/login') || href.startsWith('/register')) {
    e.preventDefault();
    e.stopPropagation();

    console.log('🔗 [NAVIGATION] Intercepting link click:', {
      href,
      currentPath: window.location.pathname,
      hasToken: !!(localStorage.getItem('workshopsai-access-token') || sessionStorage.getItem('workshopsai-access-token'))
    });

    // Update URL without reload
    window.history.pushState({}, '', href);

    // Update content
    const appElement = document.getElementById('app');
    if (appElement) {
      await initializeRouting(appElement, href);
    }
  }
});

// Handle register success - redirect to dashboard
document.addEventListener('register-success', () => {
  // Redirect is handled in the component, but we can add additional logic here if needed
  console.log('✅ Registration successful');
});

// Handle login success - redirect to dashboard
document.addEventListener('login-success', (async (e: CustomEvent) => {
  console.log('✅ Login successful, redirecting to dashboard...');
  console.log('📦 Event detail:', e.detail);

  // Wait for tokens to be saved to storage
  await new Promise(resolve => setTimeout(resolve, 200));

  // Check if tokens are actually in storage
  const accessToken = localStorage.getItem('workshopsai-access-token') ||
                      sessionStorage.getItem('workshopsai-access-token');
  const refreshToken = localStorage.getItem('workshopsai-refresh-token');

  console.log('🔑 Token check:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length || 0
  });

  // Verify authentication before redirect
  let isAuthenticated = false;
  try {
    isAuthenticated = await authService.isAuthenticated();
    console.log('🔐 Authentication status:', isAuthenticated);
  } catch (error) {
    console.error('❌ Error checking authentication:', error);
  }

  if (isAuthenticated || accessToken) {
    // Redirect to dashboard
    console.log('🚀 Redirecting to dashboard...');
    window.location.href = '/dashboard';
  } else {
    console.warn('⚠️ Not authenticated after login, waiting a bit more...');
    // Wait a bit more and try again
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const isAuthRetry = await authService.isAuthenticated();
      const retryAccessToken = localStorage.getItem('workshopsai-access-token') ||
                               sessionStorage.getItem('workshopsai-access-token');

      console.log('🔄 Retry check:', {
        isAuthenticated: isAuthRetry,
        hasToken: !!retryAccessToken
      });

      if (isAuthRetry || retryAccessToken) {
        console.log('🚀 Retry successful, redirecting to dashboard...');
        window.location.href = '/dashboard';
      } else {
        console.error('❌ Authentication failed after login - no token found');
        // Show error to user
        const appElement = document.getElementById('app');
        if (appElement) {
          appElement.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
              <h2 style="color: #dc2626;">Login Error</h2>
              <p>Authentication failed. Please try logging in again.</p>
              <button onclick="window.location.href='/login'" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Back to Login
              </button>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('❌ Error during retry:', error);
    }
  }
}) as EventListener);

// Global error handling
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

console.log('✅ main-simple-live.ts loaded successfully');