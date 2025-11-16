/**
 * Simplified Main Entry Point
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

// Import auth service
import authService from './services/auth';

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
async function initializeRouting(appElement: HTMLElement, path: string) {
  // Check authentication status
  const isAuthenticated = await authService.isAuthenticated();
  
  if (path === '/register') {
    appElement.innerHTML = '<register-form></register-form>';
    console.log('✅ Register form rendered');
  } else if (path === '/dashboard' || path.startsWith('/dashboard')) {
    if (isAuthenticated) {
      appElement.innerHTML = '<app-shell></app-shell>';
      console.log('✅ Dashboard rendered');
    } else {
      // Not authenticated, redirect to login
      window.location.href = '/login';
      return;
    }
  } else {
    // Default to login form
    if (isAuthenticated && path === '/login') {
      // Already logged in, redirect to dashboard
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

// Handle register success - redirect to dashboard
document.addEventListener('register-success', () => {
  // Redirect is handled in the component, but we can add additional logic here if needed
  console.log('✅ Registration successful');
});

// Handle login success - redirect to dashboard
document.addEventListener('login-success', (async (e: CustomEvent) => {
  console.log('✅ Login successful, redirecting to dashboard...');
  
  // Wait a bit for tokens to be saved
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Verify authentication before redirect
  const isAuthenticated = await authService.isAuthenticated();
  console.log('🔐 Authentication status:', isAuthenticated);
  
  if (isAuthenticated) {
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } else {
    console.warn('⚠️ Not authenticated after login, waiting a bit more...');
    // Wait a bit more and try again
    await new Promise(resolve => setTimeout(resolve, 500));
    const isAuthRetry = await authService.isAuthenticated();
    if (isAuthRetry) {
      window.location.href = '/dashboard';
    } else {
      console.error('❌ Authentication failed after login');
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

console.log('✅ main-simple.ts loaded successfully');

