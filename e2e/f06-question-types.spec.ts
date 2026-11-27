import { expect, test, type Page } from '@playwright/test';
import { signIn, signOut } from './auth';

async function submitAndExpectError(page: Page, message: string) {
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('alert')).toContainText(message);
}

test('STS-F06-17/18: all question types round-trip and respondent input survives failed attempts', async ({ page }) => {
  let title = `F-06 question types ${Date.now()}`;
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
  await page.getByRole('button', { name: 'Move Question 9 up' }).click();

  const createResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/surveys') && response.request().method() === 'POST' && response.status() === 201
  );
  await page.getByRole('button', { name: 'Save Draft' }).click();
  surveyId = (await (await createResponse).json()).data.id;
  await expect(page.getByText(title)).toBeVisible();
  expect(surveyId).toMatch(/^[0-9a-f-]{36}$/i);

  let releaseDetail!: () => void;
  let resolveDetailStarted!: () => void;
  const detailGate = new Promise<void>((resolve) => { releaseDetail = resolve; });
  const detailStarted = new Promise<void>((resolve) => { resolveDetailStarted = resolve; });
  await page.route(`**/api/surveys/${surveyId}`, async (route) => {
    if (route.request().method() === 'GET') {
      resolveDetailStarted();
      await detailGate;
    }
    return route.continue();
  });
  await page.goto(`/owner/surveys/${surveyId}/edit`);
  await detailStarted;
  await expect(page.getByText('Loading survey editor...')).toBeVisible();
  releaseDetail();
  await expect(page.locator('#type-2')).toHaveValue('MULTI_CHOICE');
  await expect(page.locator('#type-7')).toHaveValue('DATE');
  await expect(page.locator('#type-8')).toHaveValue('INTEGER');
  await page.unroute(`**/api/surveys/${surveyId}`);
  await expect(page.getByLabel('Maximum selections')).toHaveValue('2');
  await expect(page.getByLabel('Minimum value (optional)')).toHaveValue('-2');

  title = `${title} edited`;
  await page.getByLabel('Survey Title').fill(title);
  const updateResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/surveys/${surveyId}`) && response.request().method() === 'PUT' && response.status() === 200
  );
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await updateResponse;
  // Saving a draft returns to the owner dashboard, so reopen the editor to
  // verify the persisted values from a fresh server read.
  await page.goto(`/owner/surveys/${surveyId}/edit`);
  await expect(page.getByLabel('Survey Title')).toHaveValue(title);
  await expect(page.locator('#type-7')).toHaveValue('DATE');
  await expect(page.locator('#type-8')).toHaveValue('INTEGER');

  await page.getByLabel('Minimum selections').fill('3');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Invalid survey structure.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Minimum selections')).toHaveValue('3');
  const ownerToken = await page.evaluate(() => localStorage.getItem('token'));
  const persisted = await page.request.get(new URL(`/api/surveys/${surveyId}`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  expect(persisted.status()).toBe(200);
  const savedDraft = (await persisted.json()).data;
  expect(savedDraft.questions[2]).toMatchObject({ minSelections: 1, maxSelections: 2 });
  expect(savedDraft.questions[7].questionType).toBe('DATE');
  const savedQuestionId = (questionType: string) =>
    (savedDraft.questions as Array<{ id: string; questionType: string }>).find((question) => question.questionType === questionType)!.id;

  await page.route(`**/api/surveys/${surveyId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({
        success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to save draft.' },
      }) });
    }
    return route.continue();
  });
  await page.getByLabel('Survey Title').fill('Unsaved server failure');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to save draft.');
  await expect(page.getByLabel('Survey Title')).toHaveValue('Unsaved server failure');
  await page.unroute(`**/api/surveys/${surveyId}`);

  let releaseSave!: () => void;
  let resolveSaveStarted!: () => void;
  const releaseGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  const saveStarted = new Promise<void>((resolve) => { resolveSaveStarted = resolve; });
  await page.route(`**/api/surveys/${surveyId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      resolveSaveStarted();
      await releaseGate;
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.getByLabel('Survey Title').fill('Unsaved network failure');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await saveStarted;
  await expect(page.getByRole('button', { name: 'Saving...' }).first()).toBeDisabled();
  releaseSave();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Survey Title')).toHaveValue('Unsaved network failure');
  await page.unroute(`**/api/surveys/${surveyId}`);

  await page.getByRole('button', { name: 'Reload saved draft' }).click();
  await page.getByRole('button', { name: 'Discard and reload' }).click();
  await expect(page.getByLabel('Survey Title')).toHaveValue(title);
  await expect(page.getByLabel('Maximum selections')).toHaveValue('2');
  await expect(page.locator('#type-7')).toHaveValue('DATE');
  await page.getByRole('button', { name: 'Publish Survey' }).click();
  await expect(page.getByText(title)).toBeVisible();

  let releaseSummary!: () => void;
  let resolveSummaryStarted!: () => void;
  const summaryGate = new Promise<void>((resolve) => { releaseSummary = resolve; });
  const summaryStarted = new Promise<void>((resolve) => { resolveSummaryStarted = resolve; });
  await page.route(`**/api/surveys/${surveyId}/summary`, async (route) => {
    resolveSummaryStarted();
    await summaryGate;
    return route.continue();
  });
  await page.goto(`/owner/surveys/${surveyId}/summary`);
  await summaryStarted;
  await expect(page.getByRole('status', { name: 'Loading survey summary' })).toBeVisible();
  releaseSummary();
  await expect(page.getByText('No numeric answers yet.')).toHaveCount(2);
  await expect(page.getByText('No date answers yet.')).toBeVisible();
  await page.unroute(`**/api/surveys/${surveyId}/summary`);

  await page.route(`**/api/surveys/${surveyId}/summary`, (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Summary service unavailable.' } }),
  }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Summary service unavailable.');
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  await page.unroute(`**/api/surveys/${surveyId}/summary`);

  await page.route(`**/api/surveys/${surveyId}/summary`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        surveyId,
        title,
        description: null,
        status: 'PUBLISHED',
        mode: 'IDENTIFIED',
        totalResponses: 1,
        createdAt: '2026-11-27T00:00:00.000Z',
        questions: [
          { questionId: savedQuestionId('RATING'), prompt: 'Question 7', questionType: 'RATING', answeredCount: 1, numberStats: { count: 1, average: 5, min: 5, max: 5 }, ratingDistribution: [{ rating: 5, count: 1 }] },
          { questionId: savedQuestionId('INTEGER'), prompt: 'Question 8', questionType: 'INTEGER', answeredCount: 0, numberStats: { count: 0, average: null, min: null, max: null } },
          { questionId: savedQuestionId('DATE'), prompt: 'Question 9', questionType: 'DATE', answeredCount: 0, dateCounts: [] },
        ],
      },
    }),
  }));
  await page.reload();
  await expect(page.getByText('Total responses').locator('..')).toContainText('1');
  await expect(page.locator('[aria-label="Question 7 numeric summary"]')).toContainText('Average');
  await expect(page.locator('[aria-label="Question 8 numeric summary"]')).toContainText('No numeric answers yet.');
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
  await expect(page.getByRole('main')).not.toContainText('SURVEY_OWNER');
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

  const respondentToken = await page.evaluate(() => localStorage.getItem('token'));
  const formResponse = await page.request.get(new URL(`/api/surveys/${surveyId}/form`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${respondentToken}` },
  });
  expect(formResponse.status()).toBe(200);
  const form = (await formResponse.json()).data;
  const questions = form.questions as Array<{ id: string; questionType: string; options: Array<{ id: string; label: string }> }>;
  const byType = (type: string) => questions.find((question) => question.questionType === type)!;
  const inputByType = (type: string) => page.locator(`[id="${byType(type).id}-input"]`);

  await inputByType('SINGLE_CHOICE').check();
  await inputByType('SHORT_TEXT').fill('Sprint 1 text');
  await inputByType('MULTI_CHOICE').check();
  await page.locator(`input[value="${byType('MULTI_CHOICE').options[1].id}"]`).check();
  await inputByType('LONG_TEXT').fill('A longer answer');
  await page.locator(`input[value="${byType('YES_NO').options[1].id}"]`).check();
  await page.locator(`input[value="${byType('LIKERT').options[3].id}"]`).check();
  await page.locator(`input[name="${byType('RATING').id}"]`).nth(4).check();
  await inputByType('INTEGER').fill('-2');
  await inputByType('DATE').fill('2024-02-29');

  const expectAllAnswers = async (integerValue = '-2', shortText = 'Sprint 1 text') => {
    await expect(inputByType('SINGLE_CHOICE')).toBeChecked();
    await expect(inputByType('SHORT_TEXT')).toHaveValue(shortText);
    await expect(page.locator(`input[value="${byType('MULTI_CHOICE').options[0].id}"]`)).toBeChecked();
    await expect(page.locator(`input[value="${byType('MULTI_CHOICE').options[1].id}"]`)).toBeChecked();
    await expect(inputByType('LONG_TEXT')).toHaveValue('A longer answer');
    await expect(page.locator(`input[value="${byType('YES_NO').options[1].id}"]`)).toBeChecked();
    await expect(page.locator(`input[value="${byType('LIKERT').options[3].id}"]`)).toBeChecked();
    await expect(page.locator(`input[name="${byType('RATING').id}"]`).nth(4)).toBeChecked();
    await expect(inputByType('INTEGER')).toHaveValue(integerValue);
    await expect(inputByType('DATE')).toHaveValue('2024-02-29');
  };

  let releaseNetworkFailure!: () => void;
  let resolveNetworkRequest!: () => void;
  const networkFailureGate = new Promise<void>((resolve) => { releaseNetworkFailure = resolve; });
  const networkRequestStarted = new Promise<void>((resolve) => { resolveNetworkRequest = resolve; });
  const responseId = '90000000-0000-4000-8000-000000000001';
  let attempts = 0;
  let postedAnswers: Array<Record<string, unknown>> = [];
  await page.route(`**/api/surveys/${surveyId}/responses`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts++;
    postedAnswers = route.request().postDataJSON().answers;
    const errors = [
      { status: 400, code: 'INVALID_ANSWER', message: 'Enter a whole number within the allowed bounds.', details: [{ field: 'answers.8.numberValue', message: 'Enter a whole number within the allowed bounds.' }] },
      { status: 400, code: 'MISSING_REQUIRED_QUESTIONS', message: 'Please complete all required questions.', details: { questionIds: [byType('SHORT_TEXT').id] } },
      { status: 409, code: 'DUPLICATE_SUBMISSION', message: 'You have already submitted a response to this survey.' },
      { status: 400, code: 'SURVEY_NOT_ACCEPTING_RESPONSES', message: 'This survey is no longer accepting responses.' },
      { status: 500, code: 'INTERNAL_ERROR', message: 'Unable to submit response.' },
    ];
    if (attempts === 6) {
      resolveNetworkRequest();
      await networkFailureGate;
      return route.abort('failed');
    }
    const failure = errors[attempts - 1];
    if (failure) {
      return route.fulfill({ status: failure.status, contentType: 'application/json', body: JSON.stringify({
        success: false, error: { code: failure.code, message: failure.message, details: 'details' in failure ? failure.details : undefined },
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

  await inputByType('INTEGER').fill('11');
  await submitAndExpectError(page, 'Please correct the highlighted answers.');
  await expect(page.getByText('Enter a whole number within the allowed bounds.')).toBeVisible();
  expect(attempts).toBe(0);
  await expectAllAnswers('11');
  await inputByType('INTEGER').fill('-2');

  await submitAndExpectError(page, 'Please correct the highlighted answers.');
  await expectAllAnswers();
  await submitAndExpectError(page, 'Please complete all required questions.');
  await expectAllAnswers();
  await expect(page.getByText('This question is required.')).toBeVisible();
  await submitAndExpectError(page, 'You have already submitted a response to this survey.');
  await expectAllAnswers();
  await submitAndExpectError(page, 'This survey is no longer accepting responses.');
  await expectAllAnswers();
  await submitAndExpectError(page, 'Unable to submit response.');
  await expectAllAnswers();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await networkRequestStarted;
  await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  await expectAllAnswers();
  releaseNetworkFailure();
  await expect(page.getByRole('alert')).toBeVisible();
  await expectAllAnswers();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('2024-02-29', { exact: true })).toBeVisible();
  expect(attempts).toBe(7);

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
