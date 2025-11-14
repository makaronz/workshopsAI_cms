import { test, expect } from '@playwright/test';
import { generateTestData, cleanupTestData } from '../../helpers/test-data-factory';
import { authenticateUser } from '../../helpers/auth-helpers';
import { API_ENDPOINTS } from '../../fixtures/api-endpoints';

test.describe('Questionnaire Management Flow', () => {
  let authToken: string;
  let testWorkshop: any;
  let testQuestionnaire: any;

  test.beforeAll(async ({ request }) => {
    const authResponse = await authenticateUser(request);
    authToken = authResponse.token;
  });

  test.beforeEach(async () => {
    testWorkshop = generateTestData('workshop');
    testQuestionnaire = generateTestData('questionnaire');
  });

  test.afterEach(async ({ request }) => {
    await cleanupTestData(request, authToken, [testWorkshop, testQuestionnaire]);
  });

  test.describe('Questionnaire Creation', () => {
    test('should create questionnaire with multiple question types', async ({ page, request }) => {
      // Create workshop first
      const workshopResponse = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await workshopResponse.json()).id;

      await page.goto(`/workshops/${testWorkshop.id}/questionnaires/create`);

      // Fill in questionnaire details
      await page.fill('[data-testid="questionnaire-title"]', testQuestionnaire.title);
      await page.fill('[data-testid="questionnaire-description"]', testQuestionnaire.description);

      // Add multiple choice question
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'multiple-choice');
      await page.fill('[data-testid="question-text"]', 'What is your preferred learning style?');

      // Add choices
      await page.click('[data-testid="add-choice-btn"]');
      await page.fill('[data-testid="choice-0"]', 'Visual');
      await page.click('[data-testid="add-choice-btn"]');
      await page.fill('[data-testid="choice-1"]', 'Auditory');
      await page.click('[data-testid="add-choice-btn"]');
      await page.fill('[data-testid="choice-2"]', 'Kinesthetic');

      // Add text question
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'text');
      await page.fill('[data-testid="question-text"]', 'What are your learning goals?');

      // Add rating question
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'rating');
      await page.fill('[data-testid="question-text"]', 'Rate your current knowledge level');
      await page.selectOption('[data-testid="rating-scale"]', '5');

      // Save questionnaire
      await page.click('[data-testid="save-questionnaire-btn"]');

      // Verify successful creation
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Questionnaire created successfully');

      // Verify questions are displayed
      await expect(page.locator('[data-testid="question-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="question-0"] >> text=multiple-choice')).toBeVisible();
      await expect(page.locator('[data-testid="question-1"] >> text=text')).toBeVisible();
      await expect(page.locator('[data-testid="question-2"] >> text=rating')).toBeVisible();
    });

    test('should validate questionnaire structure', async ({ page }) => {
      await page.goto('/questionnaires/create');

      // Try to save empty questionnaire
      await page.click('[data-testid="save-questionnaire-btn"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="questions-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="questions-error"]')).toContainText('Questionnaire must have at least one question');
    });

    test('should prevent duplicate question texts within questionnaire', async ({ page }) => {
      await page.goto('/questionnaires/create');

      // Fill basic info
      await page.fill('[data-testid="questionnaire-title"]', testQuestionnaire.title);

      // Add first question
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'text');
      await page.fill('[data-testid="question-text"]', 'What are your expectations?');

      // Add duplicate question
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'text');
      await page.fill('[data-testid="question-text"]', 'What are your expectations?');

      // Should show duplicate warning
      await expect(page.locator('[data-testid="duplicate-question-warning"]')).toBeVisible();
    });
  });

  test.describe('Questionnaire Response Collection', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop and questionnaire
      const workshopResponse = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await workshopResponse.json()).id;

      const questionnaireResponse = await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/questionnaires`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testQuestionnaire
      });
      testQuestionnaire.id = (await questionnaireResponse.json()).id;
    });

    test('should collect questionnaire responses correctly', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/respond`);

      // Verify questionnaire title and instructions
      await expect(page.locator('[data-testid="questionnaire-title"]')).toContainText(testQuestionnaire.title);
      await expect(page.locator('[data-testid="questionnaire-instructions"]')).toBeVisible();

      // Respond to multiple choice question
      await page.click('[data-testid="choice-0"]'); // Select first choice

      // Respond to text question
      await page.fill('[data-testid="text-answer"]', 'I want to learn practical skills that I can apply immediately.');

      // Respond to rating question
      await page.click('[data-testid="rating-3"]'); // Select 3-star rating

      // Submit responses
      await page.click('[data-testid="submit-responses-btn"]');

      // Verify submission confirmation
      await expect(page.locator('[data-testid="submission-confirmation"]')).toBeVisible();
      await expect(page.locator('[data-testid="submission-confirmation"]')).toContainText('Thank you for completing the questionnaire');

      // Verify responses saved
      await expect(page).toHaveURL(/\/questionnaires\/.*\/confirmation/);
    });

    test('should validate required questions before submission', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/respond`);

      // Try to submit without answering required questions
      await page.click('[data-testid="submit-responses-btn"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="required-question-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="required-question-error"]')).toContainText('Please answer all required questions');

      // Highlight unanswered required questions
      await expect(page.locator('[data-testid="question-0.required"]')).toHaveClass(/error/);
    });

    test('should save draft responses', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/respond`);

      // Partially complete questionnaire
      await page.click('[data-testid="choice-1"]');
      await page.fill('[data-testid="text-answer"]', 'Partial answer');

      // Save draft (if auto-save is implemented)
      await page.click('[data-testid="save-draft-btn"]');

      // Verify draft saved message
      await expect(page.locator('[data-testid="draft-saved-message"]')).toBeVisible();

      // Navigate away and return
      await page.goto('/dashboard');
      await page.goBack();

      // Verify partial responses are restored
      await expect(page.locator('[data-testid="choice-1"]')).toBeChecked();
      await expect(page.locator('[data-testid="text-answer"]')).toHaveValue('Partial answer');
    });

    test('should handle questionnaire timeout', async ({ page, request }) => {
      // Create questionnaire with timeout
      const timedQuestionnaire = {
        ...testQuestionnaire,
        title: 'Timed Questionnaire',
        timeLimit: 300 // 5 minutes
      };

      const questionnaireResponse = await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/questionnaires`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: timedQuestionnaire
      });
      const timedId = (await questionnaireResponse.json()).id;

      await page.goto(`/questionnaires/${timedId}/respond`);

      // Verify timer is displayed
      await expect(page.locator('[data-testid="questionnaire-timer"]')).toBeVisible();
      await expect(page.locator('[data-testid="time-remaining"]')).toBeVisible();

      // Wait for time to pass (in real test, you'd manipulate the timer)
      // For demonstration, we'll simulate timeout
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('questionnaire-timeout'));
      });

      // Verify timeout handling
      await expect(page.locator('[data-testid="timeout-message"]')).BeVisible();
      await expect(page.locator('[data-testid="timeout-message"]')).toContainText('Time limit exceeded');

      // Should auto-submit partial responses or show options
      await expect(page.locator('[data-testid="timeout-options"]')).toBeVisible();
    });
  });

  test.describe('Questionnaire Analytics and Reporting', () => {
    test.beforeEach(async ({ request }) => {
      // Create workshop, questionnaire, and responses
      const workshopResponse = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await workshopResponse.json()).id;

      const questionnaireResponse = await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/questionnaires`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testQuestionnaire
      });
      testQuestionnaire.id = (await questionnaireResponse.json()).id;

      // Create sample responses
      for (let i = 0; i < 10; i++) {
        const response = generateTestData('questionnaireResponse');
        await request.post(`${API_ENDPOINTS.QUESTIONNAIRES}/${testQuestionnaire.id}/responses`, {
          headers: { Authorization: `Bearer ${authToken}` },
          data: { ...response, questionnaireId: testQuestionnaire.id }
        });
      }
    });

    test('should display response analytics', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/analytics`);

      // Verify analytics dashboard
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="response-count"]')).toContainText('10');
      await expect(page.locator('[data-testid="completion-rate"]')).toBeVisible();

      // Verify question-wise analytics
      await expect(page.locator('[data-testid="question-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="multiple-choice-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="text-response-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="rating-distribution"]')).toBeVisible();
    });

    test('should export responses in different formats', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/analytics`);

      // Test CSV export
      const csvDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-csv-btn"]');
      const csvDownload = await csvDownloadPromise;
      expect(csvDownload.suggestedFilename()).toMatch(/.*\.csv$/);

      // Test JSON export
      const jsonDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-json-btn"]');
      const jsonDownload = await jsonDownloadPromise;
      expect(jsonDownload.suggestedFilename()).toMatch(/.*\.json$/);

      // Test PDF report
      const pdfDownloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-pdf-btn"]');
      const pdfDownload = await pdfDownloadPromise;
      expect(pdfDownload.suggestedFilename()).toMatch(/.*\.pdf$/);
    });

    test('should filter and segment responses', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/analytics`);

      // Test date range filtering
      await page.fill('[data-testid="filter-start-date"]', '2024-01-01');
      await page.fill('[data-testid="filter-end-date"]', '2024-12-31');
      await page.click('[data-testid="apply-filters-btn"]');

      // Verify filtered results
      await expect(page.locator('[data-testid="filtered-response-count"]')).toBeVisible();

      // Test response status filtering
      await page.selectOption('[data-testid="response-status-filter"]', 'completed');
      await expect(page.locator('[data-testid="completed-responses"]')).toBeVisible();

      // Test response quality filtering
      await page.selectOption('[data-testid="response-quality-filter"]', 'detailed');
      await expect(page.locator('[data-testid="detailed-responses"]')).toBeVisible();
    });

    test('should generate insights and recommendations', async ({ page }) => {
      await page.goto(`/questionnaires/${testQuestionnaire.id}/analytics`);

      // Navigate to insights tab
      await page.click('[data-testid="insights-tab"]');

      // Verify automated insights
      await expect(page.locator('[data-testid="insights-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="key-findings"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommendations"]')).BeVisible();

      // Verify sentiment analysis (if implemented)
      await expect(page.locator('[data-testid="sentiment-analysis"]')).toBeVisible();
      await expect(page.locator('[data-testid="word-cloud"]')).toBeVisible();

      // Test AI-powered insights generation
      await page.click('[data-testid="generate-insights-btn"]');
      await expect(page.locator('[data-testid="insights-loading"]')).toBeVisible();
      await expect(page.locator('[data-testid="ai-insights"]')).toBeVisible();
    });
  });

  test.describe('Questionnaire Templates and Reuse', () => {
    test('should create questionnaire from template', async ({ page, request }) => {
      // Create a template questionnaire
      const templateData = {
        title: 'Feedback Template',
        description: 'Standard feedback questionnaire template',
        isTemplate: true,
        questions: [
          {
            type: 'rating',
            text: 'How satisfied were you with the workshop?',
            required: true,
            scale: 5
          },
          {
            type: 'text',
            text: 'What did you find most valuable?',
            required: true
          },
          {
            type: 'text',
            text: 'What could be improved?',
            required: false
          }
        ]
      };

      const templateResponse = await request.post(`${API_ENDPOINTS.QUESTIONNAIRES}/templates`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: templateData
      });
      const templateId = (await templateResponse.json()).id;

      await page.goto('/questionnaires/create');

      // Select template option
      await page.click('[data-testid="use-template-btn"]');

      // Choose template
      await page.selectOption('[data-testid="template-select"]', templateId);
      await page.click('[data-testid="load-template-btn"]');

      // Verify template questions loaded
      await expect(page.locator('[data-testid="question-0"]')).toContainText('How satisfied were you with the workshop?');
      await expect(page.locator('[data-testid="question-1"]')).toContainText('What did you find most valuable?');
      await expect(page.locator('[data-testid="question-2"]')).toContainText('What could be improved?');

      // Customize template
      await page.fill('[data-testid="questionnaire-title"]', 'Post-Workshop Feedback');
      await page.click('[data-testid="add-question-btn"]');
      await page.selectOption('[data-testid="question-type"]', 'multiple-choice');
      await page.fill('[data-testid="question-text"]', 'Would you recommend this workshop to others?');

      // Save customized questionnaire
      await page.click('[data-testid="save-questionnaire-btn"]');
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('should save questionnaire as template', async ({ page, request }) => {
      // Create workshop and questionnaire first
      const workshopResponse = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await workshopResponse.json()).id;

      const questionnaireResponse = await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/questionnaires`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testQuestionnaire
      });
      testQuestionnaire.id = (await questionnaireResponse.json()).id;

      await page.goto(`/questionnaires/${testQuestionnaire.id}/edit`);

      // Save as template
      await page.click('[data-testid="save-as-template-btn"]');

      // Fill template details
      await page.fill('[data-testid="template-name"]', 'Workshop Feedback Template');
      await page.fill('[data-testid="template-description"]', 'Standard template for workshop feedback collection');
      await page.selectOption('[data-testid="template-category"]', 'feedback');

      await page.click('[data-testid="confirm-template-btn"]');

      // Verify template created
      await expect(page.locator('[data-testid="template-created-message"]')).toBeVisible();

      // Verify template appears in template library
      await page.goto('/questionnaires/templates');
      await expect(page.locator('[data-testid="template-list"]')).toContainText('Workshop Feedback Template');
    });
  });

  test.describe('Real-time Questionnaire Monitoring', () => {
    test('should show live response collection', async ({ page, request }) => {
      // Create workshop and questionnaire
      const workshopResponse = await request.post(API_ENDPOINTS.WORKSHOPS, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testWorkshop
      });
      testWorkshop.id = (await workshopResponse.json()).id;

      const questionnaireResponse = await request.post(`${API_ENDPOINTS.WORKSHOPS}/${testWorkshop.id}/questionnaires`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: testQuestionnaire
      });
      testQuestionnaire.id = (await questionnaireResponse.json()).id;

      await page.goto(`/questionnaires/${testQuestionnaire.id}/monitor`);

      // Verify monitoring dashboard
      await expect(page.locator('[data-testid="live-monitoring"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-responses"]')).toBeVisible();
      await expect(page.locator('[data-testid="completion-progress"]')).toBeVisible();

      // Simulate real-time updates (via WebSocket or polling)
      // In a real scenario, you'd have another user/browser submitting responses
      await page.waitForTimeout(2000);

      // Verify live updates working
      await expect(page.locator('[data-testid="real-time-counter"]')).toBeVisible();
    });
  });
});