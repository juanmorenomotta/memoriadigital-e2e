# Memorial Digital — Pruebas E2E

Suite de pruebas de regresión funcional con **Playwright + TypeScript** para el frontend de Memorial Digital (Joomla 5.4, componente `com_legado`).

El repositorio es **independiente de la aplicación**: no lee archivos de `htdocs/`, no comparte `node_modules` con el sitio y solo contacta la aplicación por HTTP usando `BASE_URL`. Puede ejecutarse contra un entorno local (XAMPP) o contra un sitio remoto.

- Plan y matriz de casos: [`docs/01-Plan-Pruebas-Regresion-E2E-Difuntos.md`](docs/01-Plan-Pruebas-Regresion-E2E-Difuntos.md)
- Desacoplamiento y fases del proyecto: [`docs/02-desacoplar-e2e-de-aplicacion.md`](docs/02-desacoplar-e2e-de-aplicacion.md)

---

## 1. Herramientas de software

| Componente | Versión usada | Verificación |
|---|---|---|
| Node.js | 22.20.0 (mínimo 18) | `node -v` |
| npm | 10.0.0 | `npm -v` |
| `@playwright/test` | 1.64.1 | `npx playwright --version` |
| `dotenv` | 16.6.1 | — |
| Navegador Chromium | `chromium-1248` | `npx playwright install chromium` |
| Git | cualquiera reciente | `git --version` |
| Aplicación bajo prueba | Joomla 5.4 + `com_legado`, servida por Apache/MySQL (XAMPP) | el sitio responde en `BASE_URL` |

### Instalación

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env        # completar con los valores del entorno
Copy-Item .env.example .env.local  # opcional: sobrescribe por variable
```

---

## 2. Variables de entorno requeridas

La configuración se resuelve **antes** de definir `defineConfig`, con este orden de precedencia:

1. `.env.<TEST_ENV>` — donde `TEST_ENV` vale `local` por defecto.
2. `.env` — respaldo **por variable** (solo rellena lo que falte).

`dotenv` no sobreescribe valores ya definidos, por lo que **el archivo específico siempre gana**.

| Variable | Obligatoria | Descripción | Valor por defecto |
|---|---|---|---|
| `TEST_ENV` | No | Etiqueta del archivo de entorno a cargar (`.env.<TEST_ENV>`) | `local` |
| `BASE_URL` | **Sí** | URL base contra la que corren las pruebas. Si falta en todos los archivos, la ejecución aborta con un error que lista los archivos intentados | — |
| `E2E_USER` | **Sí** | Usuario del grupo *Registered* usado por el setup. Si falta, `LoginPage` lanza un error explícito | — |
| `E2E_PASS` | **Sí** | Contraseña del usuario de pruebas | — |
| `E2E_LANG` | No | Idioma con el que se autentica el `setup` (`es` \| `en`) | `es` |
| `E2E_WORKERS` | No | Workers en paralelo | `1` |

> `E2E_USER` y `E2E_PASS` deben pertenecer a un usuario *Registered*, nunca a un Super User: las pruebas validan el acceso por propiedad (`created_by`).

### Archivos de entorno

```
.env.example   -> versionado en git, solo nombres de variables
.env           -> respaldo general (ignorado por git)
.env.local     -> entorno local, gana sobre .env (ignorado por git)
.env.prod      -> entorno remoto/producción (ignorado por git)
```

`.gitignore` cubre `.env*` con excepción de `.env.example`.

```gitignore
node_modules/
playwright-report/
test-results/
.env*
!.env.example
.auth/
```

---

## 3. Cómo ejecutar

**`.env.local` ya es el valor por defecto**, así que no hace falta exportar nada:

```powershell
npx playwright test
```

Verificación de la carga de entorno:

```
TEST_ENV  = local
archivos  = .env.local + .env
```

### Selección explícita del entorno

```powershell
# PowerShell: la variable vive solo en este proceso
$env:TEST_ENV='local'; npx playwright test

# cmd.exe
set TEST_ENV=local && npx playwright test
```

```powershell
$env:TEST_ENV='prod'; npx playwright test     # carga .env.prod + .env
```

### Variantes útiles

```powershell
npx playwright test --list             # listar casos sin ejecutarlos
npx playwright test -g "idioma ES"     # solo español (3 pruebas + setup)
npx playwright test --project=setup    # solo el login que genera .auth/user.json
npx playwright test --ui               # modo interactivo
npx playwright show-report             # reporte HTML del último run
npx playwright show-trace test-results\<carpeta>\trace.zip
```

### Advertencia de precedencia

Como `.env.local` gana sobre `.env`, un cambio hecho **solo en `.env`** no tendrá efecto mientras exista `.env.local` con esa misma variable. Para cambiar de entorno, editar `.env.local` o usar otra etiqueta con `TEST_ENV`.

---

## 4. Arquitectura

```text
memoriadigital-e2e/
├── docs/
│   ├── 01-Plan-Pruebas-Regresion-E2E-Difuntos.md
│   └── 02-desacoplar-e2e-de-aplicacion.md
├── fixtures/                    # Datos sintéticos e imágenes de muestra
│   ├── difuntos.data.ts         # generación de difuntos únicos de prueba
│   └── images/                  # JPG de prueba (principal y galería)
├── pages/                       # Page Object Model
│   ├── LoginPage.ts             # navegación al login, credenciales y submit
│   ├── DifuntoEditPage.ts       # formulario de alta/edición y multimedia
│   └── MisDifuntosPage.ts       # listado "Mis Difuntos" y borrado en lote
├── specs/                       # Casos de prueba
│   ├── auth.setup.ts            # login único; guarda storageState
│   ├── 01_auth_access.spec.ts   # E2E-01, E2E-02, E2E-03 por idioma
│   ├── 02_difunto_crud.spec.ts  # E2E-04, E2E-05, E2E-06 por idioma
│   ├── 03_multimedia.spec.ts    # E2E-07 a E2E-11 por idioma
│   └── 04_ubicacion_mapa.spec.ts # E2E-12, E2E-13 por idioma
├── routes.ts                    # única fuente de verdad de las URLs
├── playwright.config.ts         # entorno, timeouts, workers, proyectos
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── .auth/user.json              # generado por el setup (ignorado por git)
├── test-results/                # trazas y capturas de fallos (ignorado)
└── playwright-report/           # reporte HTML (ignorado)
```

### Capas

1. **`playwright.config.ts`** — carga `.env.<TEST_ENV>` y `.env`, valida `BASE_URL`, define timeouts, workers y los dos proyectos.
2. **`routes.ts`** — construye todas las URLs del frontend a partir del idioma. Ningún spec ni page object escribe `index.php/...`.
3. **`pages/`** — encapsula interacción con el DOM (Page Object Model). Los selectores se apoyan en IDs y estructura, nunca en textos traducidos.
4. **`specs/`** — casos de negocio. Consumen `routes` y los page objects; no conocen URLs literales.

### Flujo de autenticación

```text
Proyecto "setup"  ->  LoginPage.login()  ->  .auth/user.json (storageState)
                                                        |
                                    dependencia  ------>|
                                                        v
Proyecto "chromium"  ->  reutiliza la sesión guardada en .auth/user.json
```

`chromium` declara `dependencies: ['setup']`, por lo que el login se ejecuta una sola vez por corrida y los demás casos parten de la sesión ya autenticada. Los casos que deben probar el estado anónimo lo sobrescriben localmente:

```ts
test.use({ storageState: { cookies: [], origins: [] } });
```

### Cobertura actual

| ID | Caso | Idiomas |
|---|---|---|
| — | `setup`: autenticar usuario de pruebas | 1 |
| E2E-01 | Login de usuario registrado | `es`, `en` |
| E2E-02 | Nuevo difunto carga sin bucle de redirección (200 + `#jform_id`) | `es`, `en` |
| E2E-03 | Anónimo es redirigido al login | `es`, `en` |
| E2E-04 | Crear difunto con datos obligatorios mínimos | `es`, `en` |
| E2E-05 | Validación de campos requeridos (nombre, apellidos) | `es`, `en` |
| E2E-06 | Editar difunto existente propio y persistir cambios | `es`, `en` |
| E2E-07 | Carga de imagen principal (input y drag & drop) | `es`, `en` |
| E2E-08 | Carga múltiple en galería (`{id}_2.jpg`, `{id}_3.jpg`) | `es`, `en` |
| E2E-09 | Eliminación de imagen de galería con confirmación | `es`, `en` |
| E2E-10 | Eliminación de imagen principal con confirmación | `es`, `en` |
| E2E-11 | Persistencia de imágenes al recargar el formulario | `es`, `en` |
| E2E-12 | Cambio de cementerio rellena coordenadas y recentra el mapa | `es`, `en` |
| E2E-13 | Marcado manual de coordenadas en el mapa | `es`, `en` |

**Total: 27 pruebas** (1 setup + 13 casos × 2 idiomas).

---

## 5. Consideraciones de idioma

El sitio usa el filtro de idiomas de Joomla: el idioma ocupa el **primer segmento de la ruta** (`index.php/es/...`, `index.php/en/...`), no el query string.

| Aspecto | Implementación |
|---|---|
| Fuente de idiomas | `LANGUAGES` en `routes.ts` genera cada caso automáticamente |
| URL del login | `routes.login(lang)` |
| URL del formulario | `routes.newDifunto(lang)` |
| Aserción de idioma | cada caso verifica `html[lang]` con `^es` / `^en`; si el prefijo se ignorara, la prueba falla en lugar de pasar en silencio |
| Selector del botón | `#com-users-login__form button[type=submit]` — el texto cambia ("Conectar" / "Log in") |
| Sesión | una sola; el idioma lo impone la URL, no hace falta un `storageState` por idioma |
| Redirect anónimo | el parámetro `return` conserva el idioma de origen |

### Comportamiento verificado

| Ruta | Anónimo | Autenticado |
|---|---|---|
| `index.php/es/component/legado?view=midifunto&layout=edit` | `303` → `/es/component/users/login?return=...` | `200`, `#jform_id`, `html lang="es-es"` |
| `index.php/en/component/legado?view=midifunto&layout=edit` | `303` → `/en/component/users/login?return=...` | `200`, `#jform_id`, `html lang="en-gb"` |
| `index.php/component/legado?...` (sin prefijo) | error del router | error del router |

**El prefijo de idioma es obligatorio.** La forma `index.php?option=...` sin prefijo redirige al idioma por defecto, lo que puede hacer pasar un caso en el idioma equivocado.

### Extender

- **Idioma nuevo:** añadirlo a `LANGUAGES` y verificar que exista en el backend (*System → Languages → Content Languages*). El bucle de `01_auth_access.spec.ts` genera los casos solo.
- **Ruta nueva:** añadir la entrada al objeto `routes` y consumirla desde el page object.
- **Un solo idioma:** `npx playwright test -g "idioma ES"`.

---

## 6. Consideraciones de ejecución

### Timeouts

| Ajuste | Valor | Motivo |
|---|---|---|
| `timeout` (por prueba) | 120 s | techo general |
| `navigationTimeout` | 90 s | TTFB local medido entre 2 y 6 s |
| `actionTimeout` | 60 s | el click de login dispara una navegación completa; con 20 s fallaba de forma intermitente |
| `expect` | 20 s | aserciones de DOM |

### Workers

`workers: 1` por defecto. El Joomla de XAMPP no sostiene dos sesiones concurrentes sin que una navegación exceda el timeout. Se puede subir con `E2E_WORKERS`.

### Espera de navegación

`LoginPage` usa `waitUntil: 'domcontentloaded'`. El template sirve ~51 recursos por página; esperar `load` provoca timeouts.

### Selectores

- Preferir IDs (`#jform_id`, `#username`, `#main-image-input`) y estructura de formularios.
- Nunca depender de textos traducidos.

### Artefactos

| Ajuste | Valor |
|---|---|
| `trace` | `retain-on-failure` |
| `screenshot` | `only-on-failure` |
| `reporter` | `list` + `html` (no abre automáticamente) |

### Recomendaciones sobre el sitio bajo prueba

- **Desactivar el Debug System de Joomla** en el entorno de pruebas (*System → Global Configuration → System*). Añade decenas de recursos y es la causa principal del TTFB alto.

### Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| `Falta BASE_URL…` | ningún `.env` del entorno define la variable |
| `Faltan E2E_USER / E2E_PASS` | credenciales ausentes en el archivo de entorno activo |
| `TimeoutError: locator.click … waiting for scheduled navigations` | TTFB del sitio; revisar `actionTimeout` y carga de Apache/MySQL |
| `browserContext.storageState: Protocol error (Target.createTarget)` | consecuencia de un timeout previo: el contexto ya estaba cerrado |
| Cambio en `.env` sin efecto | `.env.local` lo está sobrescribiendo |
| Falla en `html[lang]` | el prefijo de idioma no existe en el backend o la ruta se resolvió al idioma por defecto |

---

## 7. Archivos de configuración

### `playwright.config.ts`

Define la carga de entorno, `baseURL`, timeouts, workers, reporter y los proyectos `setup` / `chromium` con `storageState`.

### `routes.ts`

```ts
export const LANGUAGES = ['es', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];

export const routes = {
  login:      (lang: Lang) => string,
  profile:    (lang: Lang) => string,
  newDifunto: (lang: Lang) => string,
};

export const LOGIN_URL_PATTERN = /.../;   // aserción negativa tras el login
```

Rutas **relativas** (sin `/` inicial) para que se resuelvan contra `BASE_URL`.

### `.env.example`

Plantilla versionada con **solo los nombres de las variables**:

```dotenv
TEST_ENV=
BASE_URL=
E2E_USER=
E2E_PASS=
E2E_LANG=
E2E_WORKERS=
```

### `package.json`

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report"
  }
}
```

---

## 8. Seguridad y estado del proyecto

### Riesgo activo: repositorio servido por Apache

Mientras el repositorio permanezca dentro de la raíz web de Apache/XAMPP, los archivos de entorno son accesibles por HTTP aunque `.gitignore` los excluya de git:

```
http://<host>/memoriadigital-e2e/.env          -> 200
http://<host>/memoriadigital-e2e/.env.local    -> 200
http://<host>/memoriadigital-e2e/.env.prod     -> 200
http://<host>/memoriadigital-e2e/.git/config   -> 200
```

Opciones: mover la carpeta fuera de la raíz web o excluirla en la configuración de Apache.

### Pendientes

- **Fase A:** mover el repositorio fuera de `htdocs` o excluirlo en Apache.
- **Fase B:** regenerar `.auth/user.json` por entorno; definir la política de limpieza de datos (por interfaz o HTTP, nunca por sistema de archivos); completar `.env.prod` con la URL y la cuenta reales.
- **Fase C:** `Dockerfile` con la imagen oficial de Playwright, credenciales por secretos, volúmenes para `playwright-report/` y `test-results/`, ejecución en GitHub Actions.

### Política de datos

- Las pruebas de escritura (Alta/Edición/Eliminación de difuntos e imágenes) **no** deben ejecutarse contra producción.
- Contra producción: solo pruebas de lectura o una cuenta dedicada con datos prefijados `E2E_` que se limpian al terminar.
- Nunca versionar credenciales ni `storageState`.
