import { test, expect } from '@playwright/test';
import { DifuntoEditPage } from '../pages/DifuntoEditPage';
import { MisDifuntosPage } from '../pages/MisDifuntosPage';
import { crearDifunto } from '../fixtures/difuntos.data';
import { LANGUAGES } from '../routes';

// Cada caso corre una vez por idioma instalado: /es/ y /en/.
// Los selectores usan IDs y atributos `onclick`, por lo que el idioma no cambia
// la interacción; el prefijo de idioma sí se conserva en la URL.
for (const lang of LANGUAGES) {
  test.describe(`idioma ${lang.toUpperCase()}`, () => {
    test('E2E-04 crear difunto con datos obligatorios mínimos', async ({ page }) => {
      const datos = crearDifunto();
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        await editPage.gotoNew(lang);
        await editPage.fillDatosBasicos(datos);
        await editPage.save();

        // Persistencia: el difunto aparece en "Mis Difuntos" con un ID asignado.
        await listPage.expectVisible(datos.nombreCompleto);
        id = await listPage.getIdPorNombre(datos.nombreCompleto);
        expect(id).toBeGreaterThan(0);
      } finally {
        if (id !== undefined) {
          await listPage.eliminarPorId(lang, id);
        }
      }
    });

    test('E2E-05 validación de campos requeridos', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);
      await editPage.gotoNew(lang);

      // El formulario vacío muestra un alert nativo y no navega.
      page.once('dialog', (dialog) => dialog.accept());
      await editPage.clickGuardar();

      await expect(page).toHaveURL(/view=midifunto&layout=edit/);
      await expect(page.locator('#jform_nombre')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#jform_apellidos')).toHaveAttribute('aria-invalid', 'true');
    });

    test('E2E-06 editar difunto existente propio', async ({ page }) => {
      const datos = crearDifunto();
      const editados = {
        nombre: `Editado-${datos.nombre}`,
        apellidos: `Editado-${datos.apellidos}`,
        lugarNacimiento: 'Lima',
      };
      const editPage = new DifuntoEditPage(page);
      const listPage = new MisDifuntosPage(page);
      let id: number | undefined;

      try {
        // Creación inicial.
        await editPage.gotoNew(lang);
        await editPage.fillDatosBasicos(datos);
        await editPage.save();
        await listPage.expectVisible(datos.nombreCompleto);
        id = await listPage.getIdPorNombre(datos.nombreCompleto);

        // Edición del difunto propio.
        await editPage.gotoEdit(lang, id);
        await editPage.fillDatosBasicos({
          nombre: editados.nombre,
          apellidos: editados.apellidos,
        });
        await editPage.rellenarLugarNacimiento(editados.lugarNacimiento);
        await editPage.save();

        // Persistencia en el listado: el nombre nuevo aparece y el viejo no.
        const nombreCompletoEditado = `${editados.nombre} ${editados.apellidos}`;
        await listPage.expectVisible(nombreCompletoEditado);
        await listPage.expectAusente(datos.nombreCompleto);

        // Persistencia al recargar el formulario.
        await editPage.gotoEdit(lang, id);
        await editPage.expectValor('jform_nombre', editados.nombre);
        await editPage.expectValor('jform_apellidos', editados.apellidos);
        await editPage.expectValor('jform_lugar_nacimiento', editados.lugarNacimiento);
      } finally {
        if (id !== undefined) {
          await listPage.eliminarPorId(lang, id);
        }
      }
    });
  });
}
