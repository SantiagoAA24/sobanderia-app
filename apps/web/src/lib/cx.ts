/** Une nombres de clase omitiendo los valores vacíos. */
export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(" ");
}
