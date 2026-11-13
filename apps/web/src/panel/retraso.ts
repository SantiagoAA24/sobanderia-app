import { useEffect, useState } from "react";

/** El valor, pero solo después de que deja de cambiar durante `ms` (para no buscar en cada tecla). */
export function useRetraso<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}
