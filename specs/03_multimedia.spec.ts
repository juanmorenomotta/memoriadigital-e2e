import path from 'node:path';
import { test, expect } from '@playwright/test';
import { DifuntoEditPage } from '../pages/DifuntoEditPage';
import { MisDifuntosPage } from '../pages/MisDifuntosPage';
import { crearDifunto } from '../fixtures/difuntos.data';
import { LANGUAGES, type Lang } from '../routes';

const FIXTURES = path.join(process.cwd(), 'fixtures', 'images');
const PRINCIPAL_JPG = path.join(FIXTURES, 'principal-test.jpg');
const GALERIA_JPG_1 = path.join(FIXTURES, 'galeria-test.jpg');
const GALERIA_JPG_2 = path.join(FIXTURES, 'galeria-test-2.jpg');

/**
 * Crea un difunto, abre su formulario de edición y activa la pestaña Multimedia.
 * Devuelve el ID persistido para poder limpiarlo al terminar.
 */
async function prepararDifunto(
  lang: Lang,
  editPage: DifuntoEditPage,
  listPage: MisDifuntosPage,
): Promise<number> {
  const datos = crearDifunto();
  await editPage.gotoNew(lang);
  await editPage.fillDatosBasicos(datos);
  await editPage.save();
  await listPage.expectVisible(datos.nombreCompleto);
  const id = await listPage.getIdPorNombre(datos.nombreCompleto);

  await editPage.gotoEdit(lang, id);
  await editPage.activarTabMultimedia();
  return id;
}

/** Teardown: elimina las imágenes subidas (por UI) y el registro del difunto. */
async function limpiarDifunto(
  lang: Lang,
  editPage: DifuntoEditPage,
  listPage: MisDifuntosPage,
  id: number,
): Promise<void> {
  await editPage.gotoEdit(lang, id);
  await editPage.activarTabMultimedia();
  await editPage.limpiarImagenes();
  await listPage.eliminarPorId(lang, id);
}

// Cada caso corre una vez por idioma instalado: /es/ y /en/.
for (const lang of LANGUAGES) {
  test.describe(`idioma ${lang.toUpperCase()}`, () => {
    test('E2E-07 carga de imagen principal (input y drag & drop)', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        id = await prepararDifunto(lang, editPage, listPage);

        // Drag & drop sobre la drop zone.
        await editPage.soltarImagenPrincipal(PRINCIPAL_JPG);

        // Subida vía input (sobrescribe la imagen principal).
        await editPage.subirImagenPrincipal(PRINCIPAL_JPG);

        await expect(page.locator('#current-main-image')).toBeVisible();
      } finally {
        if (id !== undefined) {
          await limpiarDifunto(lang, editPage, listPage, id);
        }
      }
    });

    test('E2E-08 carga múltiple en galería', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        id = await prepararDifunto(lang, editPage, listPage);

        await editPage.subirGaleria([GALERIA_JPG_1, GALERIA_JPG_2]);

        const grid = page.locator('#gallery-images-grid .gallery-image-item');
        await expect(grid).toHaveCount(2);

        // Miniaturas correlativas (_2, _3) y originales (_2.jpg, _3.jpg).
        await expect(grid.nth(0).locator('img')).toHaveAttribute('src', /miniaturas\/\d+_2\.png/);
        await expect(grid.nth(1).locator('img')).toHaveAttribute('src', /miniaturas\/\d+_3\.png/);
        await expect(grid.nth(0).locator('button')).toHaveAttribute('onclick', /_2\.jpg/);
        await expect(grid.nth(1).locator('button')).toHaveAttribute('onclick', /_3\.jpg/);
      } finally {
        if (id !== undefined) {
          await limpiarDifunto(lang, editPage, listPage, id);
        }
      }
    });

    test('E2E-09 eliminación de imagen de galería con confirmación', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        id = await prepararDifunto(lang, editPage, listPage);

        await editPage.subirGaleria([GALERIA_JPG_1]);
        await expect(page.locator('#gallery-images-grid .gallery-image-item')).toHaveCount(1);

        await editPage.eliminarPrimeraImagenGaleria();

        // El grid queda vacío tras la eliminación.
        await expect(page.locator('#gallery-images-grid .gallery-image-item')).toHaveCount(0);
      } finally {
        if (id !== undefined) {
          await limpiarDifunto(lang, editPage, listPage, id);
        }
      }
    });

    test('E2E-10 eliminación de imagen principal con confirmación', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        id = await prepararDifunto(lang, editPage, listPage);

        await editPage.subirImagenPrincipal(PRINCIPAL_JPG);
        await expect(page.locator('#current-main-image')).toBeVisible();

        await editPage.eliminarImagenPrincipal();
      } finally {
        if (id !== undefined) {
          await limpiarDifunto(lang, editPage, listPage, id);
        }
      }
    });

    test('E2E-11 persistencia de imágenes al recargar el formulario', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        id = await prepararDifunto(lang, editPage, listPage);

        await editPage.subirImagenPrincipal(PRINCIPAL_JPG);
        await editPage.subirGaleria([GALERIA_JPG_1, GALERIA_JPG_2]);

        // Recarga completa (F5) y reactivación de la pestaña Multimedia.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('#jform_id')).toHaveValue(String(id));
        await editPage.activarTabMultimedia();

        await expect(page.locator('#main-image-preview')).toBeVisible();
        await expect(page.locator('#main-image-preview')).toHaveAttribute(
          'src',
          /originales\/\d+_1\.jpg/,
        );
        await expect(page.locator('#gallery-images-grid .gallery-image-item')).toHaveCount(2);
      } finally {
        if (id !== undefined) {
          await limpiarDifunto(lang, editPage, listPage, id);
        }
      }
    });
  });
}
