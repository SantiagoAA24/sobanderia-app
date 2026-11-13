import { Button, OptionRow, TimeSlot } from "../componentes/ui";
import { diaBogota, horaParaMostrar } from "../lib/fechas";
import { useDiasLibres, useHorasLibres } from "./consultas";
import { rotuloDia } from "./formato";

const MAX_DIAS = 14;

export interface DiaHora {
  dia: string | null;
  /** Inicio elegido, en UTC (tal como lo da la API). */
  inicio: string | null;
}

export interface ElegirDiaHoraProps {
  valor: DiaHora;
  onChange: (valor: DiaHora) => void;
  /** Al cambiar una cita: su propia hora cuenta como libre. */
  excluirCita?: number;
}

function Reintentar({ texto, onRetry }: { texto: string; onRetry: () => void }) {
  return (
    <>
      <p role="alert" className="body sb-pn__error">
        {texto}
      </p>
      <Button variant="outline" size="md" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </>
  );
}

/** Los días con horas libres y las horas de uno, calculados por el servidor. Lo usan `Reprogramar` y `Nueva-cita`. */
export function ElegirDiaHora({ valor, onChange, excluirCita }: ElegirDiaHoraProps) {
  const hoy = diaBogota(new Date());
  const dias = useDiasLibres();
  const horas = useHorasLibres(valor.dia, excluirCita);

  return (
    <>
      <section className="sb-pn__seccion" aria-label="Día">
        <h2 className="section-title">Día</h2>
        {dias.isPending ? (
          <p role="status" className="body sb-muted">
            Buscando días libres…
          </p>
        ) : dias.isError ? (
          <Reintentar texto="No pudimos cargar los días. Revise su internet." onRetry={() => void dias.refetch()} />
        ) : dias.data.dias.length === 0 ? (
          <p className="body-lg">No tiene días con horas libres. Revise su horario.</p>
        ) : (
          dias.data.dias.slice(0, MAX_DIAS).map((d) => (
            <OptionRow key={d} title={rotuloDia(d, hoy)} trailing="radio" selected={valor.dia === d} onClick={() => onChange({ dia: d, inicio: null })} />
          ))
        )}
      </section>

      {valor.dia ? (
        <section className="sb-pn__seccion" aria-label="Hora">
          <h2 className="section-title">Hora</h2>
          {horas.isPending ? (
            <p role="status" className="body sb-muted">
              Buscando horas libres…
            </p>
          ) : horas.isError ? (
            <Reintentar texto="No pudimos cargar las horas. Revise su internet." onRetry={() => void horas.refetch()} />
          ) : horas.data.horas.length === 0 ? (
            <p className="body-lg">No quedan horas libres ese día. Elija otro.</p>
          ) : (
            <div className="sb-pn__horas">
              {horas.data.horas.map((inicio) => (
                <TimeSlot
                  key={inicio}
                  time={horaParaMostrar(inicio).hora}
                  meridiem={horaParaMostrar(inicio).meridiem}
                  selected={valor.inicio === inicio}
                  onClick={() => onChange({ dia: valor.dia, inicio })}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
