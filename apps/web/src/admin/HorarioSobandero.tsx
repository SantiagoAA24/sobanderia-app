import { Navigate, useNavigate, useParams } from "react-router-dom";

import { Cargable } from "../cliente/Disposicion";
import { BackHeader } from "../componentes/ui";
import { FormularioDia } from "../panel/HorarioDia";
import { ListaDias, SEGMENTOS_DIA } from "../panel/Horario";
import { useGuardarHorarioSobandero, useHorarioSobandero, useSobandero } from "./consultas";
import { PantallaAdmin } from "./Disposicion";
import { useIdSobandero } from "./FichaSobandero";

/** Horario semanal de un sobandero: los mismos siete días de «Mi horario», editados por el administrador. */
export function HorarioSobandero() {
  const navigate = useNavigate();
  const id = useIdSobandero();
  const sobandero = useSobandero(id);
  const horario = useHorarioSobandero(id);
  const volver = `/admin/sobanderos/${id}`;
  return (
    <PantallaAdmin cabecera={<BackHeader onBack={() => navigate(volver)} />}>
      <h1 className="display-lg">Horario de {sobandero.data?.nombre ?? "…"}</h1>
      <p className="body-lg sb-muted">Cambiarlo no cancela las citas ya agendadas.</p>
      <Cargable consulta={horario} texto="Buscando el horario…">
        {(h) => <ListaDias horario={h} alElegir={(dia) => navigate(`${volver}/horario/${SEGMENTOS_DIA[dia]}`)} />}
      </Cargable>
    </PantallaAdmin>
  );
}

/** Un día del horario de un sobandero. */
export function HorarioDiaSobandero() {
  const id = useIdSobandero();
  const indice = SEGMENTOS_DIA.indexOf(useParams().dia as (typeof SEGMENTOS_DIA)[number]);
  const horario = useHorarioSobandero(id);
  const guardar = useGuardarHorarioSobandero(id);
  const volver = `/admin/sobanderos/${id}/horario`;
  if (indice < 0) return <Navigate to={volver} replace />;
  return (
    <Cargable consulta={horario} texto="Buscando el horario…">
      {(h) => <FormularioDia indice={indice} inicial={h.dias.find((d) => d.dia_semana === indice)?.franjas ?? []} volverA={volver} guardador={guardar} />}
    </Cargable>
  );
}
