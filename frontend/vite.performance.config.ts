import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Performance-optimized Vite configuration for workshopsAI CMS frontend
 *
 * Features:
 * - Advanced code splitting and lazy loading
 * - Tree shaking and dead code elimination
 * - Asset optimization and compression
 * - Bundle size analysis
 * - Service worker optimization
 * - CSS optimization and purging
 */

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/styles': resolve(__dirname, 'src/styles'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/assets': resolve(__dirname, 'src/assets'),
    },
  },
  plugins: [
    // Enhanced PWA with performance optimizations
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                return `${request.url}?version=${Date.now()}`;
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Custom precaching for critical resources
        precacheEntries: [
          { url: '/', revision: Date.now().toString() },
        ],
      },
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'masked-icon.svg',
        'robots.txt',
        'sitemap.xml'
      ],
      manifest: {
        name: 'WorkshopsAI CMS',
        short_name: 'WorkshopsAI',
        description: 'Sociological workshop management system',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Create Workshop',
            short_name: 'Create',
            description: 'Create a new workshop',
            url: '/workshops/create',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      }
    }),
    // Bundle analyzer for performance monitoring
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    target: 'es2022',
    minify: 'terser',
    sourcemap: process.env.NODE_ENV === 'development',

    // Advanced build optimization
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // Advanced chunking strategy
        manualChunks: {
          // Vendor libraries
          vendor: ['lit', '@lit/reactive-element', '@vaadin/router'],

          // UI components
          ui: [
            // Split commonly used components
          ],

          // Utilities
          utils: [
            // Utility libraries
          ],

          // Authentication
          auth: [
            // Authentication-related code
          ],
        },

        // Asset optimization
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];

          // Different optimization for different asset types
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/.test(assetInfo.name || '')) {
            return 'assets/media/[name].[hash][extname]';
          }

          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(assetInfo.name || '')) {
            return 'assets/images/[name].[hash][extname]';
          }

          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name || '')) {
            return 'assets/fonts/[name].[hash][extname]';
          }

          return `assets/${ext}/[name].[hash][extname]`;
        },

        // Chunk optimization
        inlineDynamicImports: false,
        compact: true,
      },

      // External dependencies for better caching
      external: (id) => {
        // Keep large libraries external if needed
        return false; // Most dependencies should be bundled for this project
      },
    },

    // Terser optimization
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        properties: {
          regex: /^_/, // Mangle private properties
        },
      },
      format: {
        comments: false,
      },
    },

    // CSS optimization
    cssCodeSplit: true,
    cssMinify: 'lightningcss',

    // Performance budgets
    chunkSizeWarningLimit: 500, // Warn for chunks > 500kb

    // Advanced optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb

    // Optimize dependencies
    commonjsOptions: {
      include: [],
      transformMixedEsModules: true,
    },
  },

  // Development server optimization
  server: {
    port: 3000,
    host: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
        // Add caching for API responses during development
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add caching headers for GET requests
            if (req.method === 'GET' && proxyRes.statusCode === 200) {
              proxyRes.headers['cache-control'] = 'public, max-age=300';
            }
          });
        },
      },
    },

    // Optimize file watching
    watch: {
      usePolling: false,
      interval: 100,
      ignored: ['**/node_modules/**', '**/dist/**'],
    },

    // Preload dependencies
    preTransformRequests: true,
  },

  // Preview server optimization
  preview: {
    port: 4173,
    host: true,
  },

  // Dependencies optimization
  optimizeDeps: {
    include: [
      'lit',
      '@lit/reactive-element',
      '@vaadin/router',
    ],
    exclude: [
      // Exclude dependencies that should be bundled separately
    ],
  },

  // Performance testing configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/',
        'coverage/',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },

  // Experimental features for performance
  experimental: {
    renderBuiltUrl: (filename, { hostType }) => {
      // Optimize asset URLs for different environments
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    },
  },

  // CSS optimization
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        // Enable advanced SCSS optimizations
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
    postcss: {
      plugins: [
        // Add PostCSS optimizations
        require('autoprefixer'),
        require('cssnano')({
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
              minifySelectors: true,
            },
          ],
        }),
      ],
    },
  },

  // Performance monitoring
  define: {
    __PERFORMANCE_MONITORING__: JSON.stringify(process.env.NODE_ENV === 'production'),
  },
});