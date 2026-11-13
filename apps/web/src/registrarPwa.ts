import { registerSW } from "virtual:pwa-register";

/**
 * Registra el service worker solo en producción. Una versión nueva queda esperando y se activa
 * la próxima vez que se abra la app: nunca se recarga la pantalla mientras alguien llena sus datos.
 */
export function registrarPwa(): void {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  registerSW({ immediate: true });
}
