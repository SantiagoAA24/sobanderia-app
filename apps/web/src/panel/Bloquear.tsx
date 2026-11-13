import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { BackHeader, Button, OptionRow, TextField, TimeSlot } from "../componentes/ui";
import { Cargable } from "../cliente/Disposicion";
import { diaBogota, esDiaValido, iniciaEnBogota, sumarDias } from "../lib/fechas";
import { useCrearBloqueo, useHorario } from "./consultas";
import { PantallaPanel } from "./Disposicion";
import { textoDeError } from "./errores";
import { hora12, mayorQue, pasosDeFranjas, rotuloDia, semanaDe } from "./formato";
import { useAtras } from "./navegacion";

const DIAS_OFRECIDOS = 14;

/** Lo que Hoy le dice después de bloquear: las citas que caían en el rango siguen agendadas. */
function avisoDeBloqueo(citas: number): string {
  if (citas === 0) return "Bloqueó esas horas.";
  return citas === 1
    ? "Bloqueó esas horas. Tiene 1 cita agendada en ese rango: ábrala para cambiarla o cancelarla."
    : `Bloqueó esas horas. Tiene ${citas} citas agendadas en ese rango: ábralas para cambiarlas o cancelarlas.`;
}

/** Pantalla `Bloquear` del lienzo: día, desde, hasta y motivo. Las citas ya agendadas no se cancelan. */
export function Bloquear() {
  const horario = useHorario();
  return (
    <Cargable consulta={horario} texto="Un momento…">
      {(h) => <FormularioBloquear dias={h.dias} />}
    </Cargable>
  );
}

function FormularioBloquear({ dias }: { dias: { dia_semana: number; franjas: { desde: string; hasta: string }[] }[] }) {
  const navigate = useNavigate();
  const atras = useAtras("/panel/hoy");
  const [params] = useSearchParams();
  const crear = useCrearBloqueo();
  const hoy = diaBogota(new Date());
  const pedido = params.get("dia");
  const [dia, setDia] = useState<string | null>(esDiaValido(pedido) ? pedido : null);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lista = useMemo(() => Array.from({ length: DIAS_OFRECIDOS }, (_, i) => sumarDias(hoy, i)), [hoy]);
  const franjas = useMemo(() => {
    if (!dia) return [];
    const indice = semanaDe(dia).dias.indexOf(dia);
    return dias.find((d) => d.dia_semana === indice)?.franjas ?? [];
  }, [dia, dias]);
  const { inicios, finales } = useMemo(() => pasosDeFranjas(franjas), [franjas]);
  const finalesPosibles = desde ? finales.filter((f) => mayorQue(f, desde)) : [];

  const elegirDia = (d: string) => {
    setDia(d);
    setDesde(null);
    setHasta(null);
  };

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!dia || !desde || !hasta) return;
    setError(null);
    crear.mutate(
      { inicio: iniciaEnBogota(dia, desde), fin: iniciaEnBogota(dia, hasta), motivo: motivo.trim() || null },
      {
        onSuccess: (bloqueo) =>
          navigate("/panel/hoy", {
            replace: true,
            state: { aviso: avisoDeBloqueo(bloqueo.citas_afectadas) },
          }),
        onError: (e) => setError(textoDeError(e)),
      },
    );
  };

  const slot = (hhmm: string, elegido: boolean, alElegir: () => void) => (
    <TimeSlot key={hhmm} time={hora12(hhmm).hora} meridiem={hora12(hhmm).meridiem} selected={elegido} onClick={alElegir} />
  );

  return (
    <form onSubmit={guardar} noValidate>
      <PantallaPanel
        cabecera={<BackHeader onBack={atras} />}
        pie={
          <Button type="submit" icon="check" disabled={!dia || !desde || !hasta || crear.isPending} block>
            Bloquear horas
          </Button>
        }
      >
        <h1 className="display-lg">Bloquear horas</h1>
        <section className="sb-pn__seccion" aria-label="Día">
          <h2 className="section-title">Día</h2>
          {lista.map((d) => (
            <OptionRow key={d} title={rotuloDia(d, hoy)} trailing="radio" selected={dia === d} onClick={() => elegirDia(d)} />
          ))}
        </section>

        {dia && franjas.length === 0 ? <p className="body-lg">No atiende ese día, así que no hay horas para bloquear.</p> : null}

        {dia && franjas.length > 0 ? (
          <>
            <section className="sb-pn__seccion" aria-label="Desde">
              <h2 className="section-title">Desde</h2>
              <div className="sb-pn__horas">
                {inicios.map((h) =>
                  slot(h, desde === h, () => {
                    setDesde(h);
                    if (hasta && !mayorQue(hasta, h)) setHasta(null);
                  }),
                )}
              </div>
            </section>
            {desde ? (
              <section className="sb-pn__seccion" aria-label="Hasta">
                <h2 className="section-title">Hasta</h2>
                <div className="sb-pn__horas">{finalesPosibles.map((h) => slot(h, hasta === h, () => setHasta(h)))}</div>
              </section>
            ) : null}
          </>
        ) : null}

        <TextField
          label="Motivo (opcional)"
          placeholder="Por ejemplo: una diligencia"
          helper="Las citas que ya tiene agendadas en ese rango no se cancelan."
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error ? (
          <p role="alert" className="body sb-pn__error">
            {error}
          </p>
        ) : null}
      </PantallaPanel>
    </form>
  );
}
