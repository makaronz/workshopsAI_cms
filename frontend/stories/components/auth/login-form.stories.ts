import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './login-form';
import type { LoginForm } from '../../src/components/auth/login-form';

const meta: Meta<LoginForm> = {
  title: 'Authentication/LoginForm',
  component: 'login-form',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A login form component with validation, accessibility features, and internationalization support.',
      },
    },
  },
  argTypes: {
    onLoginSuccess: {
      action: 'login-success',
      description: 'Callback fired when login is successful',
    },
    onForgotPassword: {
      action: 'forgot-password',
      description: 'Callback fired when forgot password is clicked',
    },
    onNavigateToRegister: {
      action: 'navigate-to-register',
      description: 'Callback fired when register link is clicked',
    },
  },
  args: {
    autoFocus: true,
  },
};

export default meta;
type Story = StoryObj<LoginForm>;

export const Default: Story = {
  render: (args) => {
    return html`
      <login-form
        ?autoFocus=${args.autoFocus}
        @login-success=${args.onLoginSuccess}
        @forgot-password=${args.onForgotPassword}
        @navigate-to-register=${args.onNavigateToRegister}
      ></login-form>
    `;
  },
};

export const WithError: Story = {
  render: (args) => {
    // Simulate error state
    setTimeout(() => {
      const form = document.querySelector('login-form');
      if (form) {
        form.setAttribute('server-error', 'Invalid email or password');
      }
    }, 100);

    return html`
      <login-form
        server-error="Invalid email or password"
        ?autoFocus=${args.autoFocus}
        @login-success=${args.onLoginSuccess}
        @forgot-password=${args.onForgotPassword}
        @navigate-to-register=${args.onNavigateToRegister}
      ></login-form>
    `;
  },
};

export const Loading: Story = {
  render: (args) => {
    return html`
      <div style="max-width: 400px;">
        <login-form
          loading
          ?autoFocus=${args.autoFocus}
          @login-success=${args.onLoginSuccess}
          @forgot-password=${args.onForgotPassword}
          @navigate-to-register=${args.onNavigateToRegister}
        ></login-form>
      </div>
    `;
  },
};

export const WithPrefilledData: Story = {
  render: (args) => {
    return html`
      <login-form
        email="user@example.com"
        ?autoFocus=${false}
        @login-success=${args.onLoginSuccess}
        @forgot-password=${args.onForgotPassword}
        @navigate-to-register=${args.onNavigateToRegister}
      ></login-form>
    `;
  },
};

export const Mobile: Story = {
  render: (args) => {
    return html`
      <div style="max-width: 375px; border: 1px solid #e5e7eb; padding: 1rem; background: #f9fafb;">
        <login-form
          ?autoFocus=${args.autoFocus}
          @login-success=${args.onLoginSuccess}
          @forgot-password=${args.onForgotPassword}
          @navigate-to-register=${args.onNavigateToRegister}
        ></login-form>
      </div>
    `;
  },
  parameters: {
    viewport: {
      defaultViewport: 'iphone12',
    },
  },
};

export const HighContrast: Story = {
  render: (args) => {
    return html`
      <div style="filter: contrast(2);">
        <login-form
          ?autoFocus=${args.autoFocus}
          @login-success=${args.onLoginSuccess}
          @forgot-password=${args.onForgotPassword}
          @navigate-to-register=${args.onNavigateToRegister}
        ></login-form>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story: 'This story simulates high contrast mode for accessibility testing.',
      },
    },
  },
};

export const Polish: Story = {
  render: (args) => {
    return html`
      <div lang="pl" style="direction: ltr;">
        <login-form
          ?autoFocus=${args.autoFocus}
          @login-success=${args.onLoginSuccess}
          @forgot-password=${args.onForgotPassword}
          @navigate-to-register=${args.onNavigateToRegister}
        ></login-form>
      </div>
    `;
  },
  globals: {
    locale: 'pl',
  },
  parameters: {
    docs: {
      description: {
        story: 'This story shows the form with Polish language translations.',
      },
    },
  },
};