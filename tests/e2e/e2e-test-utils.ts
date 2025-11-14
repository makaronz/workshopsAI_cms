/**
 * E2E Test Utilities
 * Common utilities and helpers for Playwright end-to-end tests
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { faker } from '@faker-js/faker'

// Types for test data
export interface TestUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: string
}

export interface TestWorkshop {
  title: string
  description: string
  slug: string
  maxParticipants: number
  price: number
  location: string
  startDate: string
  endDate: string
  tags: string[]
}

// Test data factory
export class TestDataFactory {
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      email: overrides.email || faker.internet.email(),
      password: overrides.password || 'TestPassword123!',
      firstName: overrides.firstName || faker.person.firstName(),
      lastName: overrides.lastName || faker.person.lastName(),
      role: overrides.role || 'user',
      ...overrides
    }
  }

  static createAdminUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'admin',
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      ...overrides
    })
  }

  static createWorkshop(overrides: Partial<TestWorkshop> = {}): TestWorkshop {
    const title = overrides.title || faker.lorem.words(3)
    return {
      title,
      description: overrides.description || faker.lorem.paragraph(),
      slug: overrides.slug || faker.helpers.slugify(title).toLowerCase(),
      maxParticipants: overrides.maxParticipants || faker.number.int({ min: 10, max: 50 }),
      price: overrides.price || faker.number.float({ min: 99, max: 999, fractionDigits: 2 }),
      location: overrides.location || faker.location.city(),
      startDate: overrides.startDate || faker.date.future().toISOString().split('T')[0],
      endDate: overrides.endDate || faker.date.future().toISOString().split('T')[0],
      tags: overrides.tags || faker.helpers.arrayElements(['javascript', 'typescript', 'react', 'nodejs', 'testing'], 3),
      ...overrides
    }
  }
}

// Authentication utilities
export class AuthUtils {
  static async login(page: Page, user: TestUser): Promise<void> {
    await page.goto('/login')

    // Fill login form
    await page.fill('[data-testid="email-input"]', user.email)
    await page.fill('[data-testid="password-input"]', user.password)

    // Submit form
    await page.click('[data-testid="login-button"]')

    // Wait for successful login (redirect to dashboard)
    await expect(page).toHaveURL(/dashboard|profile/)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  }

  static async logout(page: Page): Promise<void> {
    // Click user menu
    await page.click('[data-testid="user-menu"]')

    // Click logout
    await page.click('[data-testid="logout-button"]')

    // Wait for redirect to login page
    await expect(page).toHaveURL('/login')
  }

  static async signup(page: Page, user: TestUser): Promise<void> {
    await page.goto('/signup')

    // Fill signup form
    await page.fill('[data-testid="first-name-input"]', user.firstName)
    await page.fill('[data-testid="last-name-input"]', user.lastName)
    await page.fill('[data-testid="email-input"]', user.email)
    await page.fill('[data-testid="password-input"]', user.password)
    await page.fill('[data-testid="confirm-password-input"]', user.password)

    // Accept terms if present
    const termsCheckbox = page.locator('[data-testid="terms-checkbox"]')
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check()
    }

    // Submit form
    await page.click('[data-testid="signup-button"]')

    // Wait for successful signup
    await expect(page).toHaveURL(/dashboard|profile|verify-email/)
  }

  static async resetPassword(page: Page, email: string): Promise<void> {
    await page.goto('/forgot-password')

    // Fill email
    await page.fill('[data-testid="email-input"]', email)

    // Submit form
    await page.click('[data-testid="reset-button"]')

    // Wait for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  }
}

// Page navigation utilities
export class NavigationUtils {
  static async navigateToWorkshops(page: Page): Promise<void> {
    await page.goto('/workshops')
    await expect(page).toHaveTitle(/Workshops/)
  }

  static async navigateToDashboard(page: Page): Promise<void> {
    await page.goto('/dashboard')
    await expect(page).toHaveTitle(/Dashboard/)
  }

  static async navigateToProfile(page: Page): Promise<void> {
    await page.goto('/profile')
    await expect(page).toHaveTitle(/Profile/)
  }

  static async navigateToWorkshop(page: Page, workshopId: string): Promise<void> {
    await page.goto(`/workshops/${workshopId}`)
    await expect(page.locator('[data-testid="workshop-detail"]')).toBeVisible()
  }

  static async navigateToCreateWorkshop(page: Page): Promise<void> {
    await page.goto('/workshops/create')
    await expect(page.locator('[data-testid="create-workshop-form"]')).toBeVisible()
  }
}

// Form interaction utilities
export class FormUtils {
  static async fillWorkshopForm(page: Page, workshop: TestWorkshop): Promise<void> {
    await page.fill('[data-testid="workshop-title"]', workshop.title)
    await page.fill('[data-testid="workshop-description"]', workshop.description)
    await page.fill('[data-testid="workshop-location"]', workshop.location)
    await page.fill('[data-testid="workshop-max-participants"]', workshop.maxParticipants.toString())
    await page.fill('[data-testid="workshop-price"]', workshop.price.toString())
    await page.fill('[data-testid="workshop-start-date"]', workshop.startDate)
    await page.fill('[data-testid="workshop-end-date"]', workshop.endDate)

    // Add tags
    const tagsInput = page.locator('[data-testid="workshop-tags"]')
    for (const tag of workshop.tags) {
      await tagsInput.fill(tag)
      await page.keyboard.press('Enter')
    }
  }

  static async fillProfileForm(page: Page, user: TestUser): Promise<void> {
    await page.fill('[data-testid="first-name-input"]', user.firstName)
    await page.fill('[data-testid="last-name-input"]', user.lastName)
    await page.fill('[data-testid="email-input"]', user.email)
  }

  static async fillQuestionnaireForm(page: Page, answers: Record<string, any>): Promise<void> {
    for (const [questionId, answer] of Object.entries(answers)) {
      const questionSelector = `[data-testid="question-${questionId}"]`

      // Handle different question types
      if (typeof answer === 'string' || typeof answer === 'number') {
        const input = page.locator(`${questionSelector} input, ${questionSelector} textarea`)
        if (await input.isVisible()) {
          await input.fill(answer.toString())
        }
      } else if (Array.isArray(answer)) {
        // Handle multiple choice
        for (const option of answer) {
          const optionSelector = `${questionSelector} input[value="${option}"], ${questionSelector} [data-value="${option}"]`
          await page.check(optionSelector)
        }
      }
    }
  }

  static async submitForm(page: Page, buttonSelector: string = '[data-testid="submit-button"]'): Promise<void> {
    await page.click(buttonSelector)

    // Wait for form submission to complete (either success message or navigation)
    await expect(page.locator('[data-testid="success-message"], [data-testid="form-error"]')).toBeVisible({ timeout: 10000 })
  }
}

// Workshop interaction utilities
export class WorkshopUtils {
  static async searchWorkshops(page: Page, searchTerm: string): Promise<void> {
    await page.fill('[data-testid="search-input"]', searchTerm)
    await page.press('[data-testid="search-input"]', 'Enter')

    // Wait for search results
    await expect(page.locator('[data-testid="workshop-card"]')).toBeVisible()
  }

  static async filterWorkshopsByTag(page: Page, tag: string): Promise<void> {
    await page.click(`[data-testid="tag-filter-${tag}"]`)

    // Wait for filter to apply
    await expect(page.locator('[data-testid="workshop-card"]')).toBeVisible()
  }

  static async enrollInWorkshop(page: Page, workshopId: string): Promise<void> {
    await page.goto(`/workshops/${workshopId}`)

    // Click enroll button
    await page.click('[data-testid="enroll-button"]')

    // Fill enrollment questionnaire if present
    const questionnaireForm = page.locator('[data-testid="enrollment-questionnaire"]')
    if (await questionnaireForm.isVisible()) {
      // Fill form with test data
      await FormUtils.fillQuestionnaireForm(page, {
        'full-name': 'Test User',
        'email': 'test@example.com',
        'experience-level': 'intermediate'
      })

      await FormUtils.submitForm(page, '[data-testid="submit-enrollment"]')
    }

    // Verify enrollment success
    await expect(page.locator('[data-testid="enrollment-success"]')).toBeVisible()
  }

  static async createWorkshop(page: Page, workshop: TestWorkshop): Promise<string> {
    await NavigationUtils.navigateToCreateWorkshop(page)

    // Fill workshop form
    await FormUtils.fillWorkshopForm(page, workshop)

    // Submit form
    await FormUtils.submitForm(page)

    // Get workshop ID from URL or response
    const url = page.url()
    const workshopId = url.split('/').pop() || ''

    // Verify workshop was created
    await expect(page.locator('[data-testid="workshop-success"]')).toBeVisible()

    return workshopId
  }

  static async updateWorkshop(page: Page, workshopId: string, updates: Partial<TestWorkshop>): Promise<void> {
    await page.goto(`/workshops/${workshopId}/edit`)

    // Update form fields
    if (updates.title) {
      await page.fill('[data-testid="workshop-title"]', updates.title)
    }
    if (updates.description) {
      await page.fill('[data-testid="workshop-description"]', updates.description)
    }

    // Submit form
    await FormUtils.submitForm(page)

    // Verify update was successful
    await expect(page.locator('[data-testid="update-success"]')).toBeVisible()
  }
}

// Assertion utilities
export class AssertionUtils {
  static async expectElementToBeVisible(page: Page, selector: string): Promise<void> {
    await expect(page.locator(selector)).toBeVisible()
  }

  static async expectElementToBeHidden(page: Page, selector: string): Promise<void> {
    await expect(page.locator(selector)).toBeHidden()
  }

  static async expectElementToContainText(page: Page, selector: string, text: string): Promise<void> {
    await expect(page.locator(selector)).toContainText(text)
  }

  static async expectUrlToContain(page: Page, path: string): Promise<void> {
    await expect(page).toHaveURL(new RegExp(path))
  }

  static async expectSuccessMessage(page: Page): Promise<void> {
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  }

  static async expectErrorMessage(page: Page): Promise<void> {
    await expect(page.locator('[data-testid="error-message"], [data-testid="form-error"]')).toBeVisible()
  }

  static async expectLoadingSpinner(page: Page): Promise<void> {
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
  }

  static async expectLoadingSpinnerToDisappear(page: Page): Promise<void> {
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible()
  }

  static async expectWorkshopCardToExist(page: Page, workshopTitle: string): Promise<void> {
    const workshopCard = page.locator(`[data-testid="workshop-card"]:has-text("${workshopTitle}")`)
    await expect(workshopCard).toBeVisible()
  }

  static async expectWorkshopCardToNotExist(page: Page, workshopTitle: string): Promise<void> {
    const workshopCard = page.locator(`[data-testid="workshop-card"]:has-text("${workshopTitle}")`)
    await expect(workshopCard).not.toBeVisible()
  }

  static async expectUserToBeLoggedIn(page: Page, userEmail?: string): Promise<void> {
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    if (userEmail) {
      await expect(page.locator('[data-testid="user-email"]')).toContainText(userEmail)
    }
  }

  static async expectUserToBeLoggedOut(page: Page): Promise<void> {
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
  }
}

// File upload utilities
export class FileUploadUtils {
  static async uploadFile(page: Page, selector: string, fileName: string, content: string): Promise<void> {
    // Create a temporary file
    const file = await page.evaluateHandle(({ fileName, content }) => {
      const blob = new Blob([content], { type: 'text/plain' })
      const file = new File([blob], fileName, { type: 'text/plain' })
      return file
    }, { fileName, content })

    // Upload the file
    const input = page.locator(selector)
    await input.setInputFiles(file)
  }

  static async uploadImage(page: Page, selector: string, imagePath: string): Promise<void> {
    const input = page.locator(selector)
    await input.setInputFiles(imagePath)
  }
}

// Wait utilities
export class WaitUtils {
  static async waitForPageLoad(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle')
  }

  static async waitForElement(page: Page, selector: string, timeout = 10000): Promise<void> {
    await page.waitForSelector(selector, { timeout })
  }

  static async waitForElementToDisappear(page: Page, selector: string, timeout = 10000): Promise<void> {
    await page.waitForSelector(selector, { state: 'detached', timeout })
  }

  static async waitForNavigation(page: Page): Promise<void> {
    await page.waitForNavigation()
  }

  static async waitForApiResponse(page: Page, urlPattern: string): Promise<void> {
    await page.waitForResponse(response => response.url().includes(urlPattern))
  }
}

// Performance utilities
export class PerformanceUtils {
  static async measurePageLoadTime(page: Page, url: string): Promise<number> {
    const startTime = Date.now()
    await page.goto(url)
    await page.waitForLoadState('networkidle')
    return Date.now() - startTime
  }

  static async measureInteractionTime(page: Page, interaction: () => Promise<void>): Promise<number> {
    const startTime = Date.now()
    await interaction()
    return Date.now() - startTime
  }

  static async expectPageLoadToBeFast(page: Page, url: string, maxTimeMs = 3000): Promise<void> {
    const loadTime = await this.measurePageLoadTime(page, url)
    expect(loadTime).toBeLessThan(maxTimeMs)
  }
}

// Accessibility utilities
export class AccessibilityUtils {
  static async runAxe(page: Page): Promise<void> {
    const accessibilityScanResults = await page.accessibility.scan()
    expect(accessibilityScanResults.violations).toEqual([])
  }

  static async checkKeyboardNavigation(page: Page): Promise<void> {
    // Tab through all focusable elements
    await page.keyboard.press('Tab')

    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement)
    expect(focusedElement).toBeTruthy()
  }

  static async checkColorContrast(page: Page): Promise<void> {
    // Basic color contrast check
    const elements = await page.locator('*').all()

    for (const element of elements.slice(0, 10)) { // Check first 10 elements for performance
      const styles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        }
      })

      // Basic contrast check - this is simplified
      expect(styles.color).not.toBe(styles.backgroundColor)
    }
  }
}

// Visual regression utilities
export class VisualUtils {
  static async takeScreenshot(page: Page, name: string): Promise<void> {
    await page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    })
  }

  static async expectPageToMatchScreenshot(page: Page, name: string, threshold = 0.1): Promise<void> {
    await expect(page).toHaveScreenshot(name, {
      threshold,
      fullPage: true,
      animations: 'disabled'
    })
  }

  static async expectElementToMatchScreenshot(page: Page, selector: string, name: string): Promise<void> {
    const element = page.locator(selector)
    await expect(element).toHaveScreenshot(name, {
      animations: 'disabled'
    })
  }
}

// Mobile-specific utilities
export class MobileUtils {
  static async simulateMobileViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 375, height: 667 })
  }

  static async simulateTabletViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 768, height: 1024 })
  }

  static async swipe(page: Page, startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await page.touchstart(startX, startY)
    await page.touchmove(endX, endY)
    await page.touchend()
  }

  static async pinchToZoom(page: Page, element: string): Promise<void> {
    const locator = page.locator(element)
    const box = await locator.boundingBox()

    if (box) {
      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2

      // Simulate pinch gesture
      await page.touchstart(centerX - 50, centerY - 50)
      await page.touchstart(centerX + 50, centerY + 50)
      await page.touchmove(centerX - 25, centerY - 25)
      await page.touchmove(centerX + 25, centerY + 25)
      await page.touchend()
      await page.touchend()
    }
  }
}

// Export all utilities
export {
  TestDataFactory,
  AuthUtils,
  NavigationUtils,
  FormUtils,
  WorkshopUtils,
  AssertionUtils,
  FileUploadUtils,
  WaitUtils,
  PerformanceUtils,
  AccessibilityUtils,
  VisualUtils,
  MobileUtils
}