import fs from 'node:fs';
import path from 'node:path';
import { Page, expect, type JSHandle } from '@playwright/test';
import { routes, type Lang } from '../routes';

/**
 * Page Object del formulario de alta/edición de un difunto
 * (`view=midifunto&layout=edit`).
 *
 * El formulario usa los IDs estándar de Joomla (`#jform_<campo>`) y las
 * acciones se disparan con `Joomla.submitbutton(...)`; por eso los selectores
 * se apoyan en IDs y en el atributo `onclick`, nunca en textos traducidos.
 */
export class DifuntoEditPage {
  constructor(private readonly page: Page) {}

  /** Abre el formulario de nuevo difunto y espera a que el form esté listo. */
  async gotoNew(lang: Lang): Promise<void> {
    await this.page.goto(routes.newDifunto(lang), { waitUntil: 'domcontentloaded' });
    await expect(this.page.locator('#jform_id')).toBeAttached();
    await expect(this.page.locator('#jform_nombre')).toBeVisible();
    await this.waitForValidator();
  }

  /** Abre el formulario de edición de un difunto existente (propio). */
  async gotoEdit(lang: Lang, id: number): Promise<void> {
    await this.page.goto(routes.editDifunto(lang, id), { waitUntil: 'domcontentloaded' });
    await expect(this.page.locator('#jform_id')).toHaveValue(String(id));
    await expect(this.page.locator('#jform_nombre')).toBeVisible();
    await this.waitForValidator();
  }

  /** Espera a que el validador de Joomla esté disponible antes de guardar. */
  private async waitForValidator(): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const doc = document as Document & {
          formvalidator?: { isValid: (form: HTMLFormElement) => boolean };
        };
        return typeof doc.formvalidator?.isValid === 'function';
      },
      undefined,
      { timeout: 30_000 },
    );
  }

  /** Rellena los campos obligatorios mínimos (nombre y apellidos). */
  async fillDatosBasicos(datos: { nombre: string; apellidos: string }): Promise<void> {
    await this.page.locator('#jform_nombre').fill(datos.nombre);
    await this.page.locator('#jform_apellidos').fill(datos.apellidos);
  }

  /** Rellena el campo opcional lugar de nacimiento. */
  async rellenarLugarNacimiento(lugar: string): Promise<void> {
    await this.page.locator('#jform_lugar_nacimiento').fill(lugar);
  }

  /** Comprueba el valor persistido de un campo por su ID (`#jform_<campo>`). */
  async expectValor(campoId: string, valor: string | number): Promise<void> {
    await expect(this.page.locator(`#${campoId}`)).toHaveValue(String(valor));
  }

  /** Pulsa el botón Guardar (`midifunto.save`). */
  async clickGuardar(): Promise<void> {
    await this.page.locator('button[onclick*="midifunto.save"]').click();
  }

  /** Guarda y cierra: `midifunto.save` redirige al listado "Mis Difuntos". */
  async save(): Promise<void> {
    await this.clickGuardar();
    await expect(this.page).toHaveURL(/view=misdifuntos/, { timeout: 30_000 });
  }

  // ---------------------------------------------------------------------------
  // Multimedia (Fase 3)
  // ---------------------------------------------------------------------------

  /**
   * Activa la pestaña Multimedia y espera a que se carguen las imágenes.
   *
   * El handler de galería se monta ~1s después del DOMContentLoaded; cuando
   * `window.removeMainImage` existe, todos los listeners (input, drop) y el
   * MutationObserver ya están listos.
   */
  async activarTabMultimedia(): Promise<void> {
    await this.page.waitForFunction(
      () => typeof (window as unknown as { removeMainImage?: unknown }).removeMainImage === 'function',
      undefined,
      { timeout: 30_000 },
    );

    const loaded = this.page.waitForResponse(
      (resp) => resp.url().includes('task=midifunto.getGalleryImages'),
      { timeout: 30_000 },
    );

    await this.page.locator('button[role="tab"][aria-controls="multimedia"]').click();
    await expect(this.page.locator('#multimedia')).toHaveAttribute('active', '');

    await loaded;

    // `loadExistingImages` renderiza el grid (items o el mensaje "No hay
    // imágenes") después de resolver la respuesta JSON. Esperamos ese render
    // para que los recuentos posteriores sean fiables.
    await expect(this.page.locator('#gallery-images-grid > *')).not.toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /** Sube la imagen principal vía el input de archivo y espera la previsualización. */
  async subirImagenPrincipal(fixturePath: string): Promise<void> {
    await this.page.locator('#main-image-input').setInputFiles(fixturePath);
    await expect(this.page.locator('#main-image-preview')).toBeVisible({ timeout: 30_000 });
    await expect(this.page.locator('#main-image-preview')).toHaveAttribute(
      'src',
      /originales\/\d+_1\.jpg/,
    );
  }

  /** Suelta la imagen principal sobre la drop zone (drag & drop). */
  async soltarImagenPrincipal(fixturePath: string): Promise<void> {
    const dataTransfer = await this.crearDataTransfer(fixturePath);
    await this.page.locator('#main-upload-zone').dispatchEvent('drop', { dataTransfer });
    await expect(this.page.locator('#main-image-preview')).toBeVisible({ timeout: 30_000 });
    await expect(this.page.locator('#main-image-preview')).toHaveAttribute(
      'src',
      /originales\/\d+_1\.jpg/,
    );
  }

  /** Sube varias imágenes a la galería y espera a que aparezcan en el grid. */
  async subirGaleria(fixturePaths: string[]): Promise<void> {
    await this.page.locator('#gallery-images-input').setInputFiles(fixturePaths);
    await expect(this.page.locator('#gallery-images-grid .gallery-image-item')).toHaveCount(
      fixturePaths.length,
      { timeout: 30_000 },
    );
  }

  /** Elimina la imagen principal (confirmando el diálogo nativo). */
  async eliminarImagenPrincipal(): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.page.locator('button[onclick="removeMainImage()"]').click();
    await expect(this.page.locator('#current-main-image')).toBeHidden({ timeout: 15_000 });
    await expect(this.page.locator('#main-upload-zone')).toBeVisible({ timeout: 15_000 });
  }

  /** Elimina la primera imagen de la galería (confirmando el diálogo nativo). */
  async eliminarPrimeraImagenGaleria(): Promise<void> {
    const grid = this.page.locator('#gallery-images-grid .gallery-image-item');
    const antes = await grid.count();
    expect(antes).toBeGreaterThan(0);

    this.page.once('dialog', (dialog) => dialog.accept());
    await grid.first().locator('button').click();
    await expect(grid).toHaveCount(antes - 1, { timeout: 15_000 });
  }

  /** Teardown: elimina todas las imágenes (galería y principal) vía la UI. */
  async limpiarImagenes(): Promise<void> {
    const grid = this.page.locator('#gallery-images-grid .gallery-image-item');
    for (let i = 0; i < 20; i += 1) {
      const antes = await grid.count();
      if (antes === 0) {
        break;
      }
      this.page.once('dialog', (dialog) => dialog.accept());
      await grid.first().locator('button').click();
      await expect(grid).toHaveCount(antes - 1, { timeout: 15_000 });
    }

    const currentImage = this.page.locator('#current-main-image');
    if (await currentImage.isVisible()) {
      this.page.once('dialog', (dialog) => dialog.accept());
      await this.page.locator('button[onclick="removeMainImage()"]').click();
      await expect(currentImage).toBeHidden({ timeout: 15_000 });
    }
  }

  // ---------------------------------------------------------------------------
  // Ubicación / Mapa (Fase 4)
  // ---------------------------------------------------------------------------

  /** Activa la pestaña Ubicación (sin esperar la inicialización del mapa). */
  async activarTabUbicacion(): Promise<void> {
    await this.page.locator('button[role="tab"][aria-controls="ubicacion"]').click();
    await expect(this.page.locator('#ubicacion')).toHaveAttribute('active', '');
    await expect(this.page.locator('#jform_cementerio_id')).toBeVisible();
  }

  /**
   * Espera a que el mapa esté inicializado. Es agnóstico de proveedor: el sitio
   * puede usar Leaflet (`setView`) o Google Maps (`setCenter`), según la
   * configuración de `com_legado` y la carga asíncrona de la API de Google.
   *
   * La API de Google Maps se carga de forma asíncrona y la inicialización del
   * mapa compite con esa carga; si el mapa no aparece en el primer intento, se
   * vuelve a disparar la inicialización una vez que `google.maps` está listo.
   */
  async esperarMapa(): Promise<void> {
    const estaListo = () => {
      const mapa = (window as unknown as {
        map?: { getCenter?: () => unknown; setView?: unknown; setCenter?: unknown };
      }).map;
      if (!mapa || typeof mapa.getCenter !== 'function') return false;
      return typeof mapa.setView === 'function' || typeof mapa.setCenter === 'function';
    };

    await this.page
      .waitForFunction(estaListo, undefined, { timeout: 25_000 })
      .catch(() => undefined);

    if (await this.page.evaluate(estaListo)) {
      return;
    }

    // Reintento: la API de Google Maps ya pudo cargar tras el primer intento.
    await this.page.evaluate(() => {
      const w = window as unknown as {
        google?: { maps?: unknown };
        initializeGoogleMap?: () => void;
        initializeIntegratedMap?: () => void;
      };
      if (w.google?.maps && typeof w.initializeGoogleMap === 'function') {
        w.initializeGoogleMap();
      } else if (typeof w.initializeIntegratedMap === 'function') {
        w.initializeIntegratedMap();
      }
    });

    await this.page.waitForFunction(estaListo, undefined, { timeout: 25_000 });
  }

  /** Selecciona un cementerio por su valor en `#jform_cementerio_id`. */
  async seleccionarCementerio(value: string): Promise<void> {
    await this.page.locator('#jform_cementerio_id').selectOption(value);
  }

  /**
   * Verifica que los campos lat/long queden rellenos con las coordenadas dadas.
   * Usa sondeo (`expect.poll`) porque el valor puede pasar por un estado
   * transitorio (por ejemplo, la ubicación por defecto) antes de asentarse.
   */
  async expectCoordenadas(lat: number, lng: number): Promise<void> {
    await expect
      .poll(
        async () => {
          const latValor = parseFloat(await this.page.locator('#jform_latitude').inputValue());
          const lngValor = parseFloat(await this.page.locator('#jform_longitude').inputValue());
          if (!Number.isFinite(latValor) || !Number.isFinite(lngValor)) return Number.NaN;
          return Math.abs(latValor - lat) + Math.abs(lngValor - lng);
        },
        { timeout: 15_000, message: `campos de coordenadas no alcanzaron (${lat}, ${lng})` },
      )
      .toBeLessThan(0.0001);
  }

  /** Lee las coordenadas actuales de los campos del formulario. */
  async leerCoordenadas(): Promise<{ lat: number; lng: number }> {
    const lat = parseFloat(await this.page.locator('#jform_latitude').inputValue());
    const lng = parseFloat(await this.page.locator('#jform_longitude').inputValue());
    return { lat, lng };
  }

  /**
   * Devuelve el centro actual del mapa, o `null` si aún no está disponible.
   * Compatible con Leaflet (`{lat, lng}`) y Google Maps (`LatLng.lat()/lng()`).
   */
  async obtenerCentroMapa(): Promise<{ lat: number; lng: number } | null> {
    return this.page.evaluate(() => {
      const mapa = (window as unknown as { map?: { getCenter?: () => unknown } }).map;
      if (!mapa || typeof mapa.getCenter !== 'function') return null;

      const centro = mapa.getCenter() as { lat?: unknown; lng?: unknown };
      const lat = typeof centro.lat === 'function' ? (centro.lat as () => number)() : centro.lat;
      const lng = typeof centro.lng === 'function' ? (centro.lng as () => number)() : centro.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return { lat, lng };
    });
  }

  /** Hace clic sobre el mapa, desplazado del centro para no tocar el marcador. */
  async clicEnMapa(offsetX = 100, offsetY = 80): Promise<void> {
    const box = await this.page.locator('#mapaIntegrado').boundingBox();
    if (!box) {
      throw new Error('No se pudo obtener el área del mapa (#mapaIntegrado)');
    }
    await this.page.mouse.click(
      box.x + box.width / 2 + offsetX,
      box.y + box.height / 2 + offsetY,
    );
  }

  /** Indica si el mapa activo es de Google Maps (el proveedor configurado). */
  async esMapaGoogle(): Promise<boolean> {
    return this.page.evaluate(() => {
      const w = window as unknown as {
        google?: { maps?: unknown };
        map?: { setCenter?: unknown; setView?: unknown };
      };
      return !!w.google?.maps && !!w.map && typeof w.map.setCenter === 'function';
    });
  }

  /**
   * Dispara el evento `click` del mapa en las coordenadas dadas, ejercitando el
   * manejador de la aplicación (`map.on('click')` en Leaflet o
   * `map.addListener('click')` en Google Maps) que actualiza los campos.
   * Es determinista: no depende de la posición física del ratón ni de los
   * controles superpuestos del mapa.
   */
  async marcarCoordenadaEnMapa(lat: number, lng: number): Promise<void> {
    await this.page.evaluate(
      ({ lat, lng }) => {
        const w = window as unknown as {
          map?: {
            fire?: (type: string, data: unknown) => void;
            setCenter?: unknown;
          };
          google?: { maps?: { event?: { trigger?: (...args: unknown[]) => void }; LatLng?: new (l: number, n: number) => unknown } };
          L?: { latLng?: (l: number, n: number) => unknown };
        };

        const mapa = w.map;
        if (!mapa) throw new Error('mapa no inicializado');

        if (typeof mapa.fire === 'function' && w.L?.latLng) {
          // Leaflet / OpenStreetMap
          mapa.fire('click', { latlng: w.L.latLng(lat, lng) });
        } else if (w.google?.maps?.event?.trigger && w.google.maps.LatLng) {
          // Google Maps
          const latLng = new w.google.maps.LatLng(lat, lng);
          w.google.maps.event.trigger(mapa, 'click', { latLng });
        } else {
          throw new Error('proveedor de mapa no reconocido');
        }
      },
      { lat, lng },
    );
  }

  /** Construye un `DataTransfer` con el archivo dado para simular drag & drop. */
  private async crearDataTransfer(fixturePath: string): Promise<JSHandle> {
    const buffer = fs.readFileSync(fixturePath);
    const base64 = buffer.toString('base64');
    const fileName = path.basename(fixturePath);

    return this.page.evaluateHandle(
      ({ base64, fileName }) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], fileName, { type: 'image/jpeg' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        return dataTransfer;
      },
      { base64, fileName },
    );
  }
}
