import { test, expect, Page } from '@playwright/test';

test.describe('Workshop Intelligence Routing', () => {
    let page: Page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
    });

    test.afterEach(async () => {
        await page.close();
    });

    test.describe('Admin Analysis View', () => {
        test.beforeEach(async () => {
            // Set up admin authentication
            await page.goto('/login');
            await page.evaluate(() => {
                localStorage.setItem('workshopsai-access-token', 'mock-admin-token');
            });

            // Mock auth verification for admin
            await page.route('**/api/auth/verify', async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } }
                    })
                });
            });
        });

        test('should navigate to analysis view from workshop list', async () => {
            // Mock workshop list
            await page.route('**/api/workshops', async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            workshops: [{
                                id: 'workshop-1',
                                titleI18n: { en: 'Test Workshop' },
                                status: 'published'
                            }]
                        }
                    })
                });
            });

            await page.goto('/dashboard/workshops');

            // Check for "AI Analysis" button
            const analysisBtn = page.locator('button:has-text("📊 AI Analysis")');
            await expect(analysisBtn).toBeVisible();

            // Click button
            await analysisBtn.click();

            // Verify navigation
            await expect(page).toHaveURL(/\/dashboard\/workshops\/workshop-1\/analysis/);

            // Verify component loaded
            await expect(page.locator('analysis-viewer')).toBeVisible();
        });
    });

    test.describe('Participant Insights View', () => {
        test.beforeEach(async () => {
            // Set up participant authentication
            await page.goto('/login');
            await page.evaluate(() => {
                localStorage.setItem('workshopsai-access-token', 'mock-participant-token');
            });

            // Mock auth verification for participant
            await page.route('**/api/auth/verify', async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: { user: { id: 'user-1', email: 'user@example.com', role: 'Participant' } }
                    })
                });
            });
        });

        test('should navigate to insights view from workshop list', async () => {
            // Mock workshop list
            await page.route('**/api/workshops', async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: {
                            workshops: [{
                                id: 'workshop-1',
                                titleI18n: { en: 'Test Workshop' },
                                status: 'published'
                            }]
                        }
                    })
                });
            });

            await page.goto('/dashboard/workshops');

            // Check for "AI Insights" button (different label for participant)
            const insightsBtn = page.locator('button:has-text("📊 AI Insights")');
            await expect(insightsBtn).toBeVisible();

            // Click button
            await insightsBtn.click();

            // Verify navigation
            await expect(page).toHaveURL(/\/dashboard\/workshops\/workshop-1\/insights/);

            // Verify component loaded
            await expect(page.locator('participant-analysis-viewer')).toBeVisible();
        });
    });
});
