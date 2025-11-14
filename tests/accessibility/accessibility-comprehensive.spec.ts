import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations, reportViolations } from '@axe-core/playwright';
import { createAccessibilityReport } from '../helpers/accessibility-reporter';

test.describe('Comprehensive Accessibility Testing', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test.describe('Main Navigation', () => {
    test('should have accessible navigation menu', async ({ page }) => {
      await page.goto('/');

      // Check navigation landmark
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const firstNavLink = page.locator('nav a').first();
      await expect(firstNavLink).toBeFocused();

      // Test skip link functionality
      await expect(page.locator('[data-testid="skip-to-content"]')).toBeVisible();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Should skip to main content
      const mainContent = page.locator('main');
      await expect(mainContent).toBeFocused();
    });

    test('should maintain focus trap in mobile menu', async ({ page }) => {
      await page.goto('/');

      // Open mobile menu
      await page.setViewportSize({ width: 375, height: 667 });
      await page.click('[data-testid="mobile-menu-toggle"]');

      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await expect(mobileMenu).toBeVisible();

      // Test focus trap
      await page.keyboard.press('Tab');
      const firstFocusable = mobileMenu.locator('a, button').first();
      await expect(firstFocusable).toBeFocused();

      // Tab through menu items
      const focusableElements = await mobileMenu.locator('a, button').all();
      for (let i = 0; i < focusableElements.length; i++) {
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }

      // Should cycle back to first element
      await page.keyboard.press('Tab');
      await expect(firstFocusable).toBeFocused();

      // Test Escape key closes menu
      await page.keyboard.press('Escape');
      await expect(mobileMenu).not.toBeVisible();
    });

    test('should have proper ARIA labels on navigation', async ({ page }) => {
      await page.goto('/');

      // Check ARIA labels
      await expect(page.locator('nav')).toHaveAttribute('aria-label', 'Main navigation');

      // Check menu button labels
      const mobileMenuToggle = page.locator('[data-testid="mobile-menu-toggle"]');
      await expect(mobileMenuToggle).toHaveAttribute('aria-label', 'Toggle navigation menu');
      await expect(mobileMenuToggle).toHaveAttribute('aria-expanded', 'false');

      // Check sub-menu items
      const subMenus = page.locator('[data-testid="sub-menu"]');
      for (const subMenu of await subMenus.all()) {
        await expect(subMenu).toHaveAttribute('aria-label');
        const button = subMenu.locator('button');
        await expect(button).toHaveAttribute('aria-expanded');
      }
    });
  });

  test.describe('Workshop Management Pages', () => {
    test('should be accessible workshop creation form', async ({ page }) => {
      await page.goto('/workshops/create');

      // Check form accessibility
      await checkA11y(page);

      // Test form field labeling
      const titleInput = page.locator('[data-testid="workshop-title"]');
      await expect(titleInput).toHaveAttribute('aria-label');
      await expect(titleInput).toHaveAttribute('required');

      // Test error messaging accessibility
      await page.click('[data-testid="workshop-submit-btn"]');

      const errorMessages = page.locator('[data-testid*="-error"]');
      for (const error of await errorMessages.all()) {
        await expect(error).toHaveAttribute('role', 'alert');
        await expect(error).toHaveAttribute('aria-live', 'polite');
      }

      // Test form validation announcements
      await expect(page.locator('[data-testid="form-errors-summary"]')).toHaveAttribute('role', 'alert');
    });

    test('should have accessible workshop list with sorting and filtering', async ({ page }) => {
      await page.goto('/workshops');

      // Check table accessibility
      const workshopTable = page.locator('[data-testid="workshop-table"]');
      await expect(workshopTable).toHaveAttribute('role', 'table');

      // Check table headers
      const headers = workshopTable.locator('th');
      for (const header of await headers.all()) {
        await expect(header).toHaveAttribute('scope', 'col');
        if (await header.locator('button').isVisible()) {
          await expect(header.locator('button')).toHaveAttribute('aria-label');
        }
      }

      // Test filter accessibility
      const filters = page.locator('[data-testid="filters"]');
      const filterInputs = filters.locator('input, select');
      for (const input of await filterInputs.all()) {
        await expect(input).toHaveAttribute('aria-label');
      }

      // Check results announcement
      const resultsCount = page.locator('[data-testid="results-count"]');
      await expect(resultsCount).toHaveAttribute('aria-live', 'polite');
    });

    test('should have accessible workshop detail view', async ({ page }) => {
      // Create a workshop or navigate to existing one
      await page.goto('/workshops/test-workshop-id');

      // Check main content structure
      const main = page.locator('main');
      await expect(main).toHaveAttribute('role', 'main');

      // Check heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();

      const h2s = page.locator('h2');
      for (let i = 0; i < await h2s.count(); i++) {
        const h2 = h2s.nth(i);
        await expect(h2).toHaveText(/./); // Non-empty text
      }

      // Check action buttons accessibility
      const actionButtons = page.locator('[data-testid^="workshop-action-"]');
      for (const button of await actionButtons.all()) {
        await expect(button).toHaveAttribute('aria-label');
        if (await button.getAttribute('aria-disabled') === 'true') {
          await expect(button).toHaveAttribute('tabindex', '-1');
        }
      }
    });
  });

  test.describe('Questionnaire Interface', () => {
    test('should be accessible questionnaire form', async ({ page }) => {
      await page.goto('/questionnaires/test-id/respond');

      // Check questionnaire structure
      await expect(page.locator('[role="form"]')).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();

      // Check question accessibility
      const questions = page.locator('[data-testid^="question-"]');
      for (const question of await questions.all()) {
        // Check question labeling
        const questionText = question.locator('[data-testid="question-text"]');
        await expect(questionText).toHaveAttribute('id');

        const questionInput = question.locator('input, textarea, select');
        for (const input of await questionInput.all()) {
          await expect(input).toHaveAttribute('aria-labelledby', await questionText.getAttribute('id'));
        }

        // Check required field indicators
        if (await question.locator('[data-testid="required-indicator"]').isVisible()) {
          const requiredInput = question.locator('input, textarea, select').first();
          await expect(requiredInput).toHaveAttribute('aria-required', 'true');
        }
      }

      // Check error handling
      await page.click('[data-testid="submit-btn"]');
      const errors = page.locator('[data-testid="validation-error"]');
      for (const error of await errors.all()) {
        await expect(error).toHaveAttribute('role', 'alert');
      }
    });

    test('should have accessible multiple choice questions', async ({ page }) => {
      await page.goto('/questionnaires/test-id/respond');

      // Find multiple choice question
      const multipleChoice = page.locator('[data-testid="question-type-multiple-choice"]').first();
      if (await multipleChoice.isVisible()) {
        // Check radio button grouping
        const radioGroup = multipleChoice.locator('[role="radiogroup"]');
        await expect(radioGroup).toBeVisible();

        const radioButtons = radioGroup.locator('input[type="radio"]');
        for (let i = 0; i < await radioButtons.count(); i++) {
          const radio = radioButtons.nth(i);
          const label = multipleChoice.locator(`label[for="${await radio.getAttribute('id')}"]`);
          await expect(label).toBeVisible();
          await expect(label).toHaveText(/./);
        }

        // Test keyboard navigation
        await radioButtons.first().focus();
        await page.keyboard.press('ArrowDown');
        const secondRadio = radioButtons.nth(1);
        await expect(secondRadio).toBeChecked();
      }
    });

    test('should have accessible text input questions', async ({ page }) => {
      await page.goto('/questionnaires/test-id/respond');

      const textQuestions = page.locator('[data-testid="question-type-text"]');
      for (const question of await textQuestions.all()) {
        const textInput = question.locator('input[type="text"], textarea');

        // Check accessibility attributes
        await expect(textInput).toHaveAttribute('aria-label');
        if (await question.locator('[data-testid="required-indicator"]').isVisible()) {
          await expect(textInput).toHaveAttribute('aria-required', 'true');
        }

        // Check character count if present
        const charCount = question.locator('[data-testid="character-count"]');
        if (await charCount.isVisible()) {
          await expect(charCount).toHaveAttribute('aria-live', 'polite');
        }

        // Test error handling
        await textInput.fill('');
        await page.keyboard.press('Tab');
        if (await question.locator('[data-testid="required-error"]').isVisible()) {
          const error = question.locator('[data-testid="required-error"]');
          await expect(error).toHaveAttribute('role', 'alert');
          await expect(textInput).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
        }
      }
    });
  });

  test.describe('Data Visualizations and Charts', () => {
    test('should have accessible charts and graphs', async ({ page }) => {
      await page.goto('/analytics/dashboard');

      // Check chart accessibility
      const charts = page.locator('[data-testid^="chart-"]');
      for (const chart of await charts.all()) {
        // Check for alternative text
        await expect(chart).toHaveAttribute('aria-label');

        // Check for data table alternative
        const dataTable = chart.locator('[data-testid="data-table-alternative"]');
        if (await dataTable.isVisible()) {
          await expect(dataTable).toHaveAttribute('role', 'table');
          await expect(dataTable.locator('caption')).toBeVisible();
        }

        // Check for keyboard navigation support
        if (await chart.locator('svg').isVisible()) {
          await chart.click();
          const focused = page.locator(':focus');
          await expect(focused).toBeVisible();
        }
      }
    });

    test('should have accessible progress indicators', async ({ page }) => {
      await page.goto('/dashboard');

      const progressBars = page.locator('[data-testid="progress-bar"]');
      for (const progress of await progressBars.all()) {
        await expect(progress).toHaveAttribute('role', 'progressbar');
        await expect(progress).toHaveAttribute('aria-valuenow');
        await expect(progress).toHaveAttribute('aria-valuemin');
        await expect(progress).toHaveAttribute('aria-valuemax');

        // Check for accessible label
        const label = progress.locator('[data-testid="progress-label"]');
        if (await label.isVisible()) {
          await expect(progress).toHaveAttribute('aria-labelledby', await label.getAttribute('id'));
        }
      }
    });
  });

  test.describe('Modal and Dialog Accessibility', () => {
    test('should have accessible modal dialogs', async ({ page }) => {
      await page.goto('/workshops');

      // Open confirmation modal
      await page.click('[data-testid="delete-workshop-btn"]');

      const modal = page.locator('[data-testid="confirmation-modal"]');
      await expect(modal).toBeVisible();

      // Check modal accessibility attributes
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-modal', 'true');
      await expect(modal).toHaveAttribute('aria-labelledby');

      // Check focus management
      const closeButton = modal.locator('[data-testid="close-modal"]');
      await expect(closeButton).toBeFocused();

      // Test focus trap
      await page.keyboard.press('Tab');
      const focusableElements = modal.locator('button, input, select, textarea, a[href]');
      let isFocusTrapped = true;

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        if (!(await modal.locator(focused).isVisible())) {
          isFocusTrapped = false;
          break;
        }
      }

      expect(isFocusTrapped).toBe(true);

      // Test Escape key
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();

      // Test focus restoration
      const restoreTarget = page.locator('[data-testid="delete-workshop-btn"]');
      await expect(restoreTarget).toBeFocused();
    });

    test('should have accessible notification toasts', async ({ page }) => {
      await page.goto('/');

      // Trigger notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { type: 'success', message: 'Test notification' }
        }));
      });

      const notification = page.locator('[data-testid="notification"]');
      await expect(notification).toBeVisible();

      // Check accessibility
      await expect(notification).toHaveAttribute('role', 'alert');
      await expect(notification).toHaveAttribute('aria-live', 'assertive');

      // Check close button accessibility
      const closeBtn = notification.locator('[data-testid="notification-close"]');
      await expect(closeBtn).toHaveAttribute('aria-label', 'Close notification');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async ({ page }) => {
      await page.goto('/');

      // Test tab navigation order
      const focusableElements = page.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      let previousElement = null;

      for (let i = 0; i < await focusableElements.count(); i++) {
        await page.keyboard.press('Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();

        if (previousElement) {
          const currentElement = await currentFocus.evaluate(el => el.tagName + (el.className ? '.' + el.className : ''));
          const previousElementTag = await previousElement.evaluate(el => el.tagName + (el.className ? '.' + el.className : ''));
          expect(currentElement).not.toBe(previousElementTag);
        }

        previousElement = currentFocus;
      }

      // Test reverse tab navigation
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Shift+Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }

      // Test Enter and Space key activation
      const button = page.locator('button').first();
      await button.focus();
      await page.keyboard.press('Enter');

      const link = page.locator('a').first();
      await link.focus();
      await page.keyboard.press('Enter');
    });

    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');

      // Test focus visibility on different elements
      const focusableElements = page.locator('a, button, input, select, textarea');

      for (let i = 0; i < Math.min(5, await focusableElements.count()); i++) {
        const element = focusableElements.nth(i);
        await element.focus();

        // Check for visible focus indicator
        const computedStyle = await element.evaluate((el) => {
          const style = window.getComputedStyle(el, ':focus');
          return {
            outline: style.outline,
            outlineColor: style.outlineColor,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow
          };
        });

        // Should have some visible focus indicator
        const hasFocusIndicator =
          computedStyle.outline !== 'none' ||
          computedStyle.boxShadow !== 'none' ||
          computedStyle.outlineWidth !== '0px';

        expect(hasFocusIndicator).toBe(true);
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should provide appropriate semantic markup', async ({ page }) => {
      await page.goto('/');

      // Check landmarks
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();

      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      let previousLevel = 0;

      for (let i = 0; i < await headings.count(); i++) {
        const heading = headings.nth(i);
        const level = parseInt(await heading.evaluate(el => el.tagName.substring(1)));

        // Heading levels should not skip (h1 to h3 without h2)
        expect(level - previousLevel).toBeLessThanOrEqual(1);
        previousLevel = level;
      }

      // Check list semantics
      const lists = page.locator('ul, ol');
      for (const list of await lists.all()) {
        await expect(list).toHaveAttribute('role', 'list');
        const listItems = list.locator('li');
        for (const item of await listItems.all()) {
          await expect(item).toHaveAttribute('role', 'listitem');
        }
      }
    });

    test('should have accessible form labels and descriptions', async ({ page }) => {
      await page.goto('/workshops/create');

      const formFields = page.locator('input, select, textarea');

      for (let i = 0; i < Math.min(5, await formFields.count()); i++) {
        const field = formFields.nth(i);

        // Check for explicit label
        const labelId = await field.getAttribute('aria-labelledby');
        if (labelId) {
          const label = page.locator(`#${labelId}`);
          await expect(label).toBeVisible();
        } else {
          const label = page.locator(`label[for="${await field.getAttribute('id')}"]`);
          if (await label.count() > 0) {
            await expect(label.first()).toBeVisible();
          } else {
            // Fallback to aria-label
            await expect(field).toHaveAttribute('aria-label');
          }
        }

        // Check for field descriptions
        const describedBy = await field.getAttribute('aria-describedby');
        if (describedBy) {
          const description = page.locator(`#${describedBy}`);
          await expect(description).toBeVisible();
        }
      }
    });

    test('should announce important state changes', async ({ page }) => {
      await page.goto('/');

      // Test loading announcements
      await page.click('[data-testid="load-more-btn"]');
      const loadingRegion = page.locator('[data-testid="loading-region"]');
      if (await loadingRegion.isVisible()) {
        await expect(loadingRegion).toHaveAttribute('aria-live', 'polite');
      }

      // Test error announcements
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('show-error', {
          detail: { message: 'Test error message' }
        }));
      });

      const errorRegion = page.locator('[data-testid="error-region"]');
      if (await errorRegion.isVisible()) {
        await expect(errorRegion).toHaveAttribute('role', 'alert');
        await expect(errorRegion).toHaveAttribute('aria-live', 'assertive');
      }
    });
  });

  test.describe('Color and Contrast', () => {
    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/');

      // Run axe color contrast checks
      await checkA11y(page, undefined, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });

      // Check custom contrast for important elements
      const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, span, a');

      for (let i = 0; i < Math.min(10, await textElements.count()); i++) {
        const element = textElements.nth(i);
        const computedStyle = await element.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontSize: parseFloat(style.fontSize)
          };
        });

        // Check for adequate text size (should be at least 14px for body text)
        expect(computedStyle.fontSize).toBeGreaterThanOrEqual(14);
      }
    });

    test('should not rely solely on color to convey information', async ({ page }) => {
      await page.goto('/');

      // Check error states
      const errorInputs = page.locator('[data-testid*="error"]');
      for (const input of await errorInputs.all()) {
        // Should have non-color indicators
        const hasErrorIcon = await input.locator('[data-testid="error-icon"]').isVisible();
        const hasErrorText = await input.locator('[data-testid="error-text"]').isVisible();
        const hasErrorAttribute = await input.getAttribute('aria-invalid') === 'true';

        expect(hasErrorIcon || hasErrorText || hasErrorAttribute).toBe(true);
      }

      // Check success states
      const successElements = page.locator('[data-testid*="success"]');
      for (const element of await successElements.all()) {
        const hasSuccessIcon = await element.locator('[data-testid="success-icon"]').isVisible();
        const hasSuccessText = await element.locator('[data-testid="success-text"]').isVisible();

        expect(hasSuccessIcon || hasSuccessText).toBe(true);
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Check touch target sizes (minimum 44x44 points)
      const interactiveElements = page.locator('a, button, input, select, textarea');

      for (let i = 0; i < Math.min(5, await interactiveElements.count()); i++) {
        const element = interactiveElements.nth(i);
        const boundingBox = await element.boundingBox();

        if (boundingBox) {
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }

      // Check for appropriate spacing between touch targets
      const navigationButtons = page.locator('nav button');
      for (let i = 1; i < await navigationButtons.count(); i++) {
        const prevButton = navigationButtons.nth(i - 1);
        const currentButton = navigationButtons.nth(i);

        const prevBox = await prevButton.boundingBox();
        const currentBox = await currentButton.boundingBox();

        if (prevBox && currentBox) {
          const horizontalSpacing = Math.abs(currentBox.x - (prevBox.x + prevBox.width));
          const verticalSpacing = Math.abs(currentBox.y - prevBox.y);

          // Should have at least 8 points spacing
          expect(horizontalSpacing >= 8 || verticalSpacing >= 8).toBe(true);
        }
      }
    });

    test('should handle orientation changes', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Test landscape orientation
      await page.setViewportSize({ width: 667, height: 375 });

      // Verify layout adapts
      await expect(page.locator('body')).toBeVisible();

      // Check that interactive elements remain functional
      const menuButton = page.locator('[data-testid="mobile-menu-toggle"]');
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      }
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should maintain accessibility during loading states', async ({ page }) => {
      await page.goto('/');

      // Test accessibility during page load
      const violations = await getViolations(page);
      expect(violations.filter(v => v.impact === 'critical')).toHaveLength(0);

      // Test accessibility during dynamic content loading
      await page.click('[data-testid="load-content-btn"]');

      // Wait for loading to complete
      await page.waitForSelector('[data-testid="content-loaded"]', { timeout: 5000 });

      // Check accessibility after content loads
      const afterLoadViolations = await getViolations(page);
      expect(afterLoadViolations.filter(v => v.impact === 'critical')).toHaveLength(0);
    });

    test('should generate comprehensive accessibility report', async ({ page }) => {
      // Test multiple pages
      const pages = ['/workshops', '/workshops/create', '/questionnaires', '/analytics'];

      for (const pageUrl of pages) {
        await page.goto(pageUrl);

        // Run comprehensive accessibility check
        const violations = await getViolations(page);

        // Log violations for reporting
        if (violations.length > 0) {
          console.log(`Accessibility violations found on ${pageUrl}:`, violations);
        }
      }

      // Generate final accessibility report
      const accessibilityReport = await createAccessibilityReport(page);

      // Check overall compliance
      expect(accessibilityReport.criticalViolations).toBe(0);
      expect(accessibilityReport.seriousViolations).toBeLessThan(5);
    });
  });
});