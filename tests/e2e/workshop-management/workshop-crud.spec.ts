import { test, expect } from '@playwright/test';
import { generateTestData, cleanupTestData } from '../../helpers/test-data-factory';
import { authenticateUser } from '../../helpers/auth-helpers';
import { API_ENDPOINTS } from '../../fixtures/api-endpoints';

test.describe('Workshop CRUD Operations', () => {
  let authToken: string;
  let testWorkshop: any;
  let testQuestionnaire: any;

  test.beforeAll(async ({ request }) => {
    // Authenticate and get token
    const authResponse = await authenticateUser(request);
    authToken = authResponse.token;
  });

  test.beforeEach(async () => {
    // Create fresh test data for each test
    testWorkshop = generateTestData('workshop');
    testQuestionnaire = generateTestData('questionnaire');
  });

  test.afterEach(async ({ request }) => {
    // Cleanup test data
    await cleanupTestData(request, authToken, [testWorkshop, testQuestionnaire]);
  });

  test.describe('Workshop Creation', () => {
    test('should create a new workshop with valid data', async ({ page, request }) => {
      // Navigate to workshop creation page
      await page.goto('/workshops/create');
      await page.waitForLoadState('networkidle');

      // Fill in workshop details
      await page.fill('[data-testid="workshop-title"]', testWorkshop.title);
      await page.fill('[data-testid="workshop-description"]', testWorkshop.description);

      // Set workshop dates
      await page.fill('[data-testid="workshop-start-date"]', testWorkshop.startDate);
      await page.fill('[data-testid="workshop-end-date"]', testWorkshop.endDate);

      // Add questionnaire (if exists)
      if (testQuestionnaire) {
        await page.click('[data-testid="add-questionnaire-btn"]');
        await page.selectOption('[data-testid="questionnaire-select"]', testQuestionnaire.id);
      }

      // Set capacity and other settings
      await page.fill('[data-testid="workshop-capacity"]', testWorkshop.capacity.toString());
      await page.check('[data-testid="workshop-public"]');

      // Submit form
      await page.click('[data-testid="workshop-submit-btn"]');

      // Verify successful creation
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Workshop created successfully');

      // Verify workshop appears in list
      await page.goto('/workshops');
      await expect(page.locator(`[data-testid="workshop-${testWorkshop.id}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="workshop-title-${testWorkshop.id}"]`)).toContainText(testWorkshop.title);
    });

    test('should validate required fields on workshop creation', async ({ page }) => {
      await page.goto('/workshops/create');

      // Try to submit empty form
      await page.click('[data-testid="workshop-submit-btn"]');

      // Check validation messages
      await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="description-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="date-error"]')).toBeVisible();

      // Verify submit button is disabled until validation passes
      await expect(page.locator('[data-testid="workshop-submit-btn"]')).toBeDisabled();
    });

    test('should prevent duplicate workshop titles', async ({ page, request }) => {
      // Create first workshop via API
      const firstWorkshop = generateTestData('workshop');
      await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: firstWorkshop
      });

      // Try to create workshop with same title via UI
      await page.goto('/workshops/create');
      await page.fill('[data-testid="workshop-title"]', firstWorkshop.title);
      await page.fill('[data-testid="workshop-description"]', 'Different description');

      // Should show duplicate validation error
      await page.click('[data-testid="workshop-submit-btn"]');
      await expect(page.locator('[data-testid="duplicate-title-error"]')).toBeVisible();
    });
  });

  test.describe('Workshop Reading/Viewing', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop via API for testing
      const response = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await response.json()).id;
    });

    test('should display workshop details correctly', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}`);

      // Verify all workshop details are displayed
      await expect(page.locator('[data-testid="workshop-title"]')).toContainText(testWorkshop.title);
      await expect(page.locator('[data-testid="workshop-description"]')).toContainText(testWorkshop.description);
      await expect(page.locator('[data-testid="workshop-start-date"]')).toContainText(testWorkshop.startDate);
      await expect(page.locator('[data-testid="workshop-end-date"]')).toContainText(testWorkshop.endDate);
      await expect(page.locator('[data-testid="workshop-capacity"]')).toContainText(testWorkshop.capacity.toString());
    });

    test('should show enrollment statistics', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}`);

      // Verify enrollment stats section
      await expect(page.locator('[data-testid="enrollment-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-enrollments"]')).toBeVisible();
      await expect(page.locator('[data-testid="available-spaces"]')).toBeVisible();
    });

    test('should handle non-existent workshop gracefully', async ({ page }) => {
      await page.goto('/workshops/non-existent-id');

      // Should show 404 or not found message
      await expect(page.locator('[data-testid="not-found-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="not-found-message"]')).toContainText('Workshop not found');
    });
  });

  test.describe('Workshop Updating', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop via API
      const response = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await response.json()).id;
    });

    test('should update workshop details successfully', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}/edit`);

      // Update workshop details
      const updatedTitle = `${testWorkshop.title} - Updated`;
      const updatedDescription = `${testWorkshop.description} - Updated`;

      await page.fill('[data-testid="workshop-title"]', updatedTitle);
      await page.fill('[data-testid="workshop-description"]', updatedDescription);

      // Submit update
      await page.click('[data-testid="workshop-update-btn"]');

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Workshop updated successfully');

      // Verify changes are reflected
      await page.goto(`/workshops/${testWorkshop.id}`);
      await expect(page.locator('[data-testid="workshop-title"]')).toContainText(updatedTitle);
      await expect(page.locator('[data-testid="workshop-description"]')).toContainText(updatedDescription);
    });

    test('should validate workshop date logic', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}/edit`);

      // Try to set end date before start date
      await page.fill('[data-testid="workshop-start-date"]', '2024-12-15');
      await page.fill('[data-testid="workshop-end-date"]', '2024-12-10');

      // Should show validation error
      await page.click('[data-testid="workshop-update-btn"]');
      await expect(page.locator('[data-testid="date-logic-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="date-logic-error"]')).toContainText('End date must be after start date');
    });

    test('should prevent updating capacity below current enrollments', async ({ page, request }) => {
      // Create some enrollments first
      for (let i = 0; i < 5; i++) {
        const enrollment = generateTestData('enrollment');
        await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/enrollments`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { ...enrollment, workshopId: testWorkshop.id }
        });
      }

      await page.goto(`/workshops/${testWorkshop.id}/edit`);

      // Try to set capacity lower than current enrollments
      await page.fill('[data-testid="workshop-capacity"]', '3');

      // Should show validation error
      await page.click('[data-testid="workshop-update-btn"]');
      await expect(page.locator('[data-testid="capacity-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="capacity-error"]')).toContainText('Capacity cannot be less than current enrollments');
    });
  });

  test.describe('Workshop Deletion', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop via API
      const response = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await response.json()).id;
    });

    test('should delete workshop with confirmation', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}`);

      // Click delete button
      await page.click('[data-testid="workshop-delete-btn"]');

      // Should show confirmation dialog
      await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-confirmation-message"]')).toContainText(testWorkshop.title);

      // Confirm deletion
      await page.click('[data-testid="confirm-delete-btn"]');

      // Verify success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Workshop deleted successfully');

      // Redirect to workshops list
      await expect(page).toHaveURL('/workshops');

      // Verify workshop no longer exists
      await expect(page.locator(`[data-testid="workshop-${testWorkshop.id}"]`)).not.toBeVisible();
    });

    test('should cancel deletion when confirmation is rejected', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}`);

      // Click delete button
      await page.click('[data-testid="workshop-delete-btn"]');

      // Cancel deletion
      await page.click('[data-testid="cancel-delete-btn"]');

      // Should remain on workshop page
      await expect(page).toHaveURL(`/workshops/${testWorkshop.id}`);

      // Workshop should still exist
      await expect(page.locator('[data-testid="workshop-title"]')).toContainText(testWorkshop.title);
    });

    test('should prevent deletion of workshop with active enrollments', async ({ page, request }) => {
      // Create active enrollment
      const enrollment = generateTestData('enrollment');
      await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/enrollments`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { ...enrollment, workshopId: testWorkshop.id }
      });

      await page.goto(`/workshops/${testWorkshop.id}`);

      // Delete button should be disabled or show warning
      await expect(page.locator('[data-testid="workshop-delete-btn"]')).toBeDisabled();
      // OR
      await expect(page.locator('[data-testid="active-enrollments-warning"]')).toBeVisible();
    });
  });

  test.describe('Workshop Search and Filtering', () => {
    test.beforeAll(async ({ request }) => {
      // Create multiple workshops for search testing
      const workshops = [
        { ...generateTestData('workshop'), title: 'JavaScript Advanced Workshop' },
        { ...generateTestData('workshop'), title: 'Python Beginner Workshop' },
        { ...generateTestData('workshop'), title: 'React Development Workshop' },
        { ...generateTestData('workshop'), title: 'Node.js Backend Workshop' }
      ];

      for (const workshop of workshops) {
        await request.post(API_ENDPOINTS.WORKSHOPS, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: workshop
        });
      }
    });

    test('should search workshops by title', async ({ page }) => {
      await page.goto('/workshops');

      // Search for "JavaScript"
      await page.fill('[data-testid="workshop-search"]', 'JavaScript');
      await page.press('[data-testid="workshop-search"]', 'Enter');

      // Should show only JavaScript workshop
      await expect(page.locator('[data-testid="workshop-list"] >> text=JavaScript Advanced Workshop')).toBeVisible();
      await expect(page.locator('[data-testid="workshop-list"] >> text=Python')).not.toBeVisible();
    });

    test('should filter workshops by date range', async ({ page }) => {
      await page.goto('/workshops');

      // Set date filters
      await page.fill('[data-testid="filter-start-date"]', '2024-12-01');
      await page.fill('[data-testid="filter-end-date"]', '2024-12-31');
      await page.click('[data-testid="apply-filters-btn"]');

      // Should apply date filter (verification depends on test data dates)
      await expect(page.locator('[data-testid="workshop-list"]')).toBeVisible();
    });

    test('should sort workshops by different criteria', async ({ page }) => {
      await page.goto('/workshops');

      // Test sorting by date (newest first)
      await page.selectOption('[data-testid="sort-select"]', 'date-desc');
      await expect(page.locator('[data-testid="workshop-list"]')).toBeVisible();

      // Test sorting by title (A-Z)
      await page.selectOption('[data-testid="sort-select"]', 'title-asc');
      await expect(page.locator('[data-testid="workshop-list"]')).toBeVisible();

      // Test sorting by capacity (high to low)
      await page.selectOption('[data-testid="sort-select"]', 'capacity-desc');
      await expect(page.locator('[data-testid="workshop-list"]')).toBeVisible();
    });
  });

  test.describe('Workshop Enrollment Management', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop via API
      const response = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await response.json()).id;
    });

    test('should display enrollment list', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}/enrollments`);

      // Should show enrollment management interface
      await expect(page.locator('[data-testid="enrollment-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="enrollment-count"]')).toBeVisible();
    });

    test('should export enrollment data', async ({ page }) => {
      await page.goto(`/workshops/${testWorkshop.id}/enrollments`);

      // Click export button
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-enrollments-btn"]');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('enrollments');
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
    });

    test('should manage enrollment waitlist', async ({ page, request }) => {
      // Fill workshop capacity
      for (let i = 0; i < testWorkshop.capacity; i++) {
        const enrollment = generateTestData('enrollment');
        await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/enrollments`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { ...enrollment, workshopId: testWorkshop.id }
        });
      }

      // Create waitlist enrollment
      const waitlistEnrollment = generateTestData('enrollment');
      await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/enrollments`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { ...waitlistEnrollment, workshopId: testWorkshop.id, waitlisted: true }
      });

      await page.goto(`/workshops/${testWorkshop.id}/enrollments`);

      // Should show waitlist section
      await expect(page.locator('[data-testid="waitlist-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="waitlist-count"]')).toContainText('1');
    });
  });
});