import { useNavigate } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { Button, IconButton, OptionRow } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { useBloqueos, useHorario, useQuitarBloqueo, type Bloqueo, type Horario as HorarioSemana } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { inicialDe, nombreDiaSemana, textoFranjas, textoHora } from "./formato";

/** Ruta de cada día: `/panel/horario/lunes`. */
export const SEGMENTOS_DIA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;

/** Pantalla `Horario` del lienzo: franjas por día, duración de cada cita y horas bloqueadas. */
export function Horario() {
  const navigate = useNavigate();
  const nombre = useSesion().data?.nombre ?? "";
  const horario = useHorario();
  return (
    <PantallaPanel nav="schedule" encabezado={{ fecha: "Semana a semana", titulo: "Mi horario", inicial: inicialDe(nombre) }}>
      <Cargable consulta={horario} texto="Buscando su horario…">
        {(h) => (
          <>
            <ListaDias horario={h} alElegir={(dia) => navigate(`/panel/horario/${SEGMENTOS_DIA[dia]}`)} />
            <OptionRow title="Duración de cada cita" caption={`${h.duracion_min} minutos. La cambia el administrador.`} icon="clock" trailing="none" />
            <HorasBloqueadas />
          </>
        )}
      </Cargable>
      <Button variant="outline" onClick={() => navigate("/panel/bloquear")} block>
        Bloquear horas
      </Button>
    </PantallaPanel>
  );
}

/** Los siete días con sus franjas; cada fila abre ese día. La usan el sobandero y el administrador. */
export function ListaDias({ horario, alElegir }: { horario: HorarioSemana; alElegir: (dia: number) => void }) {
  return (
    <ul className="sb-pn__lista">
      {horario.dias.map((d) => (
        <li key={d.dia_semana}>
          <OptionRow title={nombreDiaSemana(d.dia_semana)} caption={textoFranjas(d.franjas)} onClick={() => alElegir(d.dia_semana)} />
        </li>
      ))}
    </ul>
  );
}

function rotulo(b: Bloqueo) {
  const dia = fechaLarga(diaBogota(b.inicio));
  return `${dia}, ${textoHora(b.inicio)} a ${textoHora(b.fin)}`;
}

/** Los bloqueos que todavía no terminaron, con un botón para quitar cada uno. */
function HorasBloqueadas() {
  const bloqueos = useBloqueos();
  const quitar = useQuitarBloqueo();
  if (!bloqueos.data || bloqueos.data.length === 0) return null;
  return (
    <section className="sb-pn__seccion" aria-label="Horas bloqueadas">
      <h2 className="section-title">Horas bloqueadas</h2>
      {bloqueos.data.map((b) => (
        <div key={b.id} className="sb-pn__bloqueo">
          <div className="sb-pn__bloqueo-texto">
            <span className="body-lg">{rotulo(b)}</span>
            {b.motivo ? <span className="caption sb-muted">{b.motivo}</span> : null}
            {b.citas_afectadas > 0 ? (
              <span className="caption sb-muted">
                {b.citas_afectadas === 1 ? "1 cita agendada en este rango" : `${b.citas_afectadas} citas agendadas en este rango`}
              </span>
            ) : null}
          </div>
          <IconButton icon="x" label={`Quitar el bloqueo de ${rotulo(b)}`} disabled={quitar.isPending} onClick={() => quitar.mutate(b.id)} />
        </div>
      ))}
      {quitar.isError ? (
        <p role="alert" className="body sb-pn__error">
          No pudimos quitar el bloqueo. Intente de nuevo.
        </p>
      ) : null}
    </section>
  );
}
