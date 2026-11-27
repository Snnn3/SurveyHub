import { expect, test, type Page } from '@playwright/test';
import { signIn, signOut } from './auth';

async function submitAndExpectError(page: Page, message: string) {
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('alert')).toContainText(message);
}

test('STS-F06-17/18: all question types round-trip and respondent input survives failed attempts', async ({ page }) => {
  const title = `F-06 question types ${Date.now()}`;
  let surveyId = '';

  await signIn(page, 'owner1@survey.local', '/owner/surveys');
  await page.getByRole('link', { name: /New Survey/ }).click();
  await page.getByLabel('Survey Title').fill(title);
  await page.getByRole('button', { name: '+ Single Choice' }).click();
  await page.getByRole('button', { name: '+ Short Text' }).click();
  for (const type of ['MULTI_CHOICE', 'LONG_TEXT', 'YES_NO', 'LIKERT', 'RATING', 'INTEGER', 'DATE']) {
    await page.getByLabel('Additional question type').selectOption(type);
  }
  for (let index = 0; index < 9; index++) {
    await page.locator(`#prompt-${index}`).fill(`Question ${index + 1}`);
  }
  await page.getByRole('textbox', { name: 'Question 1 Option 1' }).fill('Yes');
  await page.getByRole('textbox', { name: 'Question 1 Option 2' }).fill('No');
  await page.getByRole('textbox', { name: 'Question 3 Option 1' }).fill('A');
  await page.getByRole('textbox', { name: 'Question 3 Option 2' }).fill('B');
  await page.getByLabel('Minimum selections').fill('1');
  await page.getByLabel('Maximum selections').fill('2');
  await page.getByLabel('Minimum value (optional)').fill('-2');
  await page.getByLabel('Maximum value (optional)').fill('10');

  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/surveys') && response.request().method() === 'POST' && response.status() === 201
  );
  await page.getByRole('button', { name: 'Save Draft' }).click();
  surveyId = (await (await createResponse).json()).data.id;
  await expect(page.getByText(title)).toBeVisible();
  expect(surveyId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto(`/owner/surveys/${surveyId}/edit`);
  await expect(page.locator('#type-2')).toHaveValue('MULTI_CHOICE');
  await expect(page.getByLabel('Maximum selections')).toHaveValue('2');
  await expect(page.getByLabel('Minimum value (optional)')).toHaveValue('-2');
  await page.getByLabel('Maximum selections').fill('1');
  await page.getByRole('button', { name: 'Reload saved draft' }).click();
  await page.getByRole('button', { name: 'Discard and reload' }).click();
  await expect(page.getByLabel('Maximum selections')).toHaveValue('2');
  await page.getByRole('button', { name: 'Publish Survey' }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.goto(`/owner/surveys/${surveyId}/summary`);
  await expect(page.getByText('No numeric answers yet.')).toHaveCount(2);
  await expect(page.getByText('No date answers yet.')).toBeVisible();

  const deniedEnvelope = {
    success: false,
    error: { code: 'FORBIDDEN_ROLE', message: 'Access denied', details: { requiredRole: 'SURVEY_OWNER' } },
  };
  await page.route(`**/api/surveys/${surveyId}/summary`, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(deniedEnvelope) }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('FORBIDDEN_ROLE');
  await expect(page.locator('body')).not.toContainText('SURVEY_OWNER');
  await page.unroute(`**/api/surveys/${surveyId}/summary`);

  await page.route(`**/api/surveys/${surveyId}`, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(deniedEnvelope) }));
  await page.goto(`/owner/surveys/${surveyId}/edit`);
  await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('FORBIDDEN_ROLE');
  await page.unroute(`**/api/surveys/${surveyId}`);

  await signOut(page);
  await signIn(page, 'resp1@survey.local', '/surveys');
  await page.locator('li').filter({ hasText: title }).getByRole('link', { name: 'Start survey' }).click();

  const token = await page.evaluate(() => localStorage.getItem('token'));
  const formResponse = await page.request.get(new URL(`/api/surveys/${surveyId}/form`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(formResponse.status()).toBe(200);
  const form = (await formResponse.json()).data;
  const questions = form.questions as Array<{ id: string; questionType: string; options: Array<{ id: string; label: string }> }>;
  const byType = (type: string) => questions.find((question) => question.questionType === type)!;

  await page.locator(`#${byType('SINGLE_CHOICE').id}-input`).check();
  await page.locator(`#${byType('SHORT_TEXT').id}-input`).fill('Sprint 1 text');
  await page.locator(`#${byType('MULTI_CHOICE').id}-input`).check();
  await page.locator(`input[value="${byType('MULTI_CHOICE').options[1].id}"]`).check();
  await page.locator(`#${byType('LONG_TEXT').id}-input`).fill('A longer answer');
  await page.locator(`input[value="${byType('YES_NO').options[1].id}"]`).check();
  await page.locator(`input[value="${byType('LIKERT').options[3].id}"]`).check();
  await page.locator(`input[name="${byType('RATING').id}"]`).nth(4).check();
  await page.locator(`#${byType('INTEGER').id}-input`).fill('-2');
  await page.locator(`#${byType('DATE').id}-input`).fill('2024-02-29');

  const responseId = '90000000-0000-4000-8000-000000000001';
  let attempts = 0;
  let postedAnswers: Array<Record<string, unknown>> = [];
  await page.route(`**/api/surveys/${surveyId}/responses`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts++;
    postedAnswers = route.request().postDataJSON().answers;
    const errors = [
      { status: 409, code: 'DUPLICATE_SUBMISSION', message: 'You have already submitted a response to this survey.' },
      { status: 400, code: 'SURVEY_NOT_ACCEPTING_RESPONSES', message: 'This survey is no longer accepting responses.' },
      { status: 500, code: 'INTERNAL_ERROR', message: 'Unable to submit response.' },
    ];
    const failure = errors[attempts - 1];
    if (failure) {
      return route.fulfill({ status: failure.status, contentType: 'application/json', body: JSON.stringify({
        success: false, error: { code: failure.code, message: failure.message },
      }) });
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      success: true,
      data: { responseId, surveyId, submittedAt: '2026-11-27T00:00:00.000Z', message: 'Survey response successfully recorded.' },
    }) });
  });
  await page.route(`**/api/surveys/${surveyId}/responses/${responseId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          responseId,
          surveyId,
          submittedAt: '2026-11-27T00:00:00.000Z',
          mode: 'IDENTIFIED',
          answers: [
            { questionId: byType('RATING').id, prompt: 'Question 7', questionType: 'RATING', textValue: null, numberValue: 5, selectedOptionIds: [], selectedOptions: [] },
            { questionId: byType('INTEGER').id, prompt: 'Question 8', questionType: 'INTEGER', textValue: null, numberValue: -2, selectedOptionIds: [], selectedOptions: [] },
            { questionId: byType('DATE').id, prompt: 'Question 9', questionType: 'DATE', textValue: null, dateValue: '2024-02-29', selectedOptionIds: [], selectedOptions: [] },
          ],
        },
      }),
    });
  });

  await submitAndExpectError(page, 'You have already submitted a response to this survey.');
  await expect(page.locator(`#${byType('LONG_TEXT').id}-input`)).toHaveValue('A longer answer');
  await submitAndExpectError(page, 'This survey is no longer accepting responses.');
  await expect(page.locator(`#${byType('DATE').id}-input`)).toHaveValue('2024-02-29');
  await submitAndExpectError(page, 'Unable to submit response.');
  await expect(page.locator(`#${byType('INTEGER').id}-input`)).toHaveValue('-2');
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('2024-02-29', { exact: true })).toBeVisible();
  expect(attempts).toBe(4);

  const value = (type: string) => postedAnswers.find((answer) => answer.questionId === byType(type).id)!;
  expect(value('SINGLE_CHOICE')).toHaveProperty('selectedOptionIds', [byType('SINGLE_CHOICE').options[0].id]);
  expect(value('MULTI_CHOICE')).toHaveProperty('selectedOptionIds', [byType('MULTI_CHOICE').options[0].id, byType('MULTI_CHOICE').options[1].id]);
  expect(value('SHORT_TEXT')).toHaveProperty('textValue', 'Sprint 1 text');
  expect(value('LONG_TEXT')).toHaveProperty('textValue', 'A longer answer');
  expect(value('YES_NO')).toHaveProperty('selectedOptionIds', [byType('YES_NO').options[1].id]);
  expect(value('LIKERT')).toHaveProperty('selectedOptionIds', [byType('LIKERT').options[3].id]);
  expect(value('RATING')).toHaveProperty('numberValue', 5);
  expect(value('INTEGER')).toHaveProperty('numberValue', -2);
  expect(value('DATE')).toHaveProperty('dateValue', '2024-02-29');
});
