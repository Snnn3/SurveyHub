import { expect, type Page } from '@playwright/test';

const password = 'Password123!';
type HomePath = '/owner/surveys' | '/surveys';

export async function signIn(page: Page, email: string, home: HomePath): Promise<void> {
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

export async function signOut(page: Page): Promise<void> {
  const logoutResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Log out' }).click();
  expect((await logoutResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email')).toBeVisible();
}
