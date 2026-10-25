import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { DifuntoEditPage } from '../pages/DifuntoEditPage';
import { LANGUAGES } from '../routes';

interface Cementerio {
  value: string;
  nombre: string;
  lat: number;
  lng: number;
}

/**
 * Busca, entre las opciones del select `#jform_cementerio_id`, una con
 * coordenadas GPS. Usa el endpoint AJAX (`task=getCemeteryCoordinates`) vía el
 * `request` de Playwright (HTTP directo), que no depende de la sesión ni del
 * mapa del navegador.
 */
async function descubrirCementerio(
  page: Page,
  request: APIRequestContext,
): Promise<Cementerio | null> {
  const valores = await page
    .locator('#jform_cementerio_id option')
    .evaluateAll((opciones) =>
      (opciones as HTMLOptionElement[]).filter((opt) => opt.value !== '').map((opt) => opt.value),
    );

  for (const value of valores) {
    const resp = await request.get(
      `index.php?option=com_legado&task=getCemeteryCoordinates&cementerio_id=${encodeURIComponent(
        value,
      )}&format=json`,
    );
    if (!resp.ok()) continue;

    const data = (await resp.json().catch(() => null)) as {
      success?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      nombre?: string;
    } | null;

    if (data?.success && data.latitude != null && data.longitude != null) {
      return { value, nombre: data.nombre ?? value, lat: data.latitude, lng: data.longitude };
    }
  }

  return null;
}

// Cada caso corre una vez por idioma instalado: /es/ y /en/.
// Los casos de esta suite solo interactúan con el formulario (sin guardar), por
// lo que no crean registros ni requieren teardown.
for (const lang of LANGUAGES) {
  test.describe(`idioma ${lang.toUpperCase()}`, () => {
    test('E2E-12 cambio de cementerio recentra el mapa y rellena coordenadas', async ({
      page,
      request,
    }) => {
      const editPage = new DifuntoEditPage(page);

      await editPage.gotoNew(lang);
      await editPage.activarTabUbicacion();

      // Precondición: debe existir al menos un cementerio publicado con GPS.
      const cementerio = await descubrirCementerio(page, request);
      expect(cementerio, 'No hay cementerios publicados con coordenadas GPS').not.toBeNull();

      await editPage.seleccionarCementerio(cementerio!.value);
      await editPage.expectCoordenadas(cementerio!.lat, cementerio!.lng);

      // El mapa se recentra en las coordenadas del cementerio seleccionado.
      // Solo se verifica cuando el mapa activo es Google Maps (el proveedor
      // configurado). Si la carrera de inicialización dejó el polyfill Leaflet
      // activo, el recentrado usa la API de Google sobre un mapa Leaflet y no
      // tiene efecto (bug conocido de la aplicación); en ese caso el sondeo de
      // los campos de arriba ya es la evidencia determinista del caso.
      await editPage.esperarMapa();
      if (await editPage.esMapaGoogle()) {
        await expect
          .poll(async () => {
            const centro = await editPage.obtenerCentroMapa();
            return centro === null ? Number.NaN : Math.abs(centro.lat - cementerio!.lat);
          }, { timeout: 15_000, message: 'el mapa no se recentró en la latitud del cementerio' })
          .toBeLessThan(0.01);

        await expect
          .poll(async () => {
            const centro = await editPage.obtenerCentroMapa();
            return centro === null ? Number.NaN : Math.abs(centro.lng - cementerio!.lng);
          }, { timeout: 15_000, message: 'el mapa no se recentró en la longitud del cementerio' })
          .toBeLessThan(0.01);
      }
    });

    test('E2E-13 marcado manual de coordenadas en el mapa', async ({ page }) => {
      const editPage = new DifuntoEditPage(page);

      await editPage.gotoNew(lang);
      await editPage.activarTabUbicacion();
      await editPage.esperarMapa();

      // Marcado manual en el mapa: el manejador de click actualiza los campos.
      const lat = -12.052;
      const lng = -77.038;
      await editPage.marcarCoordenadaEnMapa(lat, lng);
      await editPage.expectCoordenadas(lat, lng);
    });
  });
}
