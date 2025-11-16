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

// Set up event listeners for login form events (using document-level listeners for event bubbling)
document.addEventListener('navigate-to-register', ((e: CustomEvent) => {
  e.preventDefault();
  // Open email client with admin contact
  const adminEmail = 'admin@workshopsai.local'; // You can change this to actual admin email
  window.location.href = `mailto:${adminEmail}?subject=Account Request&body=Hello, I would like to request an account for WorkshopsAI CMS.`;
}) as EventListener);

document.addEventListener('forgot-password', ((e: CustomEvent) => {
  e.preventDefault();
  // Show alert or navigate to forgot password page
  alert('Please contact the administrator to reset your password.');
  // Alternatively, you could navigate to a forgot password page:
  // window.location.href = '/forgot-password';
}) as EventListener);

// Global error handling
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

console.log('✅ main-simple.ts loaded successfully');

