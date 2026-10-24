import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { LANGUAGES, LOGIN_URL_PATTERN, routes } from '../routes';

const ANONYMOUS = { cookies: [], origins: [] };

// Cada caso corre una vez por idioma instalado: /es/ y /en/.
for (const lang of LANGUAGES) {
  test.describe(`idioma ${lang.toUpperCase()}`, () => {
    test.describe('sin sesión guardada', () => {
      test.use({ storageState: ANONYMOUS });

      test('E2E-01 login de usuario registrado', async ({ page }) => {
        await new LoginPage(page).login(lang);
        await expect(page).not.toHaveURL(LOGIN_URL_PATTERN);
        await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`));
      });

      test('E2E-03 anónimo es redirigido al login', async ({ page }) => {
        await page.goto(routes.newDifunto(lang));
        await expect(page.locator('#username')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`));
      });
    });

    test('E2E-02 nuevo difunto carga sin bucle de redirección', async ({ page }) => {
      const response = await page.goto(routes.newDifunto(lang));
      expect(response?.status()).toBe(200);
      await expect(page.locator('#jform_id')).toBeAttached();
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`));
    });
  });
}
