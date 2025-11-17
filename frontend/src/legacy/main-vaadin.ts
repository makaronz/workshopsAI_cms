import { LitElement, render, html } from 'lit';
import { Router } from '@vaadin/router';
import { customElements } from 'lit/decorators.js';

// Import global styles
import './styles/global.css';

// Import i18n setup
import './services/i18n';

// Import components
import './components/layout/app-shell';
import './components/layout/app-header';
import './components/layout/app-footer';

import './components/auth/login-form';

import './components/ui/button';
import './components/ui/input';
import './components/ui/loading';
import './components/ui/notification';
import './components/ui/modal';
import './components/ui/badge';

// Import questionnaire components
import './components/questionnaire';

// Import dashboard components
import './components/dashboard/dashboard-overview';

// Import services
import { authService } from './services/auth';
import accessibilityService from './services/accessibility';

// Define application routes (simplified - only existing components)
const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    component: 'login-form',
    action: async () => {
      // Redirect if already logged in
      if (await authService.isAuthenticated()) {
        return '/dashboard';
      }
    }
  },
  {
    path: '/dashboard',
    component: 'app-shell',
    action: async (context) => {
      // Protect route
      if (!(await authService.isAuthenticated())) {
        return '/login';
      }
      
      // Use live dashboard component
      const outlet = context.element.querySelector('[slot="content"]');
      if (outlet) {
        render(html`<dashboard-overview></dashboard-overview>`, outlet);
      }
    }
  }
];

// Initialize router
const router = new Router(document.getElementById('app') as HTMLElement);
router.setRoutes(routes);

// Initialize accessibility service
accessibilityService.init();

// Set up global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // You could send this to an error tracking service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // You could send this to an error tracking service
});

// Remove loading state once app is ready
document.addEventListener('DOMContentLoaded', () => {
  const loadingElement = document.getElementById('app-loading');
  const appElement = document.getElementById('app');

  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  if (appElement) {
    appElement.style.display = 'block';
  }
});

// Export for testing
export { router };