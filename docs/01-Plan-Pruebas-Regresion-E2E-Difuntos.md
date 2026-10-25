# Plan Maestro de Pruebas de Regresión E2E con Playwright: Registro de Difuntos
**Componente:** `com_legado` (Memorial Digital - Joomla 5.4)  
**Objetivo:** Automatizar las pruebas de regresión funcional para todo el ciclo de vida del Difunto en el frontend y backend, garantizando estabilidad ante futuros cambios.

---

## 1. Alcance y Cobertura

El alcance comprende la verificación integral del módulo **Difuntos**, con énfasis en:
1. **Acceso y Seguridad (ACL):** Login de usuarios registrados, validación de permisos de propietario (`created_by`), prevención de bucles de redirección.
2. **Formulario de Creación / Edición (CRUD):**
   - **Pestaña Información Básica:** Nombres, apellidos, alias, fechas de nacimiento/defunción, biografía y validaciones de obligatoriedad.
   - **Pestaña Ubicación:** Selección de cementerio, tipo de enterramiento, número de sepultura, actualización interactiva de mapa y coordenadas GPS.
   - **Pestaña Multimedia:** Carga, previsualización, persistencia y eliminación de imagen principal y galería.
3. **Persistencia y Ciclo de Vida:** Guardado, actualización, cancelación y visualización del difunto en el listado "Mis Difuntos".

---

## 2. Prerrequisitos y Preparación del Entorno

### 2.1 Software requerido

| Componente | Versión / Requisito | Verificación |
|---|---|---|
| Sistema operativo | Windows 10/11 | — |
| XAMPP | Apache y MySQL/MariaDB en ejecución (PHP 8.2+) | `http://localhost/memorial/` responde |
| Joomla | 5.4.x con `com_legado` instalado | `libraries/src/Version.php` |
| Node.js | 18 o superior (actual: 22.x) | `node -v` |
| npm | Incluido con Node.js | `npm -v` |
| Git | Para versionar las pruebas | `git --version` |
| Navegador Playwright | Chromium (se descarga con Playwright) | `npx playwright install chromium` |

### 2.2 Datos y configuración del sitio

1. **Usuario de pruebas:** usuario del grupo *Registered* (sin permisos ACL de componente) para validar el acceso por propiedad (`created_by`). Nunca usar un Super User para estas pruebas.
2. **Credenciales fuera del código:** guardarlas solo en el `.env` del repositorio `memoriadigital-e2e` (ignorado por git), basado en `.env.example`:
   ```
   BASE_URL=http://localhost/memorial/
   E2E_USER=<usuario_de_pruebas>
   E2E_PASS=<contraseña_de_pruebas>
   ```
3. **Cementerio de prueba:** al menos un cementerio publicado (`estado = 1`) con coordenadas GPS, requerido por las pruebas de Ubicación.
4. **Permisos de escritura** sobre `images/legado/difuntos/originales/` y `images/legado/difuntos/miniaturas/` (requerido por las pruebas Multimedia).
5. **Idioma del sitio:** las URLs usan el prefijo de idioma (`/es/` o `/en/`, ver `routes.ts`); la suite corre cada caso en ambos. Los selectores deben apoyarse en IDs (`#jform_id`, `#main-image-input`) y en el formulario (`#com-users-login__form`), no en textos traducidos.
6. **Entorno aislado:** ejecutar solo contra el entorno local o de pruebas, nunca contra producción.

### 2.3 Instalación

```powershell
cd memoriadigital-e2e        # ruta donde se clonó el repositorio de pruebas
npm install
npx playwright install chromium
Copy-Item .env.example .env   # luego editar con las credenciales de prueba
npx playwright test
```

---

## 3. Extensiones de VS Code Recomendadas

| Extensión | ID | Uso |
|---|---|---|
| Playwright Test for VS Code | `ms-playwright.playwright` | Ejecutar y depurar tests, grabar con *Record new*, selector *Pick locator*, ver trazas |
| ESLint | `dbaeumer.vscode-eslint` | Calidad del código TypeScript de las pruebas |
| Prettier | `esbenp.prettier-vscode` | Formato consistente |
| DotENV | `mikestead.dotenv` | Resaltado de archivos `.env` |
| GitHub Copilot / Copilot Chat | `GitHub.copilot`, `GitHub.copilot-chat` | Asistencia en la escritura de pruebas |
| PHP Intelephense (opcional) | `bmewburn.vscode-intelephense-client` | Navegar el código PHP de `com_legado` al depurar fallos |

---

## 4. Arquitectura de Automatización

```text
memoriadigital-e2e/
├── fixtures/                  # Imágenes de muestra y datos sintéticos
│   ├── images/
│   │   ├── principal-test.jpg
│   │   └── galeria-test.jpg
│   └── difuntos.data.ts
├── pages/                     # Page Object Model (POM)
│   ├── BasePage.ts            # Manejo común de URLs, esperas y alertas
│   ├── LoginPage.ts           # Acceso y autenticación en Joomla
│   ├── MisDifuntosPage.ts     # Listado de difuntos del usuario
│   └── DifuntoEditPage.ts     # Formulario de difunto (pestañas y campos)
├── specs/                     # Casos de prueba automatizados
│   ├── 01_auth_access.spec.ts
│   ├── auth.setup.ts          # Login único; guarda la sesión en .auth/user.json
│   ├── 02_difunto_crud.spec.ts
│   ├── 03_multimedia.spec.ts
│   └── 04_ubicacion_mapa.spec.ts
├── routes.ts                  # URLs del frontend por idioma (/es/, /en/)
├── .auth/user.json            # storageState generado (ignorado por git)
├── .env                       # Credenciales y BASE_URL (ignorado por git)
├── playwright.config.ts       # Timeouts, baseURL, proyectos setup/chromium
└── package.json               # Dependencias de Playwright
```

El repositorio es independiente de la aplicación: no lee archivos de `htdocs/` y solo la contacta por HTTP usando `BASE_URL`.

---

## 5. Matriz de Casos de Prueba

| ID | Suite | Caso de Prueba | Precondiciones | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **E2E-01** | Autenticación | Login de usuario registrado frontend (`memoria-digital`) | Usuario activo en Joomla | Sesión iniciada correctamente, redirección a perfil/inicio | **Alta (Fase 1)** |
| **E2E-02** | ACL / Acceso | Acceso a formulario nuevo difunto (`view=midifunto&layout=edit`) | Usuario logueado | Formulario carga sin bucles de redirección (`HTTP 200`) | **Alta (Fase 1)** |
| **E2E-03** | ACL / Acceso | Control de acceso no autenticado a nuevo difunto | Sesión anónima | Redirección controlada al login, sin pantalla en blanco | Media |
| **E2E-04** | CRUD | Creación de difunto con datos obligatorios mínimos | Usuario logueado | Guardado exitoso, mensaje de confirmación y asignación de ID | **Alta (Fase 2)** |
| **E2E-05** | CRUD | Validación de campos requeridos (Nombre, Apellidos, Cementerio) | Formulario vacío | Bloqueo por validación cliente/servidor con mensajes claros | Media |
| **E2E-06** | CRUD | Edición de difunto existente propio | Difunto creado por el usuario | Campos se actualizan y persisten tras guardar | **Alta (Fase 2)** |
| **E2E-07** | Multimedia | Carga de imagen principal vía input y Drag & Drop | Difunto guardado con ID | Imagen se procesa en `originales/{id}_1.jpg` y se previsualiza | **Alta (Fase 3)** |
| **E2E-08** | Multimedia | Carga múltiple en galería | Difunto con ID | Generación correlativa de `{id}_2.jpg`, `{id}_3.jpg` y miniaturas | **Alta (Fase 3)** |
| **E2E-09** | Multimedia | Eliminación de imagen de galería con modal de confirmación | Galería con imágenes | Archivo borrado del servidor y removido del grid visual | **Alta (Fase 3)** |
| **E2E-10** | Multimedia | Eliminación de imagen principal con confirmación | Imagen principal activa | Vuelve a mostrar la zona de carga (drop zone) vacía | **Alta (Fase 3)** |
| **E2E-11** | Multimedia | Persistencia de imágenes al recargar formulario | Imágenes subidas | Al refrescar la página (`F5`), las imágenes siguen presentes | **Alta (Fase 3)** |
| **E2E-12** | Ubicación | Cambio de cementerio y recentrado del mapa | Cementerio con GPS | Marcador y mapa se sitúan en las coordenadas del cementerio | Media |
| **E2E-13** | Ubicación | Marcado manual de coordenadas en mapa | Pestaña Ubicación | Campos latitud/longitud se actualizan al hacer clic/arrastrar | Media |

---

## 6. Fases de Implementación y Prioridades

### 🟢 Fase 1: Entorno Base y Autenticación/Permisos
- [x] Inicialización de `package.json` y `playwright.config.ts` en la raíz del repositorio de pruebas.
- [x] Creación de `LoginPage.ts`, `.env.example` y `.gitignore`.
- [x] Redacción de los specs **E2E-01**, **E2E-02** y **E2E-03** (`01_auth_access.spec.ts`).
- [x] Verificar prerrequisitos de la sección 2 e instalar dependencias.
- [x] Crear `.env` local y ejecutar los tests hasta que pasen.
- [x] Sesión reutilizable con `storageState` (`auth.setup.ts`) y ejecución en paralelo estable (ver sección 8).

### 🟡 Fase 2: Automatización CRUD de Difuntos
- [ ] Creación de `DifuntoEditPage.ts` y `MisDifuntosPage.ts`.
- [ ] Automatización de **E2E-04** (crear nuevo difunto) y **E2E-06** (edición de difunto propio).
- [ ] Verificación de flujo completo de guardado y persistencia en base de datos.

### 🟡 Fase 3: Regresión Multimedia (Causa Raíz Resuelta)
- [ ] Creación de fixtures de imágenes JPG en `fixtures/images/`.
- [ ] Automatización de **E2E-07**, **E2E-08**, **E2E-09**, **E2E-10** y **E2E-11**.
- [ ] Validación de eventos AJAX, respuestas JSON, DOM reactivo y diálogos de confirmación.

### ⚪ Fase 4: Pruebas de Ubicación/Mapa y Reportes
- [ ] Automatización de **E2E-12** y **E2E-13** (interacción con Leaflet/OSM).
- [ ] Configuración del visor de trazas (`Trace Viewer`) y reporte HTML automático.

---

## 7. Criterios de Aceptación para Regresión
1. Todos los tests de la suite priorizada (Fases 1, 2 y 3) pasan en modo headless y modo interactivo (`exit code 0`).
2. Las pruebas no dejan archivos basura en `images/legado/difuntos/` tras su ciclo de limpieza (teardown).
3. Reporte HTML ejecutable y visualizable con capturas de evidencia de cada paso.

---

## 8. Resultados de Ejecución y Estrategia de Sesión (`storageState`)

Resultados medidos en el entorno local (XAMPP, Joomla 5.4.9, Chromium, 2 workers por defecto). Esta sección es la referencia para futuras implementaciones con Playwright en el proyecto.

### 8.1 Comparativa de estrategias

| # | Estrategia | Configuración | Resultado | Duración |
|---|---|---|---|---|
| A | Login dentro de cada test, en paralelo | `timeout: 30s`, workers por defecto | ❌ 2 de 3 fallan (E2E-01 y E2E-02) por timeout en `toHaveCount`/`goto` | 1.7 min |
| B | Login dentro de cada test, en serie | `--workers=1`, `timeout: 30s` | ✅ 3 de 3, pero E2E-01 tarda 23 s y E2E-02 21 s, muy cerca del límite | 55 s |
| C | **Login único + `storageState`, en paralelo** | proyecto `setup` + `timeout: 60s` | ✅ 4 de 4 en 2 corridas consecutivas | 46–49 s |

### 8.2 Lo incorrecto (a evitar)
- ❌ **Hacer login en cada test con el mismo usuario y en paralelo.** Los logins simultáneos contra Joomla/XAMPP se interfieren y las navegaciones quedan esperando hasta el timeout.
- ❌ **Mantener el timeout por defecto de 30 s.** El primer login pasa por varios redirects (`/` → `/en/` → perfil) y tarda entre 8 y 15 s; con carga puede superar 20 s.
- ❌ **Resolver el fallo solo con `--workers=1`.** Funciona, pero serializa toda la suite y no escala al agregar las Fases 2 a 4.
- ❌ **Confiar en una marca `[x]` sin ejecutar.** La Fase 1 figuraba completa y la corrida paralela mostró 2 fallos.
- ❌ **Versionar `.auth/user.json` o `.env`.** Contienen sesión y credenciales; deben estar en `.gitignore`.

### 8.3 Lo correcto (estrategia adoptada)
- ✅ **Proyecto `setup`** (`auth.setup.ts`) que inicia sesión una sola vez y guarda `.auth/user.json`.
- ✅ **Proyecto `chromium`** con `dependencies: ['setup']` y `use.storageState: '.auth/user.json'`: todos los tests parten autenticados, sin repetir login.
- ✅ **Pruebas que requieren sesión limpia** (E2E-01 login y E2E-03 anónimo) declaran `test.use({ storageState: { cookies: [], origins: [] } })` dentro de un `test.describe`.
- ✅ **`timeout: 60_000`** y **`expect.timeout: 15_000`** para absorber la lentitud de XAMPP.
- ✅ **`fullyParallel: true`**: el login ya no es un cuello de botella.
- ✅ **`.auth/` en `.gitignore`**; la sesión se regenera en cada corrida.

### 8.4 Configuración de referencia

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
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
```

### 8.5 Consideraciones y límites conocidos
- La sesión guardada comparte el mismo usuario entre workers: los tests de escritura (Fases 2 y 3) deben crear sus propios difuntos con nombres únicos y limpiarlos, para no interferir entre sí.
- Si la sesión expira (tiempo de vida de sesión de Joomla), basta con volver a ejecutar la suite: el proyecto `setup` la renueva.
- Si un test prueba cierre de sesión (logout), debe hacerlo en un contexto sin `storageState` compartido, o invalidaría la sesión del resto.
- Pendiente de medir: estabilidad con más de 2 workers y con las pruebas de escritura de la Fase 2.

---

## 9. Ejecución y Solución de Problemas

| Acción | Comando |
|---|---|
| Ejecutar toda la suite | `npx playwright test` |
| Un solo archivo | `npx playwright test specs/01_auth_access.spec.ts` |
| Modo interactivo | `npx playwright test --ui` |
| Con navegador visible | `npx playwright test --headed` |
| Depurar | `npx playwright test --debug` |
| Ver reporte HTML | `npx playwright show-report` |
| Ver traza de un fallo | `npx playwright show-trace test-results/<carpeta>/trace.zip` |

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED` / timeout en `goto` | Apache no está iniciado | Iniciar Apache y MySQL en XAMPP |
| `ERR_TOO_MANY_REDIRECTS` en `midifunto` | Regresión de permisos en `HtmlView.php` o `MidifuntoController.php` | Revisar la lógica de propietario (`created_by`) |
| Login falla | `.env` vacío o credenciales incorrectas | Completar `E2E_USER` y `E2E_PASS` |
| Tests con sesión fallan en bloque tras cambios de usuario/contraseña | `.auth/user.json` obsoleto | Borrar `.auth/` y volver a ejecutar |
| Timeouts intermitentes en login o `goto` | Login repetido en paralelo o timeout corto | Usar `storageState` y `timeout: 60_000` (sección 8) |
| Subida de imágenes responde "No tiene permisos" | Regresión en `checkItemImagePermission` | Revisar `MidifuntoController.php` |
| `confirm` bloquea el test | Diálogo nativo sin manejar | Registrar `page.on('dialog', d => d.accept())` antes de la acción |
| Caché de Joomla muestra comportamiento antiguo | Caché obsoleta | Limpiar la carpeta `cache/` |

---

## 10. Plan para Skill `SKILL.md` (Reutilización)

Una vez estabilizadas las Fases 1 a 3, se documentará el procedimiento como skill de VS Code para que cualquier agente pueda crear o ejecutar pruebas de regresión del proyecto.

- **Ubicación propuesta:** `.github/skills/playwright-e2e-legado/SKILL.md`
- **Frontmatter:** `name` y `description` (cuándo usarla: crear, ejecutar o depurar pruebas E2E de `com_legado`).
- **Contenido previsto:**
  1. Prerrequisitos (resumen de la sección 2) y variables de `.env`.
  2. Estructura del repositorio `memoriadigital-e2e` y convención Page Object Model.
  3. Convenciones de selectores (IDs, no textos) y manejo de diálogos `confirm`.
  4. Patrón de limpieza (teardown) de datos e imágenes de prueba.
  5. Comandos de ejecución, tabla de solución de problemas (sección 9) y estrategia `storageState` (sección 8).
  6. Reglas del proyecto: URL con prefijo `/es/`, `<base href="/memorial/">`, tablas `#__legado_*`.
- **Estado:** [ ] pendiente, se redactará después de completar la Fase 3.
