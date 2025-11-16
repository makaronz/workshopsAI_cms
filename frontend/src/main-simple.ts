/**
 * Simplified Main Entry Point
 * No complex routing, just show login form directly
 */

// Import global styles
import './styles/global.css';

// Import auth components
import './components/auth/login-form';
import './components/auth/register-form';

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
    // Check current route
    const currentPath = window.location.pathname;
    
    if (currentPath === '/register') {
      appElement.innerHTML = '<register-form></register-form>';
      console.log('✅ Register form rendered');
    } else {
      appElement.innerHTML = '<login-form></login-form>';
      console.log('✅ Login form rendered');
    }
    
    appElement.style.display = 'block';
  }
});

// Set up event listeners for navigation between login and register
document.addEventListener('navigate-to-register', ((e: CustomEvent) => {
  e.preventDefault();
  window.history.pushState({}, '', '/register');
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.innerHTML = '<register-form></register-form>';
  }
}) as EventListener);

document.addEventListener('navigate-to-login', ((e: CustomEvent) => {
  e.preventDefault();
  window.history.pushState({}, '', '/login');
  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.innerHTML = '<login-form></login-form>';
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
window.addEventListener('popstate', () => {
  const currentPath = window.location.pathname;
  const appElement = document.getElementById('app');
  if (appElement) {
    if (currentPath === '/register') {
      appElement.innerHTML = '<register-form></register-form>';
    } else {
      appElement.innerHTML = '<login-form></login-form>';
    }
  }
});

// Handle register success - redirect to dashboard
document.addEventListener('register-success', () => {
  // Redirect is handled in the component, but we can add additional logic here if needed
  console.log('✅ Registration successful');
});

// Global error handling
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

console.log('✅ main-simple.ts loaded successfully');

