import { useLocation, useNavigate } from "react-router-dom";

/** «Atrás» vuelve a la pantalla anterior; si la página se abrió directo (sin historial), va a `respaldo`. */
export function useAtras(respaldo: string) {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key === "default" ? navigate(respaldo, { replace: true }) : navigate(-1));
}
