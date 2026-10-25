import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// TEST_ENV selecciona el archivo de entorno: .env.<TEST_ENV> y luego .env como respaldo.
// dotenv no sobreescribe variables ya definidas, asi que el primer archivo gana.
export const TEST_ENV = process.env.TEST_ENV ?? 'local';
const ENV_FILES = [`.env.${TEST_ENV}`, '.env'].filter((file) =>
  fs.existsSync(path.resolve(__dirname, file)),
);
for (const file of ENV_FILES) {
  dotenv.config({ path: path.resolve(__dirname, file) });
}

const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error(
    `Falta BASE_URL. Se buscó en: ${ENV_FILES.join(', ') || '(ningún archivo .env encontrado)'}. ` +
      'Ver .env.example.',
  );
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
    // El click de login dispara una navegacion completa; con TTFB de 2-6 s en
    // XAMPP, 20 s se quedaba corto de forma intermitente.
    actionTimeout: 60_000,
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
