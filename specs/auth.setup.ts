import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { LOGIN_URL_PATTERN } from '../routes';

export const AUTH_FILE = '.auth/user.json';

setup('autenticar usuario de pruebas', async ({ page }) => {
  await new LoginPage(page).login();
  await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);
  await page.context().storageState({ path: AUTH_FILE });
});
