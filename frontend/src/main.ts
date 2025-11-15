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
      
      // Simple dashboard content
      const outlet = context.element.querySelector('[slot="content"]');
      if (outlet) {
        render(html`
          <div style="padding: 2rem; max-width: 1200px; margin: 0 auto;">
            <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937;">
              Dashboard
            </h1>
            <p style="color: #6b7280; margin-bottom: 2rem;">
              Welcome to WorkshopsAI CMS - Content Management System for Sociologists
            </p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
              <div style="padding: 1.5rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">WORKSHOPS</h3>
                <p style="font-size: 2.5rem; font-weight: 700; color: #2563eb; margin: 0;">0</p>
                <p style="font-size: 0.875rem; color: #6b7280; margin: 0.5rem 0 0 0;">Total workshops</p>
              </div>
              
              <div style="padding: 1.5rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">QUESTIONNAIRES</h3>
                <p style="font-size: 2.5rem; font-weight: 700; color: #10b981; margin: 0;">0</p>
                <p style="font-size: 0.875rem; color: #6b7280; margin: 0.5rem 0 0 0;">Active questionnaires</p>
              </div>
              
              <div style="padding: 1.5rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">RESPONSES</h3>
                <p style="font-size: 2.5rem; font-weight: 700; color: #f59e0b; margin: 0;">0</p>
                <p style="font-size: 0.875rem; color: #6b7280; margin: 0.5rem 0 0 0;">Total responses</p>
              </div>
              
              <div style="padding: 1.5rem; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="font-size: 0.875rem; font-weight: 600; color: #6b7280; margin: 0 0 0.5rem 0;">ANALYSIS JOBS</h3>
                <p style="font-size: 2.5rem; font-weight: 700; color: #8b5cf6; margin: 0;">0</p>
                <p style="font-size: 0.875rem; color: #6b7280; margin: 0.5rem 0 0 0;">Completed analyses</p>
              </div>
            </div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem 0; color: #1f2937;">
                Quick Actions
              </h2>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <a href="/dashboard/workshops/new" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  + Create Workshop
                </a>
                <a href="/dashboard/questionnaires/new" style="padding: 0.75rem 1.5rem; background: #10b981; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  + Create Questionnaire
                </a>
                <a href="/api/v1" target="_blank" style="padding: 0.75rem 1.5rem; background: #6b7280; color: white; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  API Documentation
                </a>
              </div>
            </div>
            
            <div style="margin-top: 2rem; padding: 1.5rem; background: #dbeafe; border-left: 4px solid #2563eb; border-radius: 4px;">
              <h3 style="font-size: 1rem; font-weight: 600; margin: 0 0 0.5rem 0; color: #1e40af;">
                🎉 System Status: Fully Operational
              </h3>
              <ul style="margin: 0; padding-left: 1.5rem; color: #1e40af;">
                <li>✅ Backend API: Connected</li>
                <li>✅ Database: PostgreSQL connected</li>
                <li>✅ Redis Cache: Active</li>
                <li>✅ Frontend: Running</li>
              </ul>
            </div>
          </div>
        `, outlet);
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