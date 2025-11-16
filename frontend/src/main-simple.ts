/**
 * Simplified Main Entry Point
 * No complex routing, just show login form directly
 */

// Import global styles
import './styles/global.css';

// Import only the login form component
import './components/auth/login-form';

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
    // Create and insert login form
    appElement.innerHTML = '<login-form></login-form>';
    appElement.style.display = 'block';
    console.log('✅ Login form rendered');
  }
});

// Global error handling
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

console.log('✅ main-simple.ts loaded successfully');

