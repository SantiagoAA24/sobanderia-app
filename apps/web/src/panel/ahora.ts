import { useEffect, useState } from "react";

/** La hora actual, renovada cada cierto tiempo para que «En 10 min» y la siguiente cita se mantengan al día. */
export function useAhora(cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
