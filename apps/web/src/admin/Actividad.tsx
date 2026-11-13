import { useNavigate } from "react-router-dom";

import { BackHeader, Button, EmptyState, OptionRow } from "../componentes/ui";
import { diaBogota } from "../lib/fechas";
import { Cargando } from "../transversales/Cargando";
import { SinConexion } from "../transversales/SinConexion";
import { useAhora } from "../panel/ahora";
import { textoDeError } from "../panel/errores";
import { diaYHora } from "../panel/formato";
import { useActividad } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

/** Pantalla `Admin-Actividad` (nueva, no está en el lienzo): quién cambió qué y cuándo, lo más reciente primero. */
export function Actividad() {
  const navigate = useNavigate();
  const hoy = diaBogota(useAhora());
  const consulta = useActividad();

  // Si falla «Ver más», la lista ya vista se conserva y el aviso sale debajo.
  const errorDeSiguiente: unknown = consulta.isFetchNextPageError ? consulta.error : null;

  if (consulta.isPending) return <Cargando texto="Buscando la actividad…" />;
  if (consulta.isError && !consulta.data) return <SinConexion onRetry={() => void consulta.refetch()} />;

  const filas = consulta.data?.pages.flat() ?? [];
  return (
    <PantallaAdmin cabecera={<BackHeader onBack={() => navigate("/admin/hoy")} />}>
      <h1 className="display-lg">Registro de actividad</h1>
      <p className="body-lg sb-muted">Los cambios hechos en el panel del administrador.</p>
      {filas.length === 0 ? (
        <EmptyState title="Todavía no hay actividad" text="Cuando cambie un horario, un sobandero o los datos del negocio, quedará aquí." />
      ) : (
        <ul className="sb-pn__lista" aria-label="Actividad">
          {filas.map((f) => (
            <li key={f.id}>
              <OptionRow title={f.texto} caption={`${f.quien} · ${diaYHora(f.creado_en, hoy)}`} trailing="none" />
            </li>
          ))}
        </ul>
      )}
      {consulta.hasNextPage ? (
        <Button variant="outline" block disabled={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
          Ver más
        </Button>
      ) : null}
      {errorDeSiguiente ? (
        <p role="alert" className="body sb-pn__error">
          {textoDeError(errorDeSiguiente)}
        </p>
      ) : null}
    </PantallaAdmin>
  );
}
