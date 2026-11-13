import { expect, test, type Page } from '@playwright/test';

const password = 'Password123!';
const seedSurveyId = '00000000-0000-4000-a000-000000000001';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('STS-E2E-01: owner publishes, respondent submits, and owner sees persisted summary', async ({ page }) => {
  const title = `Sprint 1 E2E ${Date.now()}`;
  let surveyId = '';
  page.on('response', async (response) => {
    if (response.url().endsWith('/api/surveys') && response.status() === 201) {
      surveyId = (await response.json()).data.id;
    }
  });

  await signIn(page, 'owner1@survey.local');
  await page.getByRole('link', { name: /New Survey/ }).click();
  await page.getByLabel('Survey Title').fill(title);
  await page.getByRole('button', { name: '+ Single Choice' }).click();
  await page.getByPlaceholder('e.g. How satisfied are you with the course?').fill('Was this survey useful?');
  await page.getByRole('textbox', { name: 'Question 1 Option 1' }).fill('Yes');
  await page.getByRole('textbox', { name: 'Question 1 Option 2' }).fill('No');
  await page.getByRole('button', { name: 'Publish Survey' }).click();
  await expect(page.getByText(title)).toBeVisible();
  expect(surveyId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.getByRole('button', { name: 'Log out' }).click();
  await signIn(page, 'resp1@survey.local');
  await page.locator('li').filter({ hasText: title }).getByRole('link', { name: 'Start survey' }).click();
  await page.getByLabel('Yes', { exact: true }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await signIn(page, 'owner1@survey.local');
  await page.goto(`/owner/surveys/${surveyId}/summary`);
  await expect(page.getByText('Total responses').locator('..').getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Yes percentage' })).toHaveAttribute('aria-valuenow', '100');
});

test('STS-E2E-02: duplicate, cross-receipt access, and a logged-out token are rejected', async ({ page }) => {
  await signIn(page, 'resp1@survey.local');
  await page.goto('/surveys');
  await page.locator('li').filter({ hasText: 'CPE 334 Midterm Feedback' }).getByRole('link', { name: 'Start survey' }).click();
  await page.getByLabel('Too Fast', { exact: true }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();

  const responseId = new URL(page.url()).pathname.split('/').at(-1)!;
  const firstToken = await page.evaluate(() => localStorage.getItem('token'));
  const formResponse = await page.request.get(new URL(`/api/surveys/${seedSurveyId}/form`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  const form = (await formResponse.json()).data;
  const question = form.questions.find((item: { questionType: string }) => item.questionType === 'SINGLE_CHOICE');
  const duplicate = await page.request.post(new URL(`/api/surveys/${seedSurveyId}/responses`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${firstToken}` },
    data: { answers: [{ questionId: question.id, selectedOptionIds: [question.options[0].id] }] },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe('DUPLICATE_SUBMISSION');

  await page.getByRole('button', { name: 'Log out' }).click();
  await signIn(page, 'resp2@survey.local');
  await page.goto(`/surveys/${seedSurveyId}/confirmation/${responseId}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Too Fast', { exact: true })).toHaveCount(0);

  const secondToken = await page.evaluate(() => localStorage.getItem('token'));
  const forbiddenReceipt = await page.request.get(new URL(`/api/surveys/${seedSurveyId}/responses/${responseId}`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  expect(forbiddenReceipt.status()).toBe(403);
  expect((await forbiddenReceipt.json()).error.code).toBe('FORBIDDEN_CROSS_RESPONSE_ACCESS');
  const logout = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Log out' }).click();
  expect((await logout).status()).toBe(200);

  const reusedToken = await page.request.get(new URL('/api/auth/me', page.url()).toString(), {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  expect(reusedToken.status()).toBe(401);
  expect((await reusedToken.json()).error.code).toBe('TOKEN_REVOKED');
});
