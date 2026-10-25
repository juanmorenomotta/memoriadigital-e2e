/**
 * Rutas del frontend de Memorial Digital.
 *
 * Joomla usa SEF con filtro de idiomas: el idioma ocupa el primer segmento de
 * la URL (`/es/...` o `/en/...`) y el resto es el alias del componente. Las
 * rutas son relativas (sin `/` inicial) para que se resuelvan contra
 * `BASE_URL`, que cambia segun el entorno.
 */
export const LANGUAGES = ['es', 'en'] as const;

export type Lang = (typeof LANGUAGES)[number];

export const isLang = (value: string): value is Lang =>
  (LANGUAGES as readonly string[]).includes(value);

export const resolveLang = (value?: string): Lang =>
  value && isLang(value) ? value : LANGUAGES[0];

const prefix = (lang: Lang) => `index.php/${lang}`;

export const routes = {
  login: (lang: Lang) => `${prefix(lang)}/component/users?view=login`,
  profile: (lang: Lang) => `${prefix(lang)}/component/users/profile`,
  newDifunto: (lang: Lang) => `${prefix(lang)}/component/legado?view=midifunto&layout=edit`,
  misDifuntos: (lang: Lang) => `${prefix(lang)}/component/legado?view=misdifuntos`,
  editDifunto: (lang: Lang, id: number | string) =>
    `${prefix(lang)}/component/legado?view=midifunto&layout=edit&id=${encodeURIComponent(String(id))}`,
};

/** El login aparece como `?view=login` o como sufijo SEF `/users/login`. */
export const LOGIN_URL_PATTERN = /(?:view=login|\/users\/login)/;
