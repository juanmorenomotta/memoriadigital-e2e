import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error('Falta BASE_URL en .env (ver .env.example).');
}

// El Joomla local tarda 4-6 s en servir el HTML y ~51 recursos por pagina,
// por eso los tiempos son mas holgados que el valor por defecto de Playwright.
export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  // Un solo worker contra XAMPP: dos sesiones concurrentes saturan Apache/MySQL
  // y hacen que una navegacion supere el timeout.
  workers: Number(process.env.E2E_WORKERS ?? 1),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: { storageState: '.auth/user.json' },
    },
  ],
});
