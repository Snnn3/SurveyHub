import { expect, test, type Page } from '@playwright/test';

const password = 'Password123!';
const seedSurveyId = '00000000-0000-4000-a000-000000000001';
type HomePath = '/owner/surveys' | '/surveys';

async function signIn(page: Page, email: string, home: HomePath): Promise<void> {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  const loginResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);

  await expect(page).toHaveURL(new RegExp(`${home}$`));
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  const logoutResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Log out' }).click();
  expect((await logoutResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email')).toBeVisible();
}

test('STS-E2E-01: owner publishes, respondent submits, and owner sees persisted summary', async ({ page }) => {
  const title = `Sprint 1 E2E ${Date.now()}`;
  let surveyId = '';
  page.on('response', async (response) => {
    if (response.url().endsWith('/api/surveys') && response.status() === 201) {
      surveyId = (await response.json()).data.id;
    }
  });

  await signIn(page, 'owner1@survey.local', '/owner/surveys');
  await page.getByRole('link', { name: /New Survey/ }).click();
  await page.getByLabel('Survey Title').fill(title);
  await page.getByRole('button', { name: '+ Single Choice' }).click();
  await page.getByPlaceholder('e.g. How satisfied are you with the course?').fill('Was this survey useful?');
  await page.getByRole('textbox', { name: 'Question 1 Option 1' }).fill('Yes');
  await page.getByRole('textbox', { name: 'Question 1 Option 2' }).fill('No');
  await page.getByRole('button', { name: 'Publish Survey' }).click();
  await expect(page.getByText(title)).toBeVisible();
  expect(surveyId).toMatch(/^[0-9a-f-]{36}$/i);

  await signOut(page);
  await signIn(page, 'resp1@survey.local', '/surveys');
  const survey = page.locator('li').filter({ hasText: title });
  await expect(survey.getByRole('link', { name: 'Start survey' })).toBeVisible();
  await survey.getByRole('link', { name: 'Start survey' }).click();
  await page.getByLabel('Yes', { exact: true }).check();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your response is recorded' })).toBeVisible();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, 'owner1@survey.local', '/owner/surveys');
  await page.goto(`/owner/surveys/${surveyId}/summary`);
  await expect(page.getByText('Total responses').locator('..').getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Yes percentage' })).toHaveAttribute('aria-valuenow', '100');
});

test('STS-E2E-02: duplicate, cross-receipt access, and a logged-out token are rejected', async ({ page }) => {
  await signIn(page, 'resp1@survey.local', '/surveys');
  const survey = page.locator('li').filter({ hasText: 'CPE 334 Midterm Feedback' });
  await expect(survey.getByRole('link', { name: 'Start survey' })).toBeVisible();
  await survey.getByRole('link', { name: 'Start survey' }).click();
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

  await signOut(page);
  await signIn(page, 'resp2@survey.local', '/surveys');
  await page.goto(`/surveys/${seedSurveyId}/confirmation/${responseId}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Too Fast', { exact: true })).toHaveCount(0);

  const secondToken = await page.evaluate(() => localStorage.getItem('token'));
  const forbiddenReceipt = await page.request.get(new URL(`/api/surveys/${seedSurveyId}/responses/${responseId}`, page.url()).toString(), {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  expect(forbiddenReceipt.status()).toBe(403);
  expect((await forbiddenReceipt.json()).error.code).toBe('FORBIDDEN_CROSS_RESPONSE_ACCESS');
  await signOut(page);

  const reusedToken = await page.request.get(new URL('/api/auth/me', page.url()).toString(), {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  expect(reusedToken.status()).toBe(401);
  expect((await reusedToken.json()).error.code).toBe('TOKEN_REVOKED');
});
