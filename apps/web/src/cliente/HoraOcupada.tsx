import type { ReactNode } from "react";

import { Button, EmptyState, TimeSlot } from "../componentes/ui";
import { diaBogota, fechaLarga, horaBogota24, horaParaMostrar } from "../lib/fechas";
import { ConSobandero, PantallaCliente } from "./Disposicion";

export interface HoraOcupadaProps {
  cabecera: ReactNode;
  sobandero: string;
  /** Día del intento («AAAA-MM-DD») y la hora que se ocupó (UTC). */
  dia: string;
  pedida: string;
  /** Hasta tres horas libres cercanas que trae la API (UTC); pueden caer en otro día. */
  alternativas: string[];
  onElegir: (dia: string, hora: string) => void;
  onVerTodas: () => void;
}

/** Pantalla `Hora-ocupada` del lienzo: alguien tomó la hora; se ofrecen otras y los datos se conservan. */
export function HoraOcupada({ cabecera, sobandero, dia, pedida, alternativas, onElegir, onVerTodas }: HoraOcupadaProps) {
  const { hora, meridiem } = horaParaMostrar(pedida);
  const grupos = new Map<string, string[]>();
  for (const alt of alternativas) {
    const d = diaBogota(alt);
    grupos.set(d, [...(grupos.get(d) ?? []), alt]);
  }
  return (
    <PantallaCliente
      cabecera={cabecera}
      pie={
        <Button variant="outline" icon="calendar-week" onClick={onVerTodas} block>
          Ver todas las horas
        </Button>
      }
    >
      <h1 className="display-lg">Esa hora ya se ocupó</h1>
      <ConSobandero nombre={sobandero} detalle={fechaLarga(dia)} />
      <EmptyState
        title={`Alguien agendó las ${hora} ${meridiem}`}
        text="Ocurrió mientras usted llenaba sus datos. Elija otra hora; sus datos se conservan."
      />
      {alternativas.length > 0 ? (
        <section className="sb-cl__seccion" aria-label={`Otras horas libres con ${sobandero}`}>
          <h2 className="section-title">Otras horas libres con {sobandero}</h2>
          {[...grupos.entries()].map(([d, horas]) => (
            <div key={d} className="sb-cl__seccion">
              {d !== dia ? <span className="caption sb-muted">{fechaLarga(d)}</span> : null}
              <div className="sb-cl__horas">
                {horas.map((h) => {
                  const m = horaParaMostrar(h);
                  return <TimeSlot key={h} time={m.hora} meridiem={m.meridiem} onClick={() => onElegir(d, horaBogota24(h))} />;
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </PantallaCliente>
  );
}
