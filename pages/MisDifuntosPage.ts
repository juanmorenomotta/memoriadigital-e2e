import { Page, expect } from '@playwright/test';
import { routes, type Lang } from '../routes';

/**
 * Page Object del listado "Mis Difuntos" (`view=misdifuntos`).
 *
 * El listado de escritorio es una tabla (`table tbody`) cuyas filas contienen
 * un checkbox `input[name="cid[]"]` (valor = ID) y un enlace con el nombre
 * completo del difunto. La acción de borrado en lote usa
 * `Joomla.submitbutton('misdifuntos.delete')`.
 */
export class MisDifuntosPage {
  constructor(private readonly page: Page) {}

  /** Abre el listado y espera a que el formulario de filtros esté listo. */
  async goto(lang: Lang): Promise<void> {
    await this.page.goto(routes.misDifuntos(lang), { waitUntil: 'domcontentloaded' });
    await expect(this.page.locator('form#adminForm')).toBeAttached();
  }

  /** Verifica que el difunto con `nombreCompleto` aparezca en el listado. */
  async expectVisible(nombreCompleto: string): Promise<void> {
    await expect(
      this.page.locator('table tbody').getByText(nombreCompleto, { exact: false }).first(),
    ).toBeVisible();
  }

  /** Verifica que el difunto con `nombreCompleto` ya no aparezca en el listado. */
  async expectAusente(nombreCompleto: string): Promise<void> {
    await expect(
      this.page.locator('table tbody').getByText(nombreCompleto, { exact: false }),
    ).toHaveCount(0);
  }

  /** Localiza el ID del difunto a partir de su nombre completo. */
  async getIdPorNombre(nombreCompleto: string): Promise<number> {
    const fila = this.page
      .locator('table tbody tr')
      .filter({ hasText: nombreCompleto })
      .first();

    await expect(fila).toHaveCount(1);

    const value = await fila.locator('input[name="cid[]"]').getAttribute('value');
    expect(value).not.toBeNull();

    return Number(value);
  }

  /**
   * Elimina el difunto por ID usando la acción en lote del listado.
   * Es tolerante: si el registro ya no existe, no hace nada.
   */
  async eliminarPorId(lang: Lang, id: number): Promise<void> {
    await this.goto(lang);

    const checkbox = this.page.locator(`table tbody input[name="cid[]"][value="${id}"]`).first();
    if ((await checkbox.count()) === 0) {
      return;
    }

    await checkbox.check();
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.locator('button[onclick*="misdifuntos.delete"]').click();

    // Tras el POST y el redirect, la fila debe desaparecer del listado.
    await expect(
      this.page.locator(`table tbody input[name="cid[]"][value="${id}"]`),
    ).toHaveCount(0);
  }
}
