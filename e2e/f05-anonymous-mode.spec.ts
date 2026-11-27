import { expect, test } from '@playwright/test';
import { signIn, signOut } from './auth';

test('STS-F05-09: saves anonymous mode and renders the pending form and metadata-only confirmation', async ({ page }) => {
  const title = `F-05 UI ${Date.now()}`;
  let surveyId = '';

  await signIn(page, 'owner1@survey.local', '/owner/surveys');
  await page.getByRole('link', { name: /New Survey/ }).click();
  await page.getByLabel('Survey Title').fill(title);
  const mode = page.getByLabel('Response privacy');
  await expect(mode).toHaveValue('IDENTIFIED');
  await mode.selectOption('ANONYMOUS');

  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/surveys') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Save Draft' }).click();
  const created = await createResponse;
  expect(created.status()).toBe(201);
  surveyId = (await created.json()).data.id;
  await expect(page).toHaveURL(/\/owner\/surveys$/);

  await page.goto(`/owner/surveys/${surveyId}/edit`);
  await expect(page.getByLabel('Response privacy')).toHaveValue('ANONYMOUS');
  await signOut(page);

  const anonymousSurveyId = '00000000-0000-4000-a000-000000000091';
  const anonymousResponseId = '00000000-0000-4000-a000-000000000092';
  await page.route('**/api/surveys/active', (route) => route.fulfill({
    json: {
      success: true,
      data: [{
        id: anonymousSurveyId,
        title: 'Anonymous UI contract fixture',
        description: null,
        status: 'PUBLISHED',
        closesAt: null,
        acceptingResponses: true,
        questionCount: 1,
        hasSubmitted: false,
      }],
    },
  }));
  await page.route(`**/api/surveys/${anonymousSurveyId}/form`, (route) => route.fulfill({
    json: {
      success: true,
      data: {
        id: anonymousSurveyId,
        title: 'Anonymous UI contract fixture',
        description: null,
        status: 'PUBLISHED',
        mode: 'ANONYMOUS',
        questions: [{
          id: '00000000-0000-4000-a000-000000000093',
          prompt: 'What should improve?',
          questionType: 'SHORT_TEXT',
          isRequired: false,
          orderIndex: 0,
          options: [],
        }],
      },
    },
  }));
  await page.route(`**/api/surveys/${anonymousSurveyId}/responses/${anonymousResponseId}`, (route) => route.fulfill({
    json: {
      success: true,
      data: {
        responseId: anonymousResponseId,
        surveyId: anonymousSurveyId,
        submittedAt: '2026-11-27T00:00:00.000Z',
        mode: 'ANONYMOUS',
        answers: [],
      },
    },
  }));

  await signIn(page, 'resp1@survey.local', '/surveys');
  const survey = page.locator('li').filter({ hasText: 'Anonymous UI contract fixture' });
  await survey.getByRole('link', { name: 'Start survey' }).click();
  await expect(page.getByRole('status')).toContainText('This survey is configured for anonymous responses, which are not available yet. No response has been submitted.');
  await expect(page.getByRole('button', { name: 'Submit response' })).toHaveCount(0);

  await page.goto(`/surveys/${anonymousSurveyId}/confirmation/${anonymousResponseId}`);
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('This anonymous confirmation contains no answers. Keep the response ID for your records.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your answers' })).toHaveCount(0);
});
