/**
 * Cabeceras de seguridad de la web. Una sola definición: `vite preview` (y por tanto los recorridos de
 * Playwright) las aplica, y `deploy/Caddyfile.cabeceras` las repite para el servidor; una prueba
 * (`src/cabeceras.test.ts`) comprueba que no se desincronicen.
 *
 * La CSP no admite scripts en línea ni de otros orígenes. `style-src 'unsafe-inline'` hace falta
 * porque React escribe atributos `style`; los scripts, que son lo que importa, quedan cerrados.
 * La API se llama por el mismo origen (`/api`), por eso `connect-src 'self'`.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const CABECERAS_WEB: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};
