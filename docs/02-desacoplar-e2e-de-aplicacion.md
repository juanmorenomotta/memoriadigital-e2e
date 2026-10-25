# Desacoplar las pruebas E2E de la aplicación Memorial Digital

**Objetivo:** que el proyecto Playwright viva en un repositorio propio (`memoriadigital-e2e`), sin depender de carpetas de la aplicación, y que pueda ejecutarse contra `https://memoriadigital.org` y, en el futuro, dentro de un contenedor.

---

## 1. Estado actual del acoplamiento

Revisión del repositorio `memoriadigital-e2e` (fecha: 2026-10-24, tras migrar y ejecutar la suite):

| Aspecto | Hallazgo | Acción |
|---|---|---|
| Lectura de archivos de la app | Ninguna. Las pruebas solo usan URLs | Ninguna |
| `BASE_URL` | Sin valor por defecto: `playwright.config.ts` lanza error si falta en `.env` | **Hecho** (Fase B) |
| Rutas de la aplicación | Centralizadas en `routes.ts`; ningún spec contiene `index.php/...` | **Hecho** (Fase B) |
| Idioma | Cada caso se genera para `/es/` y `/en/` desde `LANGUAGES` | **Hecho** (Fase B) |
| Ubicación física | `d:\xampp\htdocs\memoriadigital-e2e`: fuera de `memorial/` pero **dentro de `htdocs`** | Mover fuera de `htdocs` (Fase A) |
| Exposición web | Apache publica `.env`, `.env.local` y `.git/config` del repositorio | Bloquear o mover (Fase A) |
| Documentación | El documento 01 ya usa rutas relativas a la raíz (0 referencias a `tests/e2e/`) | **Hecho** (Fase A) |
| Archivos de entorno | `.env.local` y `.env.prod` existen, seleccionables con `TEST_ENV`; `.gitignore` cubre `.env*` y preserva `.env.example` | **Hecho** (Fase B) |
| Limpieza de datos | El plan propone revisar `images/legado/difuntos/` en disco | Hacerla por interfaz o HTTP (Fase B) |

---

## 2. Estructura del repositorio nuevo

El contenido de `tests/e2e/` pasa a la raíz del repositorio y `docs/` queda al mismo nivel.

```text
memoriadigital-e2e/
├── docs/
│   ├── 01-Plan-Pruebas-Regresion-E2E-Difuntos.md
│   └── 02-desacoplar-e2e-de-aplicacion.md
├── pages/
│   └── LoginPage.ts
├── specs/
│   ├── auth.setup.ts
│   └── 01_auth_access.spec.ts
├── routes.ts
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── playwright.config.ts
```

No se copian `node_modules/`, `.auth/`, `test-results/` ni `playwright-report/`, porque se regeneran.

`routes.ts` no existía en el proyecto original: se creó en la Fase B (ver sección 3).

---

## 3. Módulo de rutas (`routes.ts`)

**Estado: implementado.** Es la única fuente de verdad de las URLs del frontend; ni los `specs` ni los *page objects* escriben `index.php/...`.

```ts
export const LANGUAGES = ['es', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];

const prefix = (lang: Lang) => `index.php/${lang}`;

export const routes = {
  login:      (lang: Lang) => `${prefix(lang)}/component/users?view=login`,
  profile:    (lang: Lang) => `${prefix(lang)}/component/users/profile`,
  newDifunto: (lang: Lang) => `${prefix(lang)}/component/legado?view=midifunto&layout=edit`,
};

/** El login aparece como `?view=login` o como sufijo SEF `/users/login`. */
export const LOGIN_URL_PATTERN = /(?:view=login|\/users\/login)/;
```

### 3.1 Decisiones de diseño

1. **Rutas relativas** (sin `/` inicial): Playwright las resuelve contra `baseURL`, así el mismo código sirve para local y para `memoriadigital.org`.
2. **El idioma va en la ruta, no en el query string.** Joomla con filtro de idiomas exige el prefijo (`index.php/es/...`). La forma `index.php?option=...` sin prefijo redirige al idioma por defecto, por lo que E2E-01 “pasaba” en inglés sin probar el español.
3. **Sin `storageState` por idioma.** La sesión es una cookie de servidor y el idioma lo impone la URL; un solo `.auth/user.json` sirve para ambos.
4. **Selectores por estructura, no por texto.** El botón de login dice “Conectar” en español y “Log in” en inglés, por eso `LoginPage` usa `#com-users-login__form button[type=submit]`.
5. **Aserciones de idioma.** Cada caso verifica `html[lang]` (`^es` / `^en`): si el prefijo se ignora, la prueba falla en vez de pasar en silencio.

### 3.2 Consumidores

| Archivo | Uso |
|---|---|
| `pages/LoginPage.ts` | `routes.login(lang)` |
| `specs/01_auth_access.spec.ts` | `routes.newDifunto(lang)` en E2E-02 y E2E-03 |
| `specs/auth.setup.ts` | `LOGIN_URL_PATTERN` como aserción negativa tras el login |

### 3.3 Comportamiento verificado contra `http://localhost/memorial/`

| Ruta | Anónimo | Autenticado |
|---|---|---|
| `index.php/es/component/legado?view=midifunto&layout=edit` | `303` → `/es/component/users/login?return=...` | `200`, `#jform_id`, `html lang="es-es"` |
| `index.php/en/component/legado?view=midifunto&layout=edit` | `303` → `/en/component/users/login?return=...` | `200`, `#jform_id`, `html lang="en-gb"` |
| `index.php/component/legado?...` (sin prefijo) | error del router | error del router |

El parámetro `return` conserva el idioma de origen, así que el flujo de redirección no cambia de idioma.

### 3.4 Cómo extenderlo

- **Ruta nueva:** añadir la entrada al objeto `routes` y consumirla desde el *page object*. Nunca escribir la URL en un `spec`.
- **Idioma nuevo:** añadirlo a `LANGUAGES` (p. ej. `'pt'`) y verificar que exista en el backend (*System → Languages → Content Languages*). El bucle de `01_auth_access.spec.ts` genera los casos automáticamente.
- **Ejecutar un solo idioma:** `npx playwright test -g "idioma ES"`.

---

## 4. Configuración por entorno (`TEST_ENV`)

**Estado: implementado.** `playwright.config.ts` resuelve el entorno antes de definir la configuración:

```ts
export const TEST_ENV = process.env.TEST_ENV ?? 'local';
const ENV_FILES = [`.env.${TEST_ENV}`, '.env'].filter((file) => fs.existsSync(path.resolve(__dirname, file)));
for (const file of ENV_FILES) dotenv.config({ path: path.resolve(__dirname, file) });
```

Reglas:

1. Se carga primero `.env.<TEST_ENV>` y después `.env` como respaldo **por variable** (`dotenv` no sobreescribe lo ya definido, así que el archivo específico gana).
2. `TEST_ENV` por defecto es `local`, por lo que `npx playwright test` sigue funcionando sin exportar nada.
3. Si no aparece `BASE_URL` en ninguno de los archivos, la configuración falla con un mensaje que lista qué archivos se intentaron leer.

```powershell
npx playwright test                    # TEST_ENV=local  -> .env.local + .env
$env:TEST_ENV='prod'; npx playwright test   #                -> .env.prod  + .env
```

Verificado: con `TEST_ENV=check` y un `.env.check` que solo definía `BASE_URL`, la suite apuntó a esa URL y tomó las credenciales de `.env`, lo que confirma la precedencia y el respaldo por variable.

**Pendiente:** `.env.prod` sigue siendo una copia de los valores locales (`http://localhost/memorial/` y la misma cuenta). Debe completarse con `BASE_URL=https://memoriadigital.org/` y una cuenta propia antes de usar `TEST_ENV=prod`.

---

## 5. Plan por fases

### Fase A: repositorio independiente
- [x] Crear la carpeta `memoriadigital-e2e`. **Matiz:** quedó en `d:\xampp\htdocs\memoriadigital-e2e`, fuera de `memorial/` pero dentro de `htdocs`; moverla es trabajo pendiente.
- [x] Copiar `tests/e2e/` y `tests/docs/` (copia, sin mover el original).
- [x] Abrir la carpeta en otro VS Code, ejecutar `npm install` y `npx playwright install chromium` (`@playwright/test` 1.64.1, `chromium-1248`).
- [x] Ejecutar la suite desde el repositorio nuevo: **7 pruebas** (1 setup + 6, tras añadir el segundo idioma) en verde contra `localhost`.
- [x] Inicializar git (`git init`) **y hacer el primer commit**. Rama `main`, commit `e6245fb first commit`.
- [x] Actualizar las rutas del documento 01 (`tests/e2e/` pasa a la raíz). Verificado: 0 referencias a `tests/e2e/` en el documento 01.
- [x] Cuando el repositorio nuevo funcione, quitar `tests/` del repositorio `memoriadigital`. Verificado: `D:\xampp\htdocs\memorial\tests` ya no existe.

### Fase B: configuración por entorno (apuntar a memoriadigital.org)
- [x] Quitar el valor por defecto de `BASE_URL` en `playwright.config.ts`; que falle si falta.
- [x] Crear `.env.local` y `.env.prod`, elegidos con la variable `TEST_ENV`. `playwright.config.ts` carga `.env.<TEST_ENV>` (por defecto `local`) y luego `.env` como respaldo por variable. **Pendiente:** `.env.prod` sigue apuntando a `localhost/memorial` y reutiliza las credenciales locales; hay que darle el `BASE_URL` y la cuenta reales antes de usarlo.
- [x] `.gitignore` cubre `.env*` con excepción de `.env.example` (antes solo ignoraba `.env`, así que `.env.local` y `.env.prod` quedaban expuestos a un `git add .`).
- [x] Mover `index.php/es/component/legado?...` a un módulo `routes.ts` (sección 3).
- [x] Multi-idioma: `LANGUAGES` en `routes.ts` genera cada caso para `/es/` y `/en/`.
- [ ] Regenerar `.auth/user.json` por entorno; nunca compartirlo entre local y producción.
- [ ] Política de datos: la limpieza se hace por interfaz o HTTP, no por sistema de archivos.

### Fase C: contenedor y CI
- [ ] `Dockerfile` basado en `mcr.microsoft.com/playwright:v<versión>`, con la misma versión que `@playwright/test`.
- [ ] Credenciales por variables de entorno o secretos; nunca dentro de la imagen.
- [ ] Volúmenes para `playwright-report/` y `test-results/`.
- [ ] Ejecución en GitHub Actions: programada y tras cada despliegue.

---

## 6. Riesgos al apuntar a producción

1. **Escritura real.** Las Fases 2 y 3 crean y borran difuntos e imágenes. Se recomienda un entorno de staging para las pruebas de escritura; en producción, solo pruebas de lectura (smoke) o una cuenta dedicada con datos prefijados `E2E_` que se limpian al terminar. Decisión pendiente.
2. **Política del plan 01.** La sección 2.2, punto 6, dice "nunca contra producción". Debe reemplazarse por una política explícita de qué suites pueden correr en producción.
3. **Bloqueos del hosting.** Un WAF, límites de intentos de login, CAPTCHA o protección anti-bots pueden rechazar al navegador automatizado, sobre todo desde la IP de un contenedor. Probarlo temprano con la suite actual.
4. **Latencia real.** Los tiempos con internet difieren de XAMPP. Los timeouts actuales son 120 s por prueba, 90 s de navegación y 60 s por acción, calibrados con un TTFB local de 2–6 s; en producción hay que medirlos de nuevo.
5. **Datos de referencia.** El entorno destino necesita un usuario del grupo Registered y un cementerio publicado con GPS. Son prerrequisitos, no algo que la prueba cree.
6. **Credenciales.** Usar una cuenta y contraseña propias para producción, guardadas solo como secreto del CI.
7. **Repositorio dentro de `htdocs` (activo).** Apache sirve el `.env`, el `.env.local` completo (credenciales `E2E_USER`/`E2E_PASS`) y el `.git/config` del repositorio en `http://localhost/memoriadigital-e2e/.env`. `.gitignore` evita filtrarlas a git, pero **no** a HTTP. Mientras siga bajo `htdocs`, hay que mover la carpeta o excluirla en la configuración de Apache.

---

## 7. Criterios de aceptación de la Fase A

1. El repositorio nuevo no referencia ninguna ruta de `htdocs/memorial`. **Cumplido** (verificado en `docs/01` y en el código).
2. `npm install` y la suite se ejecutan desde la carpeta nueva con `exit code 0`. **Cumplido.**
3. La suite pasa contra `localhost`: hoy son 7 pruebas (setup + 6 por los dos idiomas), con `workers: 1` porque XAMPP no sostiene dos sesiones concurrentes. **Cumplido.**
4. `.env`, sus variantes (`.env.local`, `.env.prod`) y `.auth/` están ignorados por git, y `.env.example` sí se versiona. **Cumplido** (verificado con `git check-ignore`).
5. El repositorio está fuera de `htdocs`, o la carpeta está excluida de Apache. **Pendiente.**
6. Existe al menos un commit con el estado inicial. **Cumplido** (`e6245fb`).
