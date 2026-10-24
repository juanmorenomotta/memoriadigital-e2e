import { Page, expect } from '@playwright/test';
import { resolveLang, routes, type Lang } from '../routes';

export class LoginPage {
  constructor(private page: Page) {}

  async login(
    lang: Lang = resolveLang(process.env.E2E_LANG),
    user = process.env.E2E_USER,
    pass = process.env.E2E_PASS,
  ) {
    if (!user || !pass) {
      throw new Error('Faltan E2E_USER / E2E_PASS en .env (ver .env.example).');
    }

    // 'load' espera los ~51 recursos del template (+ debug bar) y provoca timeouts.
    await this.page.goto(routes.login(lang), { waitUntil: 'domcontentloaded' });
    await this.page.locator('#username').fill(user);
    await this.page.locator('#password').fill(pass);
    // El texto del boton cambia con el idioma ("Conectar" / "Log in"): se usa el form.
    await this.page.locator('#com-users-login__form button[type=submit]').click();
    await expect(this.page.locator('#username')).toHaveCount(0);
  }
}
