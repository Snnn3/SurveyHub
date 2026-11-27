import { expect, test } from '@playwright/test';
import { signIn } from './auth';

const surveyId = '00000000-0000-4000-a000-000000000091';
const eligibilityUrl = `**/api/surveys/${surveyId}/eligibility`;
const scheduleUrl = `**/api/surveys/${surveyId}/schedule`;

test('STS-S2-03-06 / STS-S2-04-05: owner manages and reloads eligibility and schedule settings', async ({ page }) => {
  await signIn(page, 'owner1@survey.local', '/owner/surveys');

  let eligibleRespondents = [{ userId: 'respondent-1', email: 'resp1@survey.local', fullName: 'Student Respondent One' }];
  let closesAt: string | null = '2030-01-02T03:04:05.678Z';
  let eligibilityAttempts = 0;
  let scheduleAttempts = 0;
  let submittedSchedule: { closesAt: string | null } | undefined;
  let releaseLoad!: () => void;
  const loadGate = new Promise<void>((resolve) => { releaseLoad = resolve; });

  await page.route(eligibilityUrl, async (route) => {
    if (route.request().method() === 'GET') {
      await loadGate;
      await route.fulfill({ json: { success: true, data: { surveyId, eligibleRespondents } } });
      return;
    }

    eligibilityAttempts += 1;
    if (eligibilityAttempts === 1) {
      await route.fulfill({
        status: 400,
        json: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid survey policy data.' } },
      });
      return;
    }

    const emails = route.request().postDataJSON().respondentEmails as string[];
    eligibleRespondents = emails.map((email, index) => ({
      userId: `respondent-${index + 1}`,
      email,
      fullName: 'Student Respondent One',
    }));
    await route.fulfill({ json: { success: true, data: { surveyId, eligibleRespondents } } });
  });

  await page.route(scheduleUrl, async (route) => {
    if (route.request().method() === 'GET') {
      await loadGate;
      await route.fulfill({ json: {
        success: true,
        data: { surveyId, status: 'PUBLISHED', closesAt, acceptingResponses: true },
      } });
      return;
    }

    scheduleAttempts += 1;
    submittedSchedule = route.request().postDataJSON() as { closesAt: string | null };
    if (scheduleAttempts === 1 && submittedSchedule.closesAt) {
      await route.fulfill({
        status: 500,
        json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not save schedule.' } },
      });
      return;
    }

    closesAt = submittedSchedule.closesAt ? new Date(submittedSchedule.closesAt).toISOString() : null;
    await route.fulfill({ json: {
      success: true,
      data: { surveyId, status: 'PUBLISHED', closesAt, acceptingResponses: true },
    } });
  });

  await page.goto(`/owner/surveys/${surveyId}/policies`);
  await expect(page.getByRole('status')).toContainText('Loading survey policies');
  releaseLoad();
  await expect(page.getByRole('heading', { name: 'Eligible respondents' })).toBeVisible();
  await expect(page.getByText(/^Time zone:/)).toBeVisible();
  const expectedInitialLocalTime = await page.evaluate(() => {
    const date = new Date('2030-01-02T03:04:05.678Z');
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 23);
  });
  await expect(page.locator('#closes-at')).toHaveValue(expectedInitialLocalTime);

  await page.getByLabel('Respondent emails').fill('not-an-email');
  await page.getByRole('button', { name: 'Save eligibility list' }).click();
  await expect(page.getByRole('alert')).toContainText('Validation error');

  await page.getByLabel('Respondent emails').fill('resp2@survey.local');
  await page.getByRole('button', { name: 'Save eligibility list' }).click();
  await expect(page.getByRole('status')).toContainText('Eligibility list saved.');
  await expect(page.getByLabel('Respondent emails')).toHaveValue('resp2@survey.local');

  const closeInput = page.locator('#closes-at');
  const futureLocalTime = await page.evaluate(() => {
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
    date.setMilliseconds(678);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  });
  await closeInput.fill(futureLocalTime);
  const expectedInstant = await closeInput.evaluate((input: HTMLInputElement) => new Date(input.value).toISOString());
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByRole('alert')).toContainText('Server error');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByRole('status')).toContainText('Schedule saved.');
  expect(submittedSchedule).toEqual({ closesAt: expectedInstant });

  await page.reload();
  await expect(page.locator('#closes-at')).toHaveValue(futureLocalTime);
  await page.getByRole('button', { name: 'Clear schedule' }).click();
  await expect(page.getByRole('status')).toContainText('Schedule cleared.');
  expect(submittedSchedule).toEqual({ closesAt: null });
  await expect(page.locator('#closes-at')).toHaveValue('');
});

test('STS-S2-03-06 / STS-S2-04-05: access denied hides policy data', async ({ page }) => {
  await signIn(page, 'owner2@survey.local', '/owner/surveys');
  await page.route(eligibilityUrl, (route) => route.fulfill({
    status: 403,
    json: { success: false, error: { code: 'FORBIDDEN_OWNERSHIP', message: 'You do not own this survey.' } },
  }));
  await page.route(scheduleUrl, (route) => route.fulfill({
    status: 403,
    json: { success: false, error: { code: 'FORBIDDEN_OWNERSHIP', message: 'You do not own this survey.' } },
  }));

  await page.goto(`/owner/surveys/${surveyId}/policies`);
  await expect(page.getByRole('alert')).toHaveText('Access denied.');
  await expect(page.getByRole('heading', { name: 'Eligible respondents' })).toHaveCount(0);
  await expect(page.getByText('resp1@survey.local')).toHaveCount(0);
});

test('STS-S2-03-05 / STS-S2-04-03: manually closed surveys keep settings read-only', async ({ page }) => {
  await signIn(page, 'owner1@survey.local', '/owner/surveys');
  await page.route(eligibilityUrl, (route) => route.fulfill({ json: {
    success: true,
    data: { surveyId, eligibleRespondents: [] },
  } }));
  await page.route(scheduleUrl, (route) => route.fulfill({ json: {
    success: true,
    data: { surveyId, status: 'CLOSED', closesAt: null, acceptingResponses: false },
  } }));

  await page.goto(`/owner/surveys/${surveyId}/policies`);
  await expect(page.getByText('This survey is manually closed. Its policy settings cannot be changed.')).toBeVisible();
  await expect(page.getByText('This survey is manually closed and cannot be reopened.')).toBeVisible();
  await expect(page.getByLabel('Respondent emails')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save eligibility list' })).toBeDisabled();
  await expect(page.locator('#closes-at')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save schedule' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear schedule' })).toBeDisabled();
});
