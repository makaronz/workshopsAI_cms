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
import './components/layout/app-navigation';
import './components/layout/app-footer';

import './components/auth/login-form';
import './components/auth/registration-form';
import './components/auth/forgot-password-form';

import './components/ui/button';
import './components/ui/input';
import './components/ui/loading-spinner';
import './components/ui/error-boundary';
import './components/ui/notification';

// Import questionnaire components
import './components/questionnaire';

// Import services
import { AuthService } from './services/auth';
import { AccessibilityService } from './services/accessibility';

// Define application routes
const routes = [
  {
    path: '/',
    component: 'app-shell',
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: '/login',
        component: 'login-form',
        action: async () => {
          // Redirect if already logged in
          if (await AuthService.isAuthenticated()) {
            return '/dashboard';
          }
        }
      },
      {
        path: '/register',
        component: 'registration-form'
      },
      {
        path: '/forgot-password',
        component: 'forgot-password-form'
      },
      {
        path: '/dashboard',
        component: 'app-shell',
        action: async () => {
          // Protect route
          if (!(await AuthService.isAuthenticated())) {
            return '/login';
          }
        },
        children: [
          {
            path: '',
            lazy: () => import('./components/dashboard/dashboard-home')
          },
          {
            path: 'workshops',
            children: [
              {
                path: '',
                lazy: () => import('./components/workshops/workshop-list')
              },
              {
                path: 'new',
                lazy: () => import('./components/workshops/workshop-editor')
              },
              {
                path: ':id/edit',
                lazy: () => import('./components/workshops/workshop-editor')
              },
              {
                path: ':id/preview',
                lazy: () => import('./components/workshops/workshop-preview')
              }
            ]
          },
          {
            path: 'questionnaires',
            children: [
              {
                path: '',
                lazy: () => import('./components/questionnaires/questionnaire-list')
              },
              {
                path: 'new',
                lazy: () => import('./components/questionnaires/questionnaire-builder-page')
              },
              {
                path: ':id',
                lazy: () => import('./components/questionnaires/questionnaire-view')
              },
              {
                path: ':id/edit',
                lazy: () => import('./components/questionnaires/questionnaire-builder-page')
              },
              {
                path: ':id/preview',
                lazy: () => import('./components/questionnaires/questionnaire-preview-page')
              },
              {
                path: ':id/analyze',
                lazy: () => import('./components/questionnaires/analysis-dashboard')
              }
            ]
          },
          {
            path: 'profile',
            lazy: () => import('./components/profile/profile-settings')
          }
        ]
      },
      {
        path: '/workshops/:slug',
        component: 'app-shell',
        lazy: () => import('./components/public/workshop-public-view')
      },
      {
        path: '/questionnaires/:id',
        component: 'app-shell',
        lazy: () => import('./components/public/questionnaire-participant-view')
      }
    ]
  },
  {
    path: '(.*)',
    component: 'app-shell',
    lazy: () => import('./components/errors/not-found')
  }
];

// Initialize router
const router = new Router(document.getElementById('app') as HTMLElement);
router.setRoutes(routes);

// Initialize accessibility service
AccessibilityService.init();

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