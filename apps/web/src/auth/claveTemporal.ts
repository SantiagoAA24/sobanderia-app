/**
 * La clave temporal que se acaba de escribir en el ingreso, solo en memoria: sirve como «clave actual»
 * en la pantalla de primera clave (que tiene un solo campo). Nunca se guarda en disco ni en la URL;
 * si se recarga la página se pierde y la pantalla la vuelve a pedir.
 */
let clave: string | null = null;

export const guardarClaveTemporal = (valor: string) => {
  clave = valor;
};
export const leerClaveTemporal = () => clave;
export const olvidarClaveTemporal = () => {
  clave = null;
};
