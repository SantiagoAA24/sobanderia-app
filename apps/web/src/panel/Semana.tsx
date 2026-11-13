import { useNavigate, useSearchParams } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { Button, DayChip, EmptyState, StatusNote } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { diaBogota, esDiaValido, etiquetaDia } from "../lib/fechas";
import { useAhora } from "./ahora";
import { useCitasSemana } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { FilaCita } from "./FilaCita";
import { citasTexto, inicialDe, rangoSemana, semanaDe } from "./formato";

const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];

/** Pantallas `Semana` y `Dia-vacio` del lienzo. El día elegido viaja en la URL (`?dia=AAAA-MM-DD`). */
export function Semana() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const hoy = diaBogota(useAhora());
  const pedido = params.get("dia");
  const dia = esDiaValido(pedido) ? pedido : hoy;
  const { lunes, domingo, dias } = semanaDe(dia);
  const consulta = useCitasSemana(lunes);
  const nombre = useSesion().data?.nombre ?? "";

  return (
    <PantallaPanel nav="week" encabezado={{ fecha: rangoSemana(lunes, domingo), titulo: "Su semana", inicial: inicialDe(nombre) }}>
      <nav aria-label="Días de la semana" className="sb-pn__semana">
        {dias.map((d, i) => (
          <DayChip
            key={d}
            day={LETRAS[i]!}
            date={Number(d.slice(8))}
            label={etiquetaDia(d)}
            selected={d === dia}
            onClick={() => setParams({ dia: d }, { replace: true })}
          />
        ))}
      </nav>

      <Cargable consulta={consulta} texto="Buscando sus citas…">
        {(citas) => {
          const porDia = new Map<string, typeof citas>();
          for (const c of citas) {
            const d = diaBogota(c.inicio);
            porDia.set(d, [...(porDia.get(d) ?? []), c]);
          }
          const delDia = porDia.get(dia) ?? [];
          const proximo = dias.find((d) => d > dia && (porDia.get(d)?.length ?? 0) > 0);

          return (
            <>
              {delDia.length === 0 ? (
                <>
                  <EmptyState title="No tiene citas este día" text="Cuando alguien agende, la cita aparecerá aquí." />
                  <div className="sb-pn__seccion">
                    <Button icon="plus" onClick={() => navigate(`/panel/nueva-cita?dia=${dia}`)} block>
                      Nueva cita
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/panel/bloquear?dia=${dia}`)} block>
                      Bloquear horas
                    </Button>
                  </div>
                </>
              ) : (
                <section className="sb-pn__seccion" aria-label={`Citas del ${etiquetaDia(dia).toLowerCase()}`}>
                  <h2 className="section-title">
                    {etiquetaDia(dia)} · {citasTexto(delDia.length)}
                  </h2>
                  {delDia.map((c) => (
                    <FilaCita key={c.id} cita={c} />
                  ))}
                </section>
              )}
              {proximo ? (
                <StatusNote icon="calendar-week">
                  {etiquetaDia(proximo)} tiene {citasTexto(porDia.get(proximo)!.length)}
                </StatusNote>
              ) : null}
            </>
          );
        }}
      </Cargable>
    </PantallaPanel>
  );
}
