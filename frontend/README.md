# WorkshopsAI CMS Frontend

A modern, Web Components-based frontend for the WorkshopsAI CMS - a sociological workshop management system.

## 🚀 Features

- **Web Components**: Standards-based, framework-agnostic components using Lit
- **TypeScript**: Full type safety and developer experience
- **Progressive Enhancement**: Works without JavaScript, enhanced with it
- **Accessibility**: WCAG 2.2 AA compliant from the start
- **Internationalization**: Polish/English bilingual support
- **Mobile-First**: Responsive design for all devices
- **PWA Ready**: Offline capabilities and app-like experience
- **Storybook**: Component documentation and development environment

## 🏗️ Architecture

### Technology Stack
- **Framework**: Web Components + Lit 3.x
- **Language**: TypeScript 5.3+
- **Build Tool**: Vite 5.x
- **Styling**: CSS Custom Properties + Tailwind CSS
- **Testing**: Vitest + Testing Library
- **Documentation**: Storybook 7.x
- **Accessibility**: axe-core integration

### Project Structure
```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Web Components
│   │   ├── auth/          # Authentication components
│   │   ├── workshops/     # Workshop management components
│   │   ├── questionnaires/ # Questionnaire components
│   │   ├── ui/            # Reusable UI components
│   │   └── layout/        # Layout components
│   ├── services/          # Business logic and API services
│   ├── styles/            # Global styles and CSS custom properties
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── locales/           # Translation files
│   └── assets/            # Static assets
├── stories/               # Storybook stories
├── tests/                 # Test files
└── config/                # Configuration files
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd workshopsAI_cms/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open browser**
   Navigate to `http://localhost:3000`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run unit tests |
| `npm run test:ui` | Run tests with UI interface |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run storybook` | Start Storybook development server |
| `npm run build-storybook` | Build Storybook for production |
| `npm run accessibility` | Run accessibility audit with axe-core |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## 🎨 Component Development

### Creating New Components

1. **Create component file**
   ```typescript
   // src/components/my-component/my-component.ts
   import { LitElement, html, css } from 'lit';
   import { customElement } from 'lit/decorators.js';

   @customElement('my-component')
   export class MyComponent extends LitElement {
     static styles = css`
       :host {
         display: block;
       }
     `;

     render() {
       return html`<div>Hello World</div>`;
     }
   }
   ```

2. **Create Storybook story**
   ```typescript
   // stories/components/my-component.stories.ts
   import type { Meta, StoryObj } from '@storybook/web-components';
   import '../src/components/my-component/my-component';

   const meta: Meta = {
     title: 'MyComponent',
     component: 'my-component',
   };

   export default meta;
   type Story = StoryObj;

   export const Default: Story = {};
   ```

3. **Import in main**
   ```typescript
   // src/main.ts
   import './components/my-component/my-component';
   ```

### Component Guidelines

- **Accessibility**: All components must be WCAG 2.2 AA compliant
- **Responsive**: Mobile-first responsive design
- **Theming**: Use CSS custom properties for theming
- **TypeScript**: Strict typing for all props and methods
- **Testing**: Unit tests for all component logic
- **Documentation**: Storybook stories for all components

## 🌍 Internationalization

The application supports Polish and English languages.

### Adding New Translations

1. **Update translation files**
   ```json
   // src/locales/en.json
   {
     "myComponent": {
       "title": "My Component",
       "description": "Component description"
     }
   }

   // src/locales/pl.json
   {
     "myComponent": {
       "title": "Mój Komponent",
       "description": "Opis komponentu"
     }
   }
   ```

2. **Use in components**
   ```typescript
   import { t } from '../services/i18n';

   render() {
     return html`
       <h1>${t('myComponent.title')}</h1>
       <p>${t('myComponent.description')}</p>
     `;
   }
   ```

## ♿ Accessibility

### Built-in Accessibility Features

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: Proper ARIA labels and announcements
- **High Contrast Mode**: Support for high contrast preferences
- **Reduced Motion**: Respect for reduced motion preferences
- **Focus Management**: Visible focus indicators and logical tab order

### Testing Accessibility

```bash
# Run axe-core accessibility audit
npm run accessibility

# Check Storybook stories for accessibility issues
npm run storybook
# Look for the "Accessibility" tab in Storybook
```

## 🧪 Testing

### Unit Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run tests with coverage
npm run test:coverage
```

### Component Testing Example

```typescript
import { expect, fixture, html } from '@vitest/browser';
import '../src/components/my-component/my-component';

describe('MyComponent', () => {
  it('renders correctly', async () => {
    const el = await fixture(html`<my-component></my-component>`);
    expect(el.shadowRoot?.querySelector('div')).to.exist;
  });

  it('is accessible', async () => {
    const el = await fixture(html`<my-component></my-component>`);
    await expect(el).to.be.accessible();
  });
});
```

## 📱 Progressive Web App

The application is PWA-ready with:

- **Service Worker**: Offline functionality
- **Web App Manifest**: App installation support
- **Responsive Design**: Works on all device sizes
- **Performance**: Optimized for fast loading

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

### Environment Variables

Create a `.env.production` file:

```env
VITE_API_URL=https://api.workshopsai.example.com
VITE_APP_NAME=WorkshopsAI CMS
VITE_APP_VERSION=1.0.0
```

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure accessibility compliance
5. Test on multiple devices/browsers

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:

- **Documentation**: See `/docs` directory
- **Issues**: Create an issue on GitHub
- **Email**: support@workshopsai.example.com

## 🔧 Configuration Files

- **Vite**: `vite.config.ts` - Build configuration
- **TypeScript**: `tsconfig.json` - Type checking configuration
- **ESLint**: `.eslintrc.json` - Linting rules
- **Prettier**: `.prettierrc` - Code formatting
- **Tailwind**: `tailwind.config.js` - Utility classes
- **Storybook**: `.storybook/` - Documentation configuration

## 🎯 Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms
- **Bundle Size**: < 100KB gzipped

## 🔐 Security

- **CSP**: Content Security Policy headers
- **XSS**: Input sanitization and output encoding
- **CSRF**: Token-based CSRF protection
- **Authentication**: JWT-based auth system
- **HTTPS**: Enforced in production