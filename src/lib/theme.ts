/** Preferência de tema persistida num cookie (lido no servidor → sem "flash"). */
export const THEME_COOKIE = "mz-theme";
export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Script executado antes da pintura quando ainda não existe preferência:
 * segue o tema do sistema operativo.
 */
export const themeBootstrapScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var c=document.documentElement.classList;t==='dark'?c.add('dark'):c.remove('dark');}catch(e){}})();`;
