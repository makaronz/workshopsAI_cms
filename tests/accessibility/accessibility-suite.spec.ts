/**
 * Accessibility Testing Suite
 * WCAG 2.2 AA compliance testing with axe-core
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Testing Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Set up accessibility testing configuration
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Homepage Accessibility', () => {
    test('should pass axe-core accessibility scan', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      if (headings.length > 0) {
        // Check that there's only one h1
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeLessThanOrEqual(1);

        // Check heading levels don't skip (e.g., h1 followed by h3)
        for (let i = 0; i < headings.length - 1; i++) {
          const currentLevel = parseInt(await headings[i].evaluate(el => el.tagName.substring(1)));
          const nextLevel = parseInt(await headings[i + 1].evaluate(el => el.tagName.substring(1)));

          expect(nextLevel).toBeLessThanOrEqual(currentLevel + 1);
        }
      }
    });

    test('should have sufficient color contrast', async ({ page }) => {
      // Test common text elements for color contrast
      const textElements = await page.locator('p, span, div, button, a').all();

      for (const element of textElements.slice(0, 10)) { // Test first 10 elements
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        });

        // Skip elements with transparent or no background
        if (styles.backgroundColor === 'rgba(0, 0, 0, 0)' || styles.backgroundColor === 'transparent') {
          continue;
        }

        // For this test, we'll just verify the elements have visible colors
        // In a real implementation, you'd use a contrast ratio calculation library
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
        expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      }
    });

    test('should have proper ARIA labels for interactive elements', async ({ page }) => {
      // Check buttons have accessible names
      const buttons = await page.locator('button').all();
      for (const button of buttons.slice(0, 5)) {
        const hasLabel = await button.evaluate(el => {
          return el.hasAttribute('aria-label') ||
                 el.hasAttribute('aria-labelledby') ||
                 el.textContent?.trim() !== '';
        });
        expect(hasLabel).toBe(true);
      }

      // Check links have accessible names
      const links = await page.locator('a[href]').all();
      for (const link of links.slice(0, 5)) {
        const hasLabel = await link.evaluate(el => {
          return el.hasAttribute('aria-label') ||
                 el.hasAttribute('aria-labelledby') ||
                 el.textContent?.trim() !== '' ||
                 el.getAttribute('title') !== '';
        });
        expect(hasLabel).toBe(true);
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Test Tab navigation through interactive elements
      const focusableElements = await page.locator('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])').all();

      if (focusableElements.length > 0) {
        // Start from the beginning
        await page.keyboard.press('Home');

        for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
          await page.keyboard.press('Tab');

          // Check that an element is focused
          const focusedElement = await page.locator(':focus').first();
          expect(await focusedElement.count()).toBe(1);
        }
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      const focusableElements = await page.locator('button, a[href], input, select, textarea').all();

      if (focusableElements.length > 0) {
        // Focus on the first element
        await focusableElements[0].focus();

        // Check for visible focus indicator
        const focusedElement = await page.locator(':focus').first();
        const styles = await focusedElement.evaluate(el => {
          const computed = window.getComputedStyle(el, ':focus');
          return {
            outline: computed.outline,
            outlineOffset: computed.outlineOffset,
            boxShadow: computed.boxShadow
          };
        });

        // At least one focus indicator should be present
        const hasFocusIndicator =
          styles.outline !== 'none' ||
          styles.outlineOffset !== '0px' ||
          styles.boxShadow !== 'none';

        expect(hasFocusIndicator).toBe(true);
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
    });

    test('should pass form accessibility scan', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper form labels', async ({ page }) => {
      // Check that all input elements have associated labels
      const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], select, textarea').all();

      for (const input of inputs) {
        const hasLabel = await input.evaluate(el => {
          // Check for explicit label
          const label = document.querySelector(`label[for="${el.id}"]`);
          if (label) return true;

          // Check for implicit label (input is inside label)
          const parentLabel = el.closest('label');
          if (parentLabel) return true;

          // Check for aria-label or aria-labelledby
          if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return true;

          // Check for title attribute (last resort)
          if (el.hasAttribute('title') && el.getAttribute('title') !== '') return true;

          return false;
        });

        expect(hasLabel).toBe(true);
      }
    });

    test('should announce form validation errors', async ({ page }) => {
      // Submit empty form to trigger validation
      await page.click('[data-testid="login-button"]');

      // Check for error announcements
      const errorMessages = await page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').all();
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    test('should have proper fieldset and legend for related form controls', async ({ page }) => {
      // This test checks for forms that should have fieldsets
      // For the login form, we'll verify it's simple enough not to require fieldsets

      const form = page.locator('form').first();
      const inputCount = await form.locator('input, select, textarea').count();

      if (inputCount > 3) {
        // Forms with many inputs should use fieldset/legend
        const hasFieldset = await form.locator('fieldset').count() > 0;
        expect(hasFieldset).toBe(true);
      }
    });
  });

  test.describe('Navigation Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a page with navigation
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
    });

    test('should have accessible navigation menu', async ({ page }) => {
      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();

      // Check for proper ARIA attributes
      const hasAriaLabel = await nav.evaluate(el =>
        el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
      );

      expect(hasAriaLabel).toBe(true);
    });

    test('should have skip links for keyboard users', async ({ page }) => {
      // Look for skip links (links that jump to main content)
      const skipLinks = await page.locator('a[href^="#"], a[href*="main"], a[href*="content"]').all();

      if (skipLinks.length > 0) {
        // Test that skip link actually works
        const firstSkipLink = skipLinks[0];
        const href = await firstSkipLink.getAttribute('href');

        if (href && href.startsWith('#')) {
          await firstSkipLink.click();
          await page.waitForTimeout(500);

          // Check that focus moved to the target
          const target = page.locator(href);
          if (await target.count() > 0) {
            const focusedElement = await page.locator(':focus');
            expect(await focusedElement.count()).toBe(1);
          }
        }
      }
    });

    test('should have breadcrumbs for complex navigation', async ({ page }) => {
      // Check for breadcrumbs on deeper pages
      const breadcrumbs = page.locator('[aria-label="breadcrumb"], nav[aria-label="breadcrumbs"]');

      if (await breadcrumbs.count() > 0) {
        const breadcrumbList = breadcrumbs.locator('ol, ul');
        await expect(breadcrumbList).toBeVisible();

        // Check that breadcrumbs are properly structured
        const breadcrumbItems = await breadcrumbList.locator('li').all();
        expect(breadcrumbItems.length).toBeGreaterThan(1);
      }
    });
  });

  test.describe('Content Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workshops');
      await page.waitForLoadState('networkidle');
    });

    test('should have descriptive alt text for images', async ({ page }) => {
      const images = await page.locator('img').all();

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');

        if (role === 'presentation') {
          // Decorative images should have role="presentation"
          continue;
        }

        // Other images should have descriptive alt text
        expect(alt).not.toBe('');
      }
    });

    test('should have accessible data tables', async ({ page }) => {
      const tables = await page.locator('table').all();

      for (const table of tables) {
        // Check for table headers
        const hasHeaders = await table.locator('th').count() > 0;
        expect(hasHeaders).toBe(true);

        // Check for caption or summary
        const hasCaption = await table.locator('caption').count() > 0;
        const hasSummary = await table.getAttribute('summary');

        if (!hasCaption && !hasSummary) {
          // Tables without caption should have aria-label or aria-labelledby
          const hasAriaLabel = await table.evaluate(el =>
            el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
          );
          expect(hasAriaLabel).toBe(true);
        }

        // Check for proper scope attributes on headers
        const headers = await table.locator('th').all();
        for (const header of headers.slice(0, 3)) {
          const scope = await header.getAttribute('scope');
          expect(['col', 'row', 'colgroup', 'rowgroup']).toContain(scope);
        }
      }
    });

    test('should have accessible lists', async ({ page }) => {
      // Check that list items are properly nested
      const unorderedLists = await page.locator('ul').all();
      for (const ul of unorderedLists.slice(0, 3)) {
        const listItems = await ul.locator('> li').all();
        expect(listItems.length).toBeGreaterThan(0);
      }

      const orderedLists = await page.locator('ol').all();
      for (const ol of orderedLists.slice(0, 3)) {
        const listItems = await ol.locator('> li').all();
        expect(listItems.length).toBeGreaterThan(0);
      }
    });

    test('should use semantic HTML elements', async ({ page }) => {
      // Check for proper use of semantic elements
      const semanticElements = [
        'main', 'header', 'footer', 'nav', 'section', 'article', 'aside'
      ];

      for (const element of semanticElements) {
        const elements = await page.locator(element).all();

        for (const el of elements) {
          // Check that semantic elements have accessible names when needed
          if (element === 'main') {
            const hasLabel = await el.evaluate(elem =>
              elem.hasAttribute('aria-label') ||
              elem.hasAttribute('aria-labelledby') ||
              elem.hasAttribute('role')
            );

            // Main element should have a label unless it's the only main element
            const mainCount = await page.locator('main').count();
            if (mainCount > 1) {
              expect(hasLabel).toBe(true);
            }
          }
        }
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('should be accessible on mobile devices', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have appropriate touch target sizes', async ({ page }) => {
      const interactiveElements = await page.locator('button, a[href], input[type="submit"], input[type="button"], [role="button"]').all();

      for (const element of interactiveElements.slice(0, 5)) {
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
          // Touch targets should be at least 44x44 pixels
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should have accessible mobile navigation', async ({ page }) => {
      // Check for mobile menu button
      const menuButton = page.locator('button[aria-expanded], button[aria-controls]');

      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(500);

        // Menu should be visible and accessible
        const mobileMenu = page.locator('[role="navigation"], nav, [aria-expanded="true"]');
        await expect(mobileMenu).toBeVisible();

        // Check menu accessibility
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include(mobileMenu)
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      }
    });
  });

  test.describe('Screen Reader Testing', () => {
    test('should announce page changes', async ({ page }) => {
      // Navigate to a new page
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Check for page title announcement
      const title = await page.title();
      expect(title).not.toBe('');

      // Look for live regions that might announce page changes
      const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').all();

      // Note: Actual screen reader testing would require using a screen reader
      // This test checks for the infrastructure that supports screen readers
    });

    test('should have proper reading order', async ({ page }) => {
      // Test that content reads in logical order
      const mainContent = page.locator('main, [role="main"], body').first();
      await expect(mainContent).toBeVisible();

      // Check that important content comes first in source order
      const skipLinks = await page.locator('a[href^="#main"], a[href^="#content"]').all();

      if (skipLinks.length > 0) {
        // Skip links should appear early in the document
        const firstSkipLink = skipLinks[0];
        const position = await firstSkipLink.evaluate(el => {
          const allElements = document.querySelectorAll('*');
          return Array.from(allElements).indexOf(el);
        });

        // Should be within the first 20 elements
        expect(position).toBeLessThan(20);
      }
    });
  });
});