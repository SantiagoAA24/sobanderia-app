/** Celulares: se normalizan a E.164 igual que `app/seguridad/celular.py`. Nunca se registran completos. */

const E164 = /^\+[1-9][0-9]{7,14}$/;

/** «300 123 4567», «+57 300 123 4567» y «573001234567» dan «+573001234567». Null si no es válido. */
export function normalizarCelular(texto: string): string | null {
  const limpio = texto.replace(/[\s\-().]/g, "");
  let candidato = "";
  if (limpio.startsWith("+")) candidato = limpio;
  else if (/^3[0-9]{9}$/.test(limpio)) candidato = `+57${limpio}`;
  else if (/^57[0-9]{10}$/.test(limpio)) candidato = `+${limpio}`;
  return E164.test(candidato) ? candidato : null;
}

/** «+573001234567» -> «300 123 4567». Otros países se muestran tal cual. */
export function formatearCelular(e164: string): string {
  if (e164.startsWith("+57") && e164.length === 13) {
    const n = e164.slice(3);
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164;
}

/** «+573001234567» -> «300 *** 4567». Es la única forma permitida en registros (logs). */
export function enmascarar(e164: string): string {
  if (e164.startsWith("+57") && e164.length === 13) return `${e164.slice(3, 6)} *** ${e164.slice(-4)}`;
  return `*** ${e164.slice(-4)}`;
}
