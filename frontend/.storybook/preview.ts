import type { Preview } from '@storybook/web-components';
import { setCustomElementsManifest } from '@storybook/web-components';

// For Web Components with Lit
import customElements from '../dist/custom-elements.json';

// Set up custom elements manifest for autocomplete and documentation
setCustomElementsManifest(customElements);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      toc: true,
    },
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          'Introduction',
          'UI',
          'Layout',
          'Authentication',
          'Workshops',
          'Questionnaires',
        ],
      },
    },
  },
  globalTypes: {
    locale: {
      description: 'Internationalization locale',
      defaultValue: 'en',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'pl', title: 'Polski' },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: 'Theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;